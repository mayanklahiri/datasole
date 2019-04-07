const http = require("http");

const express = require("express");
const webpack = require("webpack");
const webpackDevMiddleware = require("webpack-dev-middleware");
const webpackHotMiddleware = require("webpack-hot-middleware");

const { generateWpConfig } = require("../webpack/generateWpConfig");
const log = require("../util/logger").getLogger();
const { appClientDistPath } = require("../util/path-util");
const { prettyJson } = require("../util");

class ExpressServer {
  constructor(config, options) {
    this.config = config;
    const { production } = (this.options = options);
    const {
      server: { urlRootPath }
    } = config;

    // Create Express app.
    const app = (this.app = express());

    if (production) {
      this.configureProdMode();
    } else {
      this.configureDevMode();
    }

    // Create HTTP server to server Express app.
    this.httpServer = http.createServer(app);

    // Redirect 404s to root by having the 404 handler be last in the request chain.
    app.use((_, res) => res.redirect(urlRootPath));
  }

  configureDevMode() {
    const { app, config } = this;
    const {
      server: { urlRootPath }
    } = config;

    // Create Webpack instance in non-production (development) mode.
    const wpConfig = (this.wpConfig = generateWpConfig(config));
    log.debug(`Webpack config: ${prettyJson(wpConfig)}`);
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
    const { app, config } = this;
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
  }

  /**
   * Start serving.
   */
  listen() {
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
