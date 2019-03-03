const http = require("http");

const express = require("express");
const webpack = require("webpack");
const webpackDevMiddleware = require("webpack-dev-middleware");
const webpackHotMiddleware = require("webpack-hot-middleware");

const { generateWpConfig } = require("../webpack/generateWpConfig");
const log = require("../util/logger").getLogger();
const { appClientOutputPath } = require("../util/path-util");
const { prettyJson } = require("../util");

class ExpressServer {
  constructor(config) {
    const {
      server: { urlRootPath },
      paths: { appPath }
    } = (this.config = config);

    // Create Webpack instance.
    const wpConfig = (this.wpConfig = generateWpConfig(config));
    log.debug(`Webpack config: ${prettyJson(wpConfig)}`);
    const compiler = (this.compiler = webpack(wpConfig));

    // Create Express app.
    const app = (this.app = express());

    // Serve Webpack artifacts if in development mode.
    if (config.mode === "development") {
      app.use(
        webpackDevMiddleware(compiler, {
          publicPath: urlRootPath,
          logLevel: "warn"
        })
      );
      app.use(webpackHotMiddleware(compiler));
    } else {
      // Serve build distribution if in production mode.
      const distPath = appClientOutputPath(appPath);
      log.info(
        `Serving static distribution at "${urlRootPath}" from ${distPath}`
      );
      app.use(urlRootPath, express.static(distPath));
    }

    // Create HTTP server.
    this.httpServer = http.createServer(app);

    // Redirect 404s to root.
    app.use((_, res) => res.redirect(urlRootPath));
  }

  /**
   * Start serving.
   */
  listen() {
    return new Promise((resolve, reject) => {
      // Start serving.
      const devServerPort = this.config.server.port || 0;
      log.debug(`Starting dev server on port ${devServerPort}...`);
      this.httpServer.listen(devServerPort, err => {
        if (err) {
          log.error(`Cannot listen on port ${devServerPort}: ${err}`);
          return reject(err);
        }
        const port = this.httpServer.address().port;
        resolve({ port });
      });
    });
  }

  /**
   * Return server object.
   */
  getHttpServer() {
    return this.httpServer;
  }

  /**
   * Return Express app.
   */
  getApp() {
    return this.app;
  }

  /**
   * Get config.
   */
  getConfig() {
    return this.config;
  }
}

function createExpressServer(config) {
  return new ExpressServer(config);
}

module.exports = {
  createExpressServer
};
