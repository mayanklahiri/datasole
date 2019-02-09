#!/usr/bin/env node
/**
 * CLI entry point.
 *
 * Assumptions:
 *
 *   - Exists in the top-level lib directory, but run from anywhere.
 *   - Marked executable
 *   - This file is executable without any installed node_modules.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const CONFIG = (() => {
  const paths = {
    cwd: process.cwd(),
    libRoot: __dirname,
    pkgRoot: path.resolve(__dirname, ".."),
    staticRoot: path.resolve(__dirname, "..", "client", "static"),
    nodeModules: path.resolve(__dirname, "..", "node_modules"),
    templateRoot: path.resolve(__dirname, "..", "client", "template")
  };
  const procInfo = {
    version: require(path.join(paths.pkgRoot, "package.json")).version,
    nodeVersion: process.version,
    pid: process.pid,
    started: new Date().toISOString(),
    hostname: os.hostname()
  };
  return { paths, procInfo };
})();

(function _init(config) {
  // Ensure node_modules exists.
  const {
    paths: { nodeModules, pkgRoot }
  } = config;
  if (!fs.existsSync(nodeModules)) {
    console.error(
      `Error: datasole cannot start: node_modules not installed at expected path "${nodeModules}".\n` +
        `Please run "npm install" in the "${pkgRoot}" directory.`
    );
    return process.exit(1);
  }

  // Parse command line.
  config.args = require("minimist")(process.argv.slice(2));

  // Create components.
  const server = require("./services/server/WsServer")(config);
  const watcher = require("./services/watcher/FsWatcher")(config);
  const aggregator = require("./services/aggregator/MergingAggregator")(config);

  // Start components.
  server.start();
})(CONFIG);
