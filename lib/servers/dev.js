const http = require("http");

const express = require("express");
const webpack = require("webpack");
const webpackDevMiddleware = require("webpack-dev-middleware");
const webpackHotMiddleware = require("webpack-hot-middleware");

const { generateWpConfig } = require("../webpack/generateWpConfig");
const log = require("../logger").getLogger();
const { clientAppStaticPath } = require("../pathutil");
const { prettyJson } = require("../util");

class DevServer {
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

    // Serve Webpack artifacts.
    app.use(
      webpackDevMiddleware(compiler, {
        publicPath: urlRootPath
      })
    );
    app.use(webpackHotMiddleware(compiler));

    // Serve static assets.
    const staticAssetsPath = clientAppStaticPath(appPath);
    log.debug(
      `Serving static assets at "${urlRootPath}" from: ${staticAssetsPath}`
    );
    app.use(urlRootPath, express.static(staticAssetsPath));

    // Create HTTP server.
    this.server = http.createServer(app);
  }

  /**
   * Start serving.
   */
  listen() {
    return new Promise((resolve, reject) => {
      // Start serving.
      const devServerPort = this.config.server.port || 0;
      log.debug(`Starting dev server on port ${devServerPort}...`);
      this.server.listen(devServerPort, err => {
        if (err) {
          log.error(`Cannot listen on port ${devServerPort}: ${err}`);
          return reject(err);
        }
        const listenPort = this.server.address().port;
        resolve({ listenPort });
      });
    });
  }

  /**
   * Return server object.
   */
  getServer() {
    return this.server;
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

function createDevServer(config) {
  return new DevServer(config);
}

module.exports = {
  createDevServer
};
