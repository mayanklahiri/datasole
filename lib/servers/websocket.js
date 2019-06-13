const assert = require("assert");
const crypto = require("crypto");

const WebSocket = require("ws");
const { parallelLimit } = require("async");
const { size, get, map, isObject, isUndefined, isString } = require("lodash");

const BaseServer = require("./base");
const {
  parseMessagePacket,
  makeMessagePacket,
  makeApplyOperation
} = require("../live-model/protocol");

const CLIENT_ID_LENGTH_BYTES = 8;
const BROADCAST_CONCURRENCY = 10;
const MESSAGE_PREVIEW_LENGTH = 50;

class WebSocketServer extends BaseServer {
  /**
   * Service entry point.
   */
  async run() {
    const { _config: config } = this;

    // Websocket endpoint configuration options.
    const urlRootPath = config.getCheckedKey("urlRootPath");
    const urlWsRelPath = config.getCheckedKey("websocketPath");
    const wsPath = `${urlRootPath}${urlWsRelPath}`;
    const httpServer = this._svcDeps.http.getHttpServer();

    // Create an instance of 'ws.Server'.
    this._wsServer = new WebSocket.Server({
      path: wsPath,
      server: httpServer,
      perMessageDeflate: true
    });

    // Maintain a mapping of all current connections.
    this._connections = {};
    this._wsServer.on("connection", this.onConnection.bind(this));

    // Watch for LiveModel send events.
    const { liveModel } = this._svcDeps;
    liveModel.on("broadcast", (...args) => this.broadcast(...args));

    return Promise.resolve();
  }

  /**
   * New Websocket client connected.
   *
   * @param {*} socket 'ws.Socket' instance
   * @param {*} req HTTP request for Websocket
   */
  onConnection(socket, req) {
    // Generate a unique globally unique client ID.
    const clientId = crypto.randomBytes(CLIENT_ID_LENGTH_BYTES).toString("hex");

    // Collect connection metadata.
    const connectedAt = new Date().toISOString();
    const remoteIp = this.getRemoteIp(req);

    // Save connection indexed by client ID.
    this._connections[clientId] = {
      connectedAt,
      remoteIp,
      socket,
      req
    };

    const { log } = this._context;
    log.debug(`Client "${clientId}" connected from IP "${remoteIp}"`);

    // Listen for socket events.
    socket.once("close", this.onClose.bind(this, clientId));
    socket.on("message", this.onMessage.bind(this, clientId));

    // Send the current state to the client.
    this.sendStateRefresh(clientId);
  }

  /**
   * Heuristics for extracting a remote client IP.
   * @param {object} req Underlying Express request object for the Websocket.
   */
  getRemoteIp(req) {
    return (
      get(req.headers, "x-forwarded-for") ||
      get(req.connection, "remoteAddress") ||
      "UNKNOWN-IP"
    );
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
        value: this._svcDeps.liveModel.getModelUnsafe()
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
    if (!message) return Promise.resolve();
    const msgPacketStr = makeMessagePacket(message);
    const broadcasters = map(this._connections, (_, clientId) => async () =>
      await this.sendOneRaw(clientId, msgPacketStr)
    );

    await parallelLimit(broadcasters, BROADCAST_CONCURRENCY);
    return Promise.resolve();
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
    const { log } = this._context;

    // Locate connection structure and retrieve socket.
    const connection = this._connections[clientId];
    if (!connection) {
      log.warn(
        `Cannot find client ${clientId}, outgoing message "${preview}" dropped.`
      );
      return Promise.resolve();
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
   * Handler for an incoming client message.
   *
   * @param {string} clientId Client ID of client that sent this message.
   * @param {string} msgStr Raw message string.
   */
  onMessage(clientId, msgStr) {
    const { log } = this._context;

    // Locate connection, do not parse queued messages from dropped connections.
    const connection = this._connections[clientId];
    if (!connection) {
      log.debug(
        `Dropping queued incoming message from dropped client ${clientId}.`
      );
      return Promise.resolve();
    }

    // Parse the message payload.
    let payload;
    try {
      payload = parseMessagePacket(msgStr);
    } catch (e) {
      log.warn(`Invalid message from client ${clientId}, dropping: ${e}`);
      log.debug(e);
      return Promise.resolve();
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
    const { log } = this._context;
    delete this._connections[clientId];
    log.debug(`Client ${clientId} dropped.`);
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
