const assert = require("assert");
const http = require("http");
const path = require("path");
const express = require("express");
const log = require("../../logging").getLogger();
const BaseServer = require("./BaseServer");

const TEMPLATES_ROOT = path.resolve(__dirname, "../templates");

class HttpServer extends BaseServer {
  async run() {
    this._app = express();
    this._httpServer = http.createServer(this._app);
  }

  getExpressApp() {
    return this._app;
  }

  getHttpServer() {
    return this._httpServer;
  }

  /**
   * Start listening on configured port and return actual listening port
   * (in case requested port was 0).
   */
  listen() {
    const { _app: app } = this;

    // Register view engine for fallback handlers.
    app.set("view engine", "pug");
    app.set("views", TEMPLATES_ROOT);

    // Register 404 handler last
    app.use((req, res) => {
      res.status(404);
      res.render("not-found", {
        url: req.url,
        headers: JSON.stringify(req.headers, null, 2)
      });
    });

    // Start listening on port.
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

  /**
   * Stops a listening server.
   */
  close() {
    return new Promise(resolve => this._httpServer.close(resolve));
  }

  getListenPort() {
    assert(this._port, "Server is not listening.");
    return this._port;
  }

  getListenUrl() {
    const urlRootPath = this._config.getCheckedKey("urlRootPath");
    const listenPort = this.getListenPort();
    return `http://localhost:${listenPort}${urlRootPath}`;
  }
}

module.exports = HttpServer;
