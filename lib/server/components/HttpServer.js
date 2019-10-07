const assert = require("assert");
const colors = require("colors");
const http = require("http");
const path = require("path");
const express = require("express");
const log = require("../../logging").getLogger();
const BaseServer = require("./BaseServer");
const { urlJoin } = require("../../util/url-join");

const TEMPLATES_ROOT = path.resolve(__dirname, "../templates");

class HttpServer extends BaseServer {
  async run() {
    this.refreshConfig(this._config);
    this._app = express();
    this._httpServer = http.createServer(this._app);
  }

  refreshConfig(config) {
    const port = config.getRequiredIntKey("port");
    const urlRootPath = config.getRequiredStringKey("urlRootPath");
    const listenAddress = config.getRequiredStringKey("listenAddress");

    const builtinTemplatePath = config.getOptionalStringKey(
      "builtinTemplatePath"
    );
    const staticPath = config.getOptionalStringKey("staticPath");
    const staticUrl = config.getOptionalStringKey("staticUrl");
    const staticEnabled = !!staticPath;

    this.config = {
      port,
      urlRootPath,
      listenAddress,
      staticEnabled,
      staticPath,
      staticUrl,
      builtinTemplatePath: builtinTemplatePath || TEMPLATES_ROOT
    };
  }

  /**
   * Start listening on configured port and return actual listening port
   * (in case requested port was 0).
   */
  listen() {
    const { port, listenAddress, urlRootPath } = this.config;

    // Register fallback handlers.
    this.registerFallbackHandlers();

    // Start listening on port.
    return new Promise((resolve, reject) => {
      log.debug(`HTTP server is starting on port ${port}...`);
      this._httpServer.listen(port, listenAddress, err => {
        if (err) {
          log.error(`Cannot listen on port ${port}: ${err}`);
          return reject(err);
        }
        this._address = this._httpServer.address().address;
        this._port = this._httpServer.address().port;
        log.info(
          colors.green(
            `HTTP server is listening on port ${
              this._port
            } at path: ${urlRootPath}`
          )
        );
        resolve({
          port: this._port,
          address: this._address
        });
      });
    });
  }

  /**
   * Register fallback handlers.
   */
  registerFallbackHandlers() {
    const { _app: app } = this;
    const { builtinTemplatePath } = this.config;

    // Register view engine for fallback handlers.
    app.set("view engine", "pug");
    app.set("views", builtinTemplatePath);

    // Register static web distribution.
    this.registerStaticServer();

    // Register 404 handler last
    this.registerFinal404Handler();
  }

  /**
   * Optionally create a static web server.
   */
  registerStaticServer() {
    const { staticEnabled, urlRootPath, staticPath, staticUrl } = this.config;
    if (!staticEnabled) return;
    const { _app: app } = this;
    const staticAbsPath = urlJoin(urlRootPath, staticUrl);
    log.warn(
      `Serving directory "${staticPath}" at URL path "${staticAbsPath}"`
    );
    app.use(staticAbsPath, express.static(staticPath));
  }

  /**
   * Register the final 404 handler.
   */
  registerFinal404Handler() {
    const { _app: app, _config: config } = this;
    app.use((req, res) => {
      res.status(404);
      res.render("not-found", {
        url: req.url,
        headers: JSON.stringify(req.headers, null, 2),
        mode: config.getMode()
      });
    });
  }

  /**
   * Stops a listening server.
   */
  close() {
    return new Promise(resolve => this._httpServer.close(resolve));
  }

  getListenAddress() {
    assert(this._address, "Server is not listening.");
    return this._address;
  }

  getListenPort() {
    assert(this._port, "Server is not listening.");
    return this._port;
  }

  getLocalUrl(urlSuffix) {
    const urlPath = this.getUrlPath(urlSuffix);
    const listenPort = this.getListenPort();
    return `http://localhost:${listenPort}${urlPath}`;
  }

  getLocalServerRoot(urlSuffix) {
    const urlPath = urlJoin(urlSuffix);
    const listenPort = this.getListenPort();
    return `http://localhost:${listenPort}${urlPath}`;
  }

  getUrlPath(...suffixes) {
    const { urlRootPath } = this.config;
    return urlJoin(urlRootPath, ...suffixes);
  }

  getExpressApp() {
    return this._app;
  }

  getHttpServer() {
    return this._httpServer;
  }

  getStaticPath(pathSuffix) {
    const { staticUrl } = this.config;
    return this.getUrlPath(staticUrl, pathSuffix);
  }
}

module.exports = HttpServer;
