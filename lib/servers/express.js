const http = require("http");
const path = require("path");

const colors = require("colors");
const express = require("express");
const webpack = require("webpack");
const webpackDevMiddleware = require("webpack-dev-middleware");
const webpackHotMiddleware = require("webpack-hot-middleware");

const { generateWpConfig } = require("../webpack/generateWpConfig");
const { appClientDistPath } = require("../util/path-util");
const { writeToTempSync } = require("../util/fs-util");

class ExpressServer {
  constructor(config, options) {
    this.config = config;
    const {
      server: { urlRootPath }
    } = config;
    this.log = require("../logging").getLogger();

    // Create Express app.
    const app = (this.app = express());

    if (config.mode === "production") {
      this.configureProdMode(options);
    } else {
      this.configureDevMode();
    }

    // Create HTTP server to server Express app.
    this.httpServer = http.createServer(app);

    // Redirect 404s to root by having the 404 handler be last in the request chain.
    app.use((_, res) => res.redirect(urlRootPath));
  }

  configureDevMode(options) {
    const { app, log, config } = this;
    const {
      server: { urlRootPath }
    } = config;

    // Create Webpack instance in non-production (development) mode.
    const wpConfig = (this.wpConfig = generateWpConfig(config, options));
    const wpConfigOutPath = writeToTempSync(
      "webpack.config.json",
      JSON.stringify(wpConfig, null, 2)
    );
    log.debug(
      colors.yellow(`Webpack configuration written to ${wpConfigOutPath}`)
    );
    const compiler = (this.compiler = webpack(wpConfig));

    // Put webpack-dev-middleware and webpack-hot-middleware into the Express request chain.
    app.use(
      webpackDevMiddleware(compiler, {
        publicPath: urlRootPath,
        logLevel: "warn",
        watchOptions: {
          poll: 3000
        }
      })
    );
    app.use(webpackHotMiddleware(compiler));
  }

  configureProdMode() {
    const { app, log, config } = this;
    const {
      server: { urlRootPath },
      paths: { appPath }
    } = config;

    // Serve build distribution if in production mode.
    const distPath = appClientDistPath(appPath);
    log.info(
      `Serving static distribution at "${urlRootPath}" from ${distPath}`
    );
    app.use(urlRootPath, express.static(distPath));

    // Add a worst-case fallback in case there is no production distribution.
    app.use(urlRootPath, express.static(path.join(__dirname, "no-prod-build")));
  }

  /**
   * Start serving.
   */
  listen() {
    const { log } = this;
    return new Promise((resolve, reject) => {
      const devServerPort = this.config.server.port || 0;
      log.debug(`Starting webserver on port ${devServerPort}...`);
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

function createExpressServer(config, options) {
  return new ExpressServer(config, options);
}

module.exports = {
  createExpressServer
};
