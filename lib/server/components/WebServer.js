const assert = require("assert");
const fs = require("fs").promises;
const path = require("path");
const express = require("express");

const BaseServer = require("./BaseServer");
const log = require("../../logging").getLogger();
const { appClientDistPath } = require("../../util/path-util");

const PAGES_ROOT = path.resolve(__dirname, "../pages");

class WebServer extends BaseServer {
  getDependencies() {
    return ["HttpServer"];
  }

  /**
   * Service entry point.
   */
  async run(svcDeps) {
    const { _config: config } = this;
    const { HttpServer: httpServer } = svcDeps;
    this._svcDeps = svcDeps;

    const app = httpServer.getExpressApp();
    const urlRootPath = config.getCheckedKey("urlRootPath");
    const appDiskPath = config.getCheckedKey("app");
    const distPath = appClientDistPath(appDiskPath);

    try {
      const stat = await fs.stat(distPath);
      assert(
        stat.isDirectory(),
        `Client distribution path "${distPath}" is not a directory.`
      );

      // Serve static bundle at a directory path.
      app.use(urlRootPath, express.static(distPath));
      log.info(
        `Serving client bundle at URL prefix "${urlRootPath}" from local path "${distPath}"`
      );
    } catch (e) {
      // Serve built-in error page.
      app.use(urlRootPath, (_, res) => {
        res.status(500);
        res.render("no-dist", { error: e.message, stack: e.stack.toString() });
      });
      log.error(`Cannot server static distribution from "${distPath}": ${e}`);
      log.debug(e);
    }
  }
}

module.exports = WebServer;
