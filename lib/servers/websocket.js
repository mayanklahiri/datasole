const WebSocket = require("ws");

const log = require("../util/logger").getLogger();

class WebSocketServer {
  constructor(config, httpServer, liveModelServer) {
    this.config = config;
    this.httpServer = httpServer;
    this.liveModelServer = liveModelServer;
    const wsPath = config.server.urlRootPath + config.server.urlWsRelPath;
    log.debug(`WebSocket path is ${wsPath}`);
    this.wsServer = new WebSocket.Server({
      path: wsPath,
      server: httpServer,
      perMessageDeflate: {
        zlibDeflateOptions: {
          // See zlib defaults.
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        // Other options settable:
        clientNoContextTakeover: true, // Defaults to negotiated value.
        serverNoContextTakeover: true, // Defaults to negotiated value.
        serverMaxWindowBits: 10, // Defaults to negotiated value.
        // Below options specified as default values.
        concurrencyLimit: 10, // Limits zlib concurrency for perf.
        threshold: 1024 // Size (in bytes) below which messages
        // should not be compressed.
      }
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
