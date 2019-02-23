const crypto = require("crypto");
const WebSocket = require("ws");
const log = require("../logger").getLogger();
const { socksend } = require("../util");
const { forEach, values, map, orderBy } = require("lodash");

class WebSocketServer {
  constructor(config, httpServer) {
    this.config = config;
    this.httpServer = httpServer;
    this.connections = {};
    this.wsServer = new WebSocket.Server({
      path: "/__ws__",
      server: httpServer
    });
    this.wsServer.on("connection", this.onConnection.bind(this));
  }

  onConnection(socket) {
    const clientId = crypto.randomBytes(8).toString("hex");

    // Retrieve and save remote client identifiers.
    const remoteClient = {
      socket,
      clientId,
      connectedAt: new Date().toISOString()
    };
    this.connections[clientId] = remoteClient;
    setTimeout(() => this.broadcastServerConnections(), 50);

    // Register connection drop handlers.
    socket.once("close", () => {
      log.info(`Connection ${clientId} ended.`);
      delete this.connections[clientId];
      this.broadcastServerConnections();
    });
  }

  broadcastServerConnections() {
    this.broadcast([
      {
        type: "$set",
        keyPath: "serverInfo.connections",
        value: map(orderBy(values(this.connections), "clientId"), connObj => {
          return {
            clientId: connObj.clientId,
            connectedAt: connObj.connectedAt
          };
        })
      }
    ]);
  }

  broadcast(msg) {
    forEach(this.connections, ({ socket }) => {
      socksend(socket, msg);
    });
  }
}

function createWebsocketServer(config, httpServer) {
  return new WebSocketServer(config, httpServer);
}

module.exports = {
  createWebsocketServer
};
