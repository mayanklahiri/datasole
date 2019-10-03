const log = require("../../logging").getLogger();
const BaseServer = require("./BaseServer");
const { writeToTempSync } = require("../../util/fs-util");

const WEBPACK_LOCAL_POLL_TIME_MS = 3000;

class WebDevServer extends BaseServer {
  getDependencies() {
    return ["HttpServer"];
  }

  async run(svcDeps) {
    // Lazy-load Webpack at use.
    const webpack = require("webpack");
    const webpackDevMiddleware = require("webpack-dev-middleware");
    const webpackHotMiddleware = require("webpack-hot-middleware");
    const { generateWpConfig } = require("../../webpack/generateWpConfig");

    const { _config: config } = this;
    const { HttpServer: httpServer } = svcDeps;

    const app = httpServer.getExpressApp();
    const urlRootPath = config.getCheckedKey("urlRootPath");

    // Create Webpack instance in non-production (development) mode.
    const wpConfig = (this._wpConfig = generateWpConfig(this._config));
    const wpConfigOutPath = writeToTempSync(
      "webpack.config.json",
      JSON.stringify(wpConfig, null, 2)
    );
    log.debug(`Webpack configuration written to ${wpConfigOutPath}`);
    const compiler = (this._compiler = webpack(wpConfig));

    // Put webpack-dev-middleware and webpack-hot-middleware into the Express request chain.
    const devMiddleware = webpackDevMiddleware(compiler, {
      publicPath: urlRootPath,
      logLevel: "warn",
      watchOptions: {
        poll: WEBPACK_LOCAL_POLL_TIME_MS
      }
    });
    app.use(devMiddleware);
    app.use(webpackHotMiddleware(compiler));

    return new Promise(resolve => devMiddleware.waitUntilValid(resolve));
  }
}

module.exports = WebDevServer;
