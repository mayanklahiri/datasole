const { STATUS_CODES } = require("http");
const assert = require("assert");

const WebSocket = require("ws");
const { parallelLimit } = require("async");
const {
  defer,
  size,
  get,
  map,
  isObject,
  isUndefined,
  isString
} = require("lodash");

const BaseServer = require("../BaseServer");
const log = require("../../../logging").getLogger();
const { getRemoteIp } = require("../../../util");
const { makeId } = require("../../../util/make-id");
const { urlJoin } = require("../../../util/url-join");
const {
  parseMessagePacket,
  makeMessagePacket,
  makeApplyOperation,
  makeWsAuthRequest
} = require("../../../protocol");

/**
 * Clients to send broadcasts to concurrently.
 */
const BROADCAST_CONCURRENCY = 20;

/**
 * Logging truncation length.
 */
const MESSAGE_PREVIEW_LENGTH = 50;

/**
 * Adds a WebSocket endpoint to an Express server.
 */
class WebSocketServer extends BaseServer {
  constructor(...args) {
    super(...args);
    this._connections = {};
    this._wsAuthRequests = {};
  }

  /**
   * Service dependencies.
   */
  getDependencies() {
    return ["HttpServer", "LiveModelServer"];
  }

  /**
   * Service entry point.
   */
  async run(svcDeps) {
    const config = this._config;
    const {
      HttpServer: httpServer,
      LiveModelServer: liveModelServer
    } = svcDeps;
    this._svcDeps = svcDeps;

    // Websocket endpoint configuration options.
    const urlRootPath = config.getRequiredStringKey("urlRootPath");
    const urlWsRelPath = config.getRequiredStringKey("websocketPath");
    const wsPath = urlJoin(urlRootPath, urlWsRelPath);
    const websocketAuth = config.getCheckedKey("websocketAuth");
    const websocketAuthTimeoutMs = Math.max(
      1000,
      config.getRequiredIntKey("websocketAuthTimeoutMs")
    );

    this.config = {
      wsPath,
      websocketAuth,
      websocketAuthTimeoutMs
    };

    // Create an instance of 'ws.Server'.
    this._wsServer = new WebSocket.Server({
      path: wsPath,
      noServer: true
    });

    // Listen for HTTP upgrade events to insert WebSocket authentication handlers.
    httpServer.getHttpServer().on("upgrade", this.onUpgrade.bind(this));

    // Listen for WebSocket connections.
    this._wsServer.on("connection", this.onConnection.bind(this));

    // Watch for LiveModel send events.
    liveModelServer.on("broadcast", (...args) => this.broadcast(...args));
  }

  /**
   * Shuts down the WebSocket server.
   */
  async close() {
    try {
      this._wsServer.close();
    } catch (e) {
      log.warn(`Cannot shutdown WebSocket server cleanly: ${e}`);
    }
  }

  /**
   * HTTP Upgrade request to WebSocket received, perform Auth.
   */
  async onUpgrade(request, socket, head) {
    const { websocketAuth, websocketAuthTimeoutMs } = this.config;
    const wsAuthRequest = makeWsAuthRequest(request);
    const { clientId } = wsAuthRequest;

    // Set authorization timeout handler.
    const timeout = setTimeout(() => {
      const code = 503;
      const status = STATUS_CODES[code];
      const errObj = Object.assign(
        new Error(
          `HTTP ${code} ${status}: Timed out after waiting for authorization handler for ${websocketAuthTimeoutMs} ms.`
        ),
        { code, status }
      );
      this.refuseAuthRequest(wsAuthRequest, errObj);
    }, websocketAuthTimeoutMs);
    this._wsAuthRequests[clientId] = [request, socket, head, timeout];

    if (websocketAuth) {
      // Emit ws_auth_request event if auth is enabled.
      log.debug(`WebSocket auth request:`, wsAuthRequest);
      defer(() => this.emit("ws_auth_request", wsAuthRequest));
    } else {
      // Authorize requests automatically if auth is disabled.
      log.debug(
        `Authorizing WebSocket client ${clientId} from ${
          wsAuthRequest.remoteIp
        }`
      );
      await this.authorize(wsAuthRequest);
    }
  }

  /**
   * Authorize an HTTP upgrade request.
   *
   */
  async authorize(wsAuthRequest) {
    const { clientId } = wsAuthRequest;
    if (this._wsAuthRequests[clientId]) {
      const [request, socket, head, timeout] = this._wsAuthRequests[clientId];
      const { _wsServer: wsServer } = this;
      clearTimeout(timeout);
      delete this._wsAuthRequests[clientId];

      log.debug(`Allowing WebSocket connection for client "${clientId}"`);
      wsServer.handleUpgrade(request, socket, head, ws => {
        wsServer.emit("connection", ws, request);
      });
    } else {
      log.warn(
        `Cannot authorize unknown WebSocket request for client "${clientId}"`
      );
    }
  }

  /**
   * Refuse an HTTP upgrade request.
   *
   */
  async refuseAuthRequest(wsAuthRequest, error) {
    const { clientId } = wsAuthRequest;
    if (this._wsAuthRequests[clientId]) {
      const [request, socket, head, timeout] = this._wsAuthRequests[clientId];
      log.info(
        `Destroying unauthorized WebSocket connection for client "${clientId}" from ${getRemoteIp(
          request
        )}`
      );
      if (socket.writable) {
        const content = JSON.stringify({
          error: error.message,
          code: error.code
        });
        const resp = [
          `HTTP/1.1 ${error.code} ${STATUS_CODES[error.code]}`,
          "Content-Type: application/json",
          "Content-Length: " + content.length,
          "Connection: close",
          "",
          content,
          ""
        ].join("\n");
        socket.write(resp);
      }
      if (timeout) clearTimeout(timeout);
      delete this._wsAuthRequests[clientId];
      socket.removeAllListeners("error");
      defer(() => socket.destroy());
    } else {
      log.warn(
        `Cannot de-authorize unknown WS request for client "${clientId}"`
      );
    }
  }

  /**
   * New Websocket client connected.
   *
   * @param {*} socket 'ws.Socket' instance
   * @param {*} req HTTP request for Websocket
   */
  onConnection(socket, req) {
    // Generate a unique globally unique client ID.
    const clientId = makeId();

    // Collect connection metadata.
    const connectedAt = new Date().toISOString();
    const remoteIp = getRemoteIp(req);

    // Save connection indexed by client ID.
    const connInfo = (this._connections[clientId] = {
      clientId,
      connectedAt,
      remoteIp,
      socket,
      req
    });

    // Listen for socket events.
    socket.once("close", this.onClose.bind(this, clientId));
    socket.on("message", this.onMessage.bind(this, clientId));
    socket.on("error", this.onError.bind(this, clientId));

    // Notify.
    log.debug(`Client "${clientId}" connected from IP "${remoteIp}"`);
    this.emit("client_new", connInfo);

    // Send the current state to the new client.
    this.sendStateRefresh(clientId);
  }

  /**
   * Handler for an incoming client message.
   *
   * @param {string} clientId Client ID of client that sent this message.
   * @param {string} msgStr Raw message string.
   */
  onMessage(clientId, msgStr) {
    // Locate connection, do not parse queued messages from dropped connections.
    const connection = this._connections[clientId];
    if (!connection) {
      log.debug(
        `Dropping queued incoming message from dropped client ${clientId}.`
      );
      return;
    }

    // Parse the message payload.
    let payload;
    try {
      payload = parseMessagePacket(msgStr);
    } catch (e) {
      log.warn(`Invalid message from client ${clientId}, dropping: ${e}`);
      log.debug(e);
      this.emit("incoming_message_malformed", {
        msgStr,
        error: e.message
      });
      return;
    }

    log.debug(
      `Received message of size ${msgStr.length} from client ${clientId}`
    );

    this.emit("incoming_message", payload, {
      clientId,
      remoteIp: connection.remoteIp,
      connectedAt: connection.connectedAt,
      receivedAt: Date.now(),
      rawLength: msgStr.length
    });
  }

  /**
   * Handler for a socket dropping.
   */
  onClose(clientId) {
    const conn = this._connections[clientId];
    if (conn) {
      try {
        conn.socket.terminate();
      } catch (e) {
        log.error(`Cannot close connection: ${e}`);
      }
      delete this._connections[clientId];
      this.emit("client_end", { clientId });
    }
  }

  /**
   * Handler for a socket error.
   * @param {*} req
   */
  onError(clientId, error) {
    log.warn(`Client ${clientId} socket error: ${error}`);
  }

  /**
   * Send current model to client. The expected effect is a full refresh
   * of the entire model for a client that disconnects and reconnects. This
   * is achieved by sending a $clearAll operation followed by a $shallowAssign
   * on the root key path, to be applied atomically.
   *
   * @param {*} clientId Client to send the welcome packet to.
   */
  sendStateRefresh(clientId) {
    const applyOp = makeApplyOperation([
      {
        type: "$clearAll"
      },
      {
        type: "$shallowAssign",
        value: this._svcDeps.LiveModelServer.getModelUnsafe()
      }
    ]);
    this.sendOne(clientId, applyOp);
  }

  /**
   * Broadcasts a JSON message to all connected clients.
   *
   * Empty messages are not allowed. If 'message' is undefined, nothing is broadcast.
   *
   * @param {Object} message JSON-serializable nested object.
   */
  async broadcast(message) {
    assert(
      isObject(message),
      "message passed to broadcast() must be an object."
    );
    assert(!isUndefined(message.type), 'message must have a "type" field.');

    // Encode the message once and send it to all clients in concurrent batches using sendOneRaw().
    // This saves encoding cost for large broadcasts, but does not allow dynamically generated
    // client-specific information to be included.
    if (!message) return;
    const msgPacketStr = makeMessagePacket(message);
    const broadcasters = map(this._connections, (_, clientId) => async () =>
      await this.sendOneRaw(clientId, msgPacketStr)
    );

    return parallelLimit(broadcasters, BROADCAST_CONCURRENCY);
  }

  /**
   * Sends a JSON-serializable object to a single connected client if it is still connected.
   *
   * @param {string} clientId Client ID to send message to.
   * @param {object} message JSON-serializable message object.
   */
  sendOne(clientId, message) {
    assert(isObject(message), "message passed to sendOne() must be an object.");
    return this.sendOneRaw(clientId, makeMessagePacket(message));
  }

  /**
   * Sends a JSON-encoded string to a single connected client if it is still connected.
   *
   * @param {string} clientId Client ID to send message to.
   * @param {string} message JSON message.
   */
  sendOneRaw(clientId, message) {
    assert(
      isString(message),
      "message passed to sendOneRaw() must be a string."
    );
    const preview = message.substr(0, MESSAGE_PREVIEW_LENGTH);

    // Locate connection structure and retrieve socket.
    const connection = this._connections[clientId];
    if (!connection) {
      log.warn(
        `Cannot find client ${clientId}, outgoing message "${preview}" dropped.`
      );
      return;
    }

    // Send packet to client.
    const { socket } = connection;
    return new Promise(resolve => {
      socket.send(message, err => {
        if (err) {
          log.warn(
            `Cannot send message "${preview}" to client ${clientId}: ${err}`
          );
        }
        resolve();
      });
    });
  }

  /**
   * Gets the number of active connections.
   */
  getNumConnections() {
    return size(this._connections);
  }

  /**
   * Returns Websocket metrics.
   */
  getMetrics() {
    return Promise.resolve({
      numConnections: this.getNumConnections()
    });
  }
}

module.exports = WebSocketServer;
