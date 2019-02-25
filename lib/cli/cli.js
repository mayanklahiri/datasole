#!/usr/bin/env node
/**
 * Command Line Interface entry point.
 *
 * This file intentionally has some require() expressions inside the body of functions.
 * This is prevent large modules like Webpack from being require()'d unless they are needed.
 *
 */
// Stdlib modules
const os = require("os");
const path = require("path");

// Third-party modules
const commander = require("commander");

// Package modules
const { pkgJsonPath, builtInAppsPath } = require("../util/path-util");
const { prettyJson } = require("../util");
const { dirExists } = require("../util/fs-util");

// Same-directory includes
const { initLogging, getLogger } = require("./logger");
const { getCommandLine } = require("./get-cmd-line");

// Run main() in imperative mode, or export public interface.
if (require.main === module) {
  main();
} else {
  module.exports = {
    getCommandLine,
    getConfig,
    main,
    run
  };
}

/**
 * CLI entry point.
 */
function main() {
  const pkgJson = require(pkgJsonPath());
  commander
    .version(pkgJson.version)
    .description(pkgJson.description)
    .command("init", "initialize a new application in the current directory.")
    .command(
      "dev",
      "serve a development version of the application on localhost.",
      { isDefault: true }
    )
    .command(
      "build",
      "build a production-ready web distribution of the application."
    )
    .command(
      "app",
      "serve the production-ready distribution and the application backend."
    )
    .parse(process.argv);

  return;

  // Derive CLI config from defaults and command line.
  const cmdLineArgs = getCommandLine();

  initLogging(cmdLineArgs);
  const config = getConfig(cmdLineArgs);
  const log = getLogger();
  log.debug("Command-line arguments:", cmdLineArgs);
  log.debug(`Config: ${prettyJson(config)}`);

  // Run CLI function based on the merged config.
  run(config).catch(e => {
    log.error(e);
    return process.exit(1);
  });
}

/**
 * Run the CLI.
 * @param {object} config Merged configuration for CLI run.
 */
async function run(config) {
  const log = getLogger();
  const { wpBuild } = require("../webpack/build");

  // Execute a build.
  if (config.cli.build) {
    log.info(`Building project in ${config.mode} mode...`);
    await wpBuild(config).catch(e => {
      log.error(`Build failed: ${e}`);
      return process.exit(1);
    });
  }

  // Run a webserver.
  let wsServer;
  if (config.cli.serve) {
    const { createExpressServer } = require("./servers/express");
    const { createWebsocketServer } = require("./servers/websocket");
    const log = getLogger();

    // Create server.
    const expServer = createExpressServer(config);
    wsServer = createWebsocketServer(config, expServer.getHttpServer());
    await expServer
      .listen()
      .then(listenInfo => {
        const listenUrl = `http://localhost:${listenInfo.port}${
          config.server.urlRootPath
        }`;

        log.info(
          `
#####################################################################################
####
####  Server in "${config.mode}" mode is listening at ${listenUrl}
####
#####################################################################################`
        );

        // Open a browser window if possible.
        if (config.cli.openBrowser) {
          const opener = require("opener");
          log.info(`Opening ${listenUrl} in local web browser...`);
          opener(listenUrl);
        }
      })
      .catch(err => {
        log.error(err);
        return process.exit(1);
      });
  }

  // Run the backend application.
  if (config.cli.backend) {
    const { createAppServer } = require("./servers/app");
    const liveModelServer = wsServer.getLiveModelServer();
    log.info(`Starting backend server`);
    await createAppServer(config, wsServer.getLiveModelServer()).start();
  }

  return Promise.resolve();
}
