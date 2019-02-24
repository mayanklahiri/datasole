const os = require("os");
const crypto = require("crypto");

const { EventEmitter } = require("events");
const { forEach, size } = require("lodash");

const log = require("../logger").getLogger();
const { json } = require("../util");

class LiveModelServer extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.connections = {};
    this.pollTimeout_ = setTimeout(this.poll.bind(this), 3000);
  }

  stop() {
    if (this.pollTimeout_) {
      clearTimeout(this.pollTimeout_);
      delete this.pollTimeout_;
    }
  }

  poll() {
    this.broadcastServerConnections();
    this.pollTimeout_ = setTimeout(this.poll.bind(this), 3000);
  }

  onConnection(socket) {
    socket.clientId = crypto.randomBytes(8).toString("hex");
    socket.connectedAt = new Date().toISOString();
    this.connections[socket.clientId] = socket;
    socket.once("close", this.onClose.bind(this, socket));
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

    // Create message packet.
    const msgPacket = {
      v: 1
    };
    if (typeof msg === "string") {
      try {
        JSON.parse(msg);
      } catch (e) {
        throw new Error(
          `Any string passed to send() must be a JSON-encoded string, got ${e}`
        );
      }
      msgPacket.payload = msg;
    } else {
      msgPacket.payload = json(msg);
    }

    // Send packet to client.
    try {
      socket.send(json(msgPacket));
    } catch (e) {
      log.warn(`Cannot send message to client "${clientId}": ${e}`);
      return;
    }
  }

  broadcast(msg) {
    forEach(this.connections, ({ clientId }) => this.send(clientId, msg));
  }

  broadcastServerConnections() {
    this.broadcast([
      {
        type: "$set",
        keyPath: "$server",
        value: {
          metrics: {
            snapshotTime: new Date().toISOString(),
            freeMem: os.freemem(),
            totalMem: os.totalmem(),
            numConnections: size(this.connections)
          },
          meta: {
            pid: process.pid
          }
        }
      }
    ]);
  }
}

module.exports = { LiveModelServer };
