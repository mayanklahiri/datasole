const express = require("express");
const webpack = require("webpack");
const webpackDevMiddleware = require("webpack-dev-middleware");
const webpackHotMiddleware = require("webpack-hot-middleware");

const { generateWpConfig } = require("../webpack/config");
const log = require("../logger").getLogger();
const { appStaticPath } = require("../pathutil");

function createDevServer(config) {
  const devServerPort = config.server.port;
  const appPath = config.paths.appPath;

  return new Promise((resolve, reject) => {
    // Create Webpack instance.
    const wpConfig = generateWpConfig(config);
    log.debug(`Webpack config: `, wpConfig);
    const compiler = webpack(wpConfig);

    // Create Express app.
    const app = express();

    // Serve Webpack artifacts.
    app.use(
      webpackDevMiddleware(compiler, {
        publicPath: "/js/"
      })
    );
    app.use(webpackHotMiddleware(compiler));

    // Serve static assets.
    const staticAssetsPath = appStaticPath(appPath);
    log.debug(`Serving static assets from: ${staticAssetsPath}`);
    app.use("/", express.static(staticAssetsPath));

    // Start serving.
    log.debug(`Starting dev server on port ${devServerPort}...`);
    const server = app.listen(devServerPort, err => {
      if (err) {
        log.error(`Cannot listen on port ${devServerPort}: ${err}`);
        return reject(err);
      }
      const listenPort = server.address().port;
      log.info(`Webserver listening at http://localhost:${listenPort}/`);
      resolve({ listenPort });
    });
  });
}

module.exports = {
  createDevServer
};
