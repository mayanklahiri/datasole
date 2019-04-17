const WebSocket = require("ws");

class WebSocketServer {
  constructor(config, httpServer, liveModelServer) {
    this.config = config;
    this.httpServer = httpServer;
    this.liveModelServer = liveModelServer;
    const wsPath = config.server.urlRootPath + config.server.urlWsRelPath;
    this.wsServer = new WebSocket.Server({
      path: wsPath,
      server: httpServer,
      perMessageDeflate: true
    });
    this.wsServer.on(
      "connection",
      liveModelServer.onConnection.bind(liveModelServer)
    );
  }

  getLiveModelServer() {
    return this.liveModelServer;
  }
}

function createWebsocketServer(config, httpServer, liveModelServer) {
  return new WebSocketServer(config, httpServer, liveModelServer);
}

module.exports = {
  createWebsocketServer
};
