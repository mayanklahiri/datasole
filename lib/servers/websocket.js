const WebSocket = require("ws");

const log = require("../logger").getLogger();
const { LiveModelServer } = require("../live-model/server");

class WebSocketServer {
  constructor(config, httpServer) {
    this.config = config;
    this.httpServer = httpServer;
    const liveModelServer = (this.liveModelServer = new LiveModelServer(
      config
    ));
    const wsPath = config.server.urlRootPath + config.server.urlWsRelPath;
    log.debug(`WebSocket path is ${wsPath}`);
    this.wsServer = new WebSocket.Server({
      path: wsPath,
      server: httpServer
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

function createWebsocketServer(config, httpServer) {
  return new WebSocketServer(config, httpServer);
}

module.exports = {
  createWebsocketServer
};
