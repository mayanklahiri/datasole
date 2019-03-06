const os = require("os");
const crypto = require("crypto");

const { EventEmitter } = require("events");
const { forEach, size } = require("lodash");

const log = require("../util/logger").getLogger();
const { json } = require("../util");
const { applyOperations } = require("./operations");
const { parseMessagePacket, makeMessagePacket } = require("./protocol");

class LiveModelServer extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.connections = {};
    this.model = {};
    this.pollTimeout_ = setTimeout(this.poll.bind(this), 3000);
  }

  update(opList) {
    applyOperations(this.model, opList);
    this.broadcast({
      type: "apply",
      ops: opList
    });
  }

  setBackendPid(pid) {
    this.backendPid = pid;
  }

  clearBackendPid() {
    delete this.backendPid;
  }

  stop() {
    if (this.pollTimeout_) {
      clearTimeout(this.pollTimeout_);
      delete this.pollTimeout_;
    }
  }

  clearModel() {
    this.model = {};
  }

  poll() {
    this.broadcastServerMetrics();
    this.pollTimeout_ = setTimeout(this.poll.bind(this), 1000);
  }

  onConnection(socket) {
    const clientId = (socket.clientId = crypto.randomBytes(8).toString("hex"));
    socket.connectedAt = new Date().toISOString();
    this.connections[clientId] = socket;
    socket.once("close", this.onClose.bind(this, socket));
    socket.on("message", this.onMessage.bind(this, socket));

    // Set initial state to new client.
    this.send(clientId, {
      type: "apply",
      ops: [
        {
          type: "$clearAll"
        },
        {
          type: "$shallowAssign",
          value: this.model
        }
      ]
    });
  }

  onMessage(socket, msgStr) {
    let msgPayload;
    try {
      msgPayload = parseMessagePacket(msgStr);
    } catch (e) {
      log.warn(
        `Invalid client msg=${msgStr} from socket=${socket.clientId}`,
        e
      );
    }

    log.debug(
      `Received client msg=${json(msgPayload)} from socket=${socket.clientId}`
    );

    if (msgPayload.type === "rpc") {
      // TODO: invoke local function, return RPC result.
      setTimeout(
        () =>
          this.send(socket.clientId, {
            type: "rpc_response",
            rpcId: msgPayload.rpcId,
            error: "Not implemented."
          }),
        250
      );
      return;
    }
  }

  onClose(socket) {
    const { clientId } = socket;
    delete this.connections[clientId];
  }

  send(clientId, msg) {
    // Locate client.
    const socket = this.connections[clientId];
    if (!socket) {
      log.warn(`Cannot find client "${clientId}", message dropped.`);
      return;
    }

    // Assemble payload.
    let msgPayload;
    if (typeof msg === "string") {
      try {
        msgPayload = JSON.parse(msg);
      } catch (e) {
        throw new Error(
          `Any string passed to send() must be a JSON-encoded string, got ${e}`
        );
      }
    } else {
      msgPayload = msg;
    }

    // Send packet to client.
    try {
      socket.send(makeMessagePacket(msgPayload));
    } catch (e) {
      log.warn(`Cannot send message to client "${clientId}": ${e}`);
      return;
    }
  }

  broadcast(msg) {
    forEach(this.connections, ({ clientId }) => this.send(clientId, msg));
  }

  broadcastServerMetrics() {
    this.broadcast({
      type: "apply",
      ops: [
        {
          type: "$merge",
          keyPath: "$server",
          value: {
            metrics: {
              snapshotTime: new Date().toISOString(),
              freeMemPcnt: Math.round((100 * os.freemem()) / os.totalmem()),
              numConnections: size(this.connections)
            },
            info: {
              serverPid: process.pid,
              backendPid: this.backendPid,
              hostname: os.hostname(),
              userInfo: os.userInfo(),
              cwd: process.cwd()
            }
          }
        }
      ]
    });
  }
}

module.exports = { LiveModelServer };
