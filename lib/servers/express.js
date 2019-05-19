const path = require("path");

const colors = require("colors");
const express = require("express");

const BaseServer = require("./base");
const { appClientDistPath } = require("../util/path-util");
const { writeToTempSync } = require("../util/fs-util");

class ExpressServer extends BaseServer {
  /**
   * Service entry point.
   */
  async run() {
    // Extract config properties
    const {
      mode,
      server: { urlRootPath, watchPollTimeMs }
    } = this._config;

    // Create Express app.
    const app = (this._app = express());

    // Depending on the mode, load either Webpack (with dev-server) or express.static
    if (mode === "production") {
      this.createStaticServer();
    } else {
      await this.createWebpackServer(urlRootPath, watchPollTimeMs);
    }

    // Redirect 404s to root by having the 404 handler be last in the request chain.
    app.use((_, res) => res.redirect(urlRootPath));

    return Promise.resolve();
  }

  getApp() {
    return this._app;
  }

  /**
   * Creates an auto-refreshing development server based on webpack-dev-middleware.
   */
  createWebpackServer(urlRootPath, watchPollTimeMs) {
    // require() webpack here so as to only load it (and its plugins) when necessary.
    const webpack = require("webpack");
    const webpackDevMiddleware = require("webpack-dev-middleware");
    const webpackHotMiddleware = require("webpack-hot-middleware");
    const { generateWpConfig } = require("../webpack/generateWpConfig");
    const { log } = this._context;

    // Create Webpack instance in non-production (development) mode.
    const wpConfig = (this._wpConfig = generateWpConfig(this._config));
    const wpConfigOutPath = writeToTempSync(
      "webpack.config.json",
      JSON.stringify(wpConfig, null, 2)
    );
    log.debug(
      colors.yellow(`Webpack configuration written to ${wpConfigOutPath}`)
    );
    const compiler = (this._compiler = webpack(wpConfig));

    // Put webpack-dev-middleware and webpack-hot-middleware into the Express request chain.
    const { _app: app } = this;
    const devMiddleware = webpackDevMiddleware(compiler, {
      publicPath: urlRootPath,
      logLevel: "warn",
      watchOptions: {
        poll: watchPollTimeMs
      }
    });
    app.use(devMiddleware);
    app.use(webpackHotMiddleware(compiler));

    log.info("Waiting for Webpack bundle to become valid...");
    return new Promise(resolve => devMiddleware.waitUntilValid(resolve));
  }

  /**
   * Creates a simple static file server.
   */
  createStaticServer() {
    const {
      server: { urlRootPath },
      paths: { appPath }
    } = this._config;
    const { log } = this._context;
    const { _app: app } = this;

    // Serve build distribution if in production mode.
    const distPath = appClientDistPath(appPath);
    log.info(
      `Serving static distribution at "${urlRootPath}" from ${distPath}`
    );
    app.use(urlRootPath, express.static(distPath));

    // Add a worst-case fallback in case there is no production distribution.
    app.use(urlRootPath, express.static(path.join(__dirname, "no-prod-build")));
  }
}

module.exports = ExpressServer;
