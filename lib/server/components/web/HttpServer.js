const assert = require("assert");
const bodyParser = require("body-parser");
const colors = require("colors");
const cookieParser = require("cookie-parser");
const http = require("http");
const path = require("path");
const express = require("express");
const log = require("../../../logging").getLogger();
const BaseServer = require("../BaseServer");
const { urlJoin } = require("../../../util/url-join");
const { makeApiRequestFromExpressRequest } = require("../../../protocol/api");

const TEMPLATES_ROOT = path.resolve(__dirname, "templates");

class HttpServer extends BaseServer {
  /**
   * Service entry point.
   */
  async run() {
    const config = this._config;

    this._app = express();
    this._httpServer = http.createServer(this._app);

    const port = config.getRequiredIntKey("port");
    const urlRootPath = config.getRequiredStringKey("urlRootPath");
    const listenAddress = config.getRequiredStringKey("listenAddress");
    const builtinTemplatePath = config.getOptionalStringKey(
      "builtinTemplatePath"
    );
    const apiUrl = config.getRequiredStringKey("apiUrl");
    const apiTimeoutSec = config.getRequiredIntKey("apiTimeoutSec");
    const staticPath = config.getOptionalStringKey("staticPath");
    const staticUrl = config.getOptionalStringKey("staticUrl");
    const staticEnabled = !!staticPath;
    const wsUrl = urlJoin(
      urlRootPath,
      config.getRequiredStringKey("websocketPath")
    );

    this.config = {
      apiTimeoutSec,
      apiUrl,
      port,
      urlRootPath,
      listenAddress,
      staticEnabled,
      staticPath,
      staticUrl,
      builtinTemplatePath: builtinTemplatePath || TEMPLATES_ROOT,
      wsUrl
    };
  }

  /**
   * Start listening on configured port and return actual listening port
   * (in case requested port was 0).
   */
  listen() {
    const { apiUrl, port, listenAddress, urlRootPath } = this.config;

    // Register API handler if 'apiUrl' is set.
    if (apiUrl) {
      this.registerApiHandler();
    }

    // Register fallback handlers immediately before listening.
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
            `HTTP server is listening on port ${colors.bold(
              this._port
            )} at path ${colors.bold(urlRootPath)}`
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
   * Register the API handler.
   */
  registerApiHandler() {
    const { _app: app } = this;
    const { apiUrl, urlRootPath, apiTimeoutSec } = this.config;
    const apiUrlPrefix = urlJoin(urlRootPath, apiUrl);
    log.info(`Serving API at path "${apiUrlPrefix}"`);

    // Extra middleware for API handling.
    app.use(cookieParser());
    app.use(bodyParser.json());

    // Main API handler.
    app.use(async (req, res, next) => {
      const normUrl = req.url;
      const normPrefix = normUrl.substr(0, apiUrlPrefix.length);
      if (normPrefix !== apiUrlPrefix) {
        return next();
      }
      this.incrementMetric("api_requests", 1);
      try {
        const apiRequest = makeApiRequestFromExpressRequest(req, apiUrlPrefix);
        const apiResponse = await this.apiDispatchAndWait(
          apiRequest,
          apiTimeoutSec
        );
        return res
          .status(apiResponse.statusCode)
          .set(apiResponse.headers)
          .send(apiResponse.body);
      } catch (e) {
        log.error(
          `Internal error servicing API request for ${req.path}: ${e}`,
          e
        );
        res.status(500).send({
          error: e.message,
          statusCode: 500
        });
      }
    });
  }

  /**
   * Emit an "api_request" event and wait for a response or a timeout to occur.
   */
  apiDispatchAndWait(apiRequest, apiTimeoutSec) {
    const { reqId } = apiRequest;
    this._apiWaiters = this._apiWaiters || {};
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const waiter = this._apiWaiters[reqId];
        if (waiter) {
          delete this._apiWaiters[reqId];
          return reject(
            new Error(`API request timed out after ${apiTimeoutSec} seconds.`)
          );
        }
        delete this._apiWaiters[reqId];
      }, apiTimeoutSec * 1000);
      this._apiWaiters[reqId] = [resolve, reject, timeout];
      log.debug(
        `Dispatching API request ${JSON.stringify(apiRequest, null, 2)}`
      );
      this.emit("api_request", apiRequest);
    });
  }

  /**
   * Asynchronously triggers an HTTP response to a request that has not
   * timed out.
   *
   * @param {object} apiResponse ApiResponse object.
   */
  acceptApiResponse(apiResponse) {
    const { reqId } = apiResponse;
    this._apiWaiters = this._apiWaiters || {};
    const waiter = this._apiWaiters[reqId];
    if (waiter) {
      const [resolve, _, timeout] = waiter;
      clearTimeout(timeout);
      delete this._apiWaiters[reqId];
      return resolve(apiResponse);
    }
    log.warn(`Dropping API response for unknown request "${reqId}".`);
  }

  /**
   * Register fallback handlers.
   */
  registerFallbackHandlers() {
    const { _app: app } = this;
    const { builtinTemplatePath } = this.config;

    // Register view engine for rendering HTML templates for fallback handlers.
    app.set("view engine", "pug");
    app.set("views", builtinTemplatePath);

    // Register static web distribution.
    this.registerStaticServer();

    // Register 404 handler at end of request chain.
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

  getLocalServerRoot(urlSuffix, proto = "http") {
    const urlPath = urlJoin(urlSuffix);
    const listenPort = this.getListenPort();
    return `${proto}://localhost:${listenPort}${urlPath}`;
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

  getWebsocketPath(pathSuffix) {
    const { wsUrl } = this.config;
    return urlJoin(wsUrl, pathSuffix);
  }

  getWebsocketLocalEndpoint(pathSuffix) {
    return this.getLocalServerRoot(this.getWebsocketPath(pathSuffix), "ws");
  }
}

module.exports = HttpServer;
