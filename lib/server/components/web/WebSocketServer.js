const { STATUS_CODES } = require("http");
const assert = require("assert");

const WebSocket = require("ws");
const { parallelLimit } = require("async");
const {
  size,
  map,
  forEach,
  isObject,
  isUndefined,
  isString
} = require("lodash");

const BaseServer = require("../BaseServer");
const log = require("../../../logging").getLogger();
const mutations = require("../../../live-model/mutations");
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
 * Minimum WebSocket auth filter timeout value, in milliseconds.
 */
const MIN_WS_AUTH_TIMEOUT_MS = 10;

/**
 * Adds a WebSocket endpoint to an Express server.
 */
class WebSocketServer extends BaseServer {
  constructor(...args) {
    super(...args);
    this._connections = {};
    this._pendingAuthRequests = {};
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
    const urlWsRelPath = config.getRequiredStringKey("websocketPath");
    const urlRootPath = config.getRequiredStringKey("urlRootPath");
    const wsPath = urlJoin(urlRootPath, urlWsRelPath);
    const apiUrl = config.getKey("apiUrl")
      ? urlJoin(urlRootPath, config.getKey("apiUrl"))
      : undefined;
    const websocketAuth = config.getCheckedKey("websocketAuth");
    const websocketAuthTimeoutMs = Math.max(
      1000,
      config.getRequiredIntKey("websocketAuthTimeoutMs")
    );

    this.config = {
      urlRootPath,
      wsPath,
      websocketAuth,
      websocketAuthTimeoutMs
    };

    // Create an instance of 'ws.Server'.
    this._wsServer = new WebSocket.Server({
      path: wsPath,
      noServer: true,
      perMessageDeflate: true
    });

    // Listen for HTTP upgrade events to insert WebSocket authentication handlers.
    httpServer.getHttpServer().on("upgrade", this.onUpgrade.bind(this));

    // Listen for WebSocket connections.
    this._wsServer.on("connection", this.onConnection.bind(this));

    // Watch for LiveModel send events.
    liveModelServer.on("mutations", opList =>
      this.broadcast(makeApplyOperation(opList))
    );
    liveModelServer.mutate([
      mutations.setKeyPath("$server.config", {
        apiUrl,
        urlRootPath,
        wsPath
      })
    ]);
  }

  /**
   * Shuts down the WebSocket server.
   */
  async close() {
    // Close all pending connections.
    forEach(this._pendingAuthRequests, ({ socket }) => socket.destroy());

    // Shut down server.
    try {
      this._wsServer.close();
    } catch (e) {
      log.warn(`Cannot shutdown WebSocket server cleanly: ${e}`);
    }
  }

  /**
   * HTTP Upgrade request to WebSocket received, execute AuthFilter if specified..
   */
  async onUpgrade(request, socket, head) {
    const { websocketAuth, websocketAuthTimeoutMs } = this.config;

    // Create client ID and pendingRequest.
    const clientId = makeId();
    const pendingRequest = (this._pendingAuthRequests[clientId] = {
      clientId,
      request,
      socket,
      head
    });

    // Toothless mode for WebSockets.
    if (!websocketAuth) {
      log.debug(`WebSocket for client ${clientId} authorized.`);
      return this.authorizeWebsocket(clientId);
    }

    // WebSocket authentication enabled.

    // Create ws_auth_request
    try {
      const wsAuthRequest = (pendingRequest.wsAuthRequest = makeWsAuthRequest(
        request,
        clientId
      ));
      log.debug(
        `Authenticating WebSocket client ${clientId} from ${
          wsAuthRequest.remoteIp
        }`
      );
    } catch (wsAuthError) {
      log.warn(`Cannot authenticate WebSocket client: ${wsAuthError}`);
      return this.rejectWebsocket(clientId, wsAuthError);
    }

    // Set authorization timeout handler.
    const startTimeMs = Date.now();
    pendingRequest.timeout = setTimeout(() => {
      const error = new Error(`WebSocket authentication timed out.`);
      error.code = 503;
      const deltaMs = Date.now() - startTimeMs;
      log.warn(`Socket auth check timed out after ${deltaMs} ms: ${error}`);
      this.rejectWebsocket(clientId, error);
    }, Math.max(MIN_WS_AUTH_TIMEOUT_MS, websocketAuthTimeoutMs));

    // Decouple response handling by emitting an event.
    log.debug("Emitting ws_auth_request");
    this.emit("ws_auth_request", pendingRequest.wsAuthRequest);
  }

  /**
   * Authorize an HTTP upgrade request.
   */
  async authorizeWebsocket(clientId) {
    assert(
      isString(clientId) && clientId,
      `Client ID must be provided as a string.`
    );
    const { _wsServer: wsServer } = this;
    const pendingRequest = this._pendingAuthRequests[clientId];
    if (pendingRequest) {
      const { socket, request, head, timeout } = pendingRequest;
      clearTimeout(timeout);
      delete this._pendingAuthRequests[clientId];
      wsServer.handleUpgrade(request, socket, head, ws => {
        wsServer.emit("connection", ws, request);
      });
    } else {
      log.warn(
        `Cannot authorize unknown WebSocket client "${clientId}", ignoring authorizeWebsocket() call.`
      );
      return;
    }
  }

  /**
   * Refuse an HTTP upgrade request.
   */
  async rejectWebsocket(clientId, wsAuthError) {
    assert(
      isString(clientId) && clientId,
      `Client ID must be provided as a string.`
    );
    const pendingRequest = this._pendingAuthRequests[clientId];
    if (pendingRequest) {
      const {
        wsAuthRequest: { remoteIp },
        socket,
        timeout
      } = pendingRequest;

      log.warn(
        `Refusing unauthorized WebSocket connection for client "${clientId}" from ${remoteIp}`
      );

      if (timeout) clearTimeout(timeout);
      delete this._pendingAuthRequests[clientId];

      if (socket.writable) {
        const content = JSON.stringify(wsAuthError);
        const resp = [
          `HTTP/1.1 ${wsAuthError.code} ${STATUS_CODES[wsAuthError.code]}`,
          "Content-Type: application/json",
          "Content-Length: " + content.length,
          "Connection: close",
          "",
          content,
          ""
        ].join("\n");

        try {
          await new Promise((resolve, reject) =>
            socket.end(resp, (err, result) =>
              err ? reject(err) : resolve(result)
            )
          );
        } catch (e) {
          log.warn(`Cannot reject WebSocket: ${e}, ignoring.`);
        }
      }
    } else {
      log.warn(
        `Cannot deny authorization to unknown WebSocket client "${clientId}", ignoring rejectWebsocket() call.`
      );
      return;
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
        log.error(`Cannot terminate connection: ${e}`);
      }
      delete this._connections[clientId];
      log.debug(`Client "${clientId}" disconnected.`);
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
   * Returns Websocket metrics.
   */
  getMetrics() {
    return Promise.resolve({
      numConnections: size(this._connections)
    });
  }
}

module.exports = WebSocketServer;
