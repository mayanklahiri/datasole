const http = require("http");
const BaseServer = require("./base");

class HttpServer extends BaseServer {
  async run() {
    // Create HTTP server to serve Express app.
    const app = this._svcDeps.express.getApp();
    this._httpServer = http.createServer(app);
    return Promise.resolve();
  }

  getHttpServer() {
    return this._httpServer;
  }

  /**
   * Start listening on configured port and return actual listening port
   * (in case requested port was 0).
   */
  listen() {
    const { log } = this._context;
    const port = this._config.getCheckedKey("port");
    return new Promise((resolve, reject) => {
      log.info(`Starting HTTP server on port ${port}...`);
      this._httpServer.listen(port, err => {
        if (err) {
          log.error(`Cannot listen on port ${port}: ${err}`);
          return reject(err);
        }
        const port = (this._port = this._httpServer.address().port);
        resolve({ port });
      });
    });
  }

  getListenUrl() {
    const urlRootPath = this._config.getCheckedKey("urlRootPath");
    return `http://localhost:${this._port}${urlRootPath}`;
  }
}

module.exports = HttpServer;
