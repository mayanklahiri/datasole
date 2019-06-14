const assert = require("assert");
const fs = require("fs").promises;
const path = require("path");
const express = require("express");

const BaseServer = require("../base");
const { appClientDistPath } = require("../../util/path-util");

class WebStaticServer extends BaseServer {
  /**
   * Service entry point.
   */
  async run(svcDeps) {
    const { _config: config } = this;
    const { log } = this._context;
    const { express: expressSvc } = svcDeps;

    const app = expressSvc.getApp();
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
      app.use(
        urlRootPath,
        express.static(path.join(__dirname, "no-prod-build"))
      );
      log.error(`Cannot server static distribution from "${distPath}": ${e}`);
      log.debug(e);
    }
  }
}

module.exports = WebStaticServer;
