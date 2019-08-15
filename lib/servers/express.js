const express = require("express");
const BaseServer = require("./base");

const WEBPACK_DEV_WATCH_POLL_TIME_MS = 2000;

class ExpressServer extends BaseServer {
  /**
   * Service entry point.
   */
  async run() {
    this._app = express();
  }

  getApp() {
    return this._app;
  }

  registerFallbackHandlers() {
    const { urlRootPath } = this;
    this._app.use((_, res) => res.redirect(urlRootPath));
  }
}

module.exports = ExpressServer;
