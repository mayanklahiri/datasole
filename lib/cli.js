#!/usr/bin/env node
/**
 * CLI entry point.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const { pkgJsonPath, builtInAppsPath } = require("./pathutil");
const { initLogging, getLogger } = require("./logger");
const { dirExists } = require("./util");

const CMDLINE_ARGS = [
  [
    ["-a", "--app"],
    {
      help:
        "Built-in app name or path to app. (default: built-in 'defaultApp')",
      defaultValue: "defaultApp"
    }
  ],
  [
    ["-p", "--port"],
    {
      help: "Port for webserver to listen on (8080 default, 0 for random)",
      defaultValue: 8080
    }
  ],
  [
    ["-m", "--mode"],
    {
      help: "'development' or 'production'",
      defaultValue: "development"
    }
  ],
  [
    ["--ws_port"],
    {
      help: "Websocket server port (0 for random, default).",
      defaultValue: 0
    }
  ]
];

/**
 * Parse command-line arguments from process.argv.
 * @returns {object} Command-line options as a key/value map.
 */
function getCommandLine() {
  const { ArgumentParser } = require("argparse");
  const pkgJson = require(pkgJsonPath());
  const parser = new ArgumentParser({
    version: pkgJson.version,
    addHelp: true,
    description: pkgJson.description
  });
  CMDLINE_ARGS.forEach(argSpec => parser.addArgument(...argSpec));
  return parser.parseArgs();
}

/**
 * Generates a configuration from defaults and command-line overrides.
 * @param {object} cmdLineArgs Command-line arguments, with default values.
 * @returns {object} The merged configuration.
 */
function getConfig(cmdLineArgs) {
  // Get path to built-in or custom specified app.
  const builtInAppPath = builtInAppsPath(cmdLineArgs.app);
  const externalAppPath = cmdLineArgs.app;
  const appPath = dirExists(builtInAppPath)
    ? builtInAppPath
    : dirExists(externalAppPath)
    ? externalAppPath
    : null;
  if (!appPath) {
    throw new Error(`Application path not found, tried "${cmdLineArgs.app}".`);
  }

  // Return merged config.
  return {
    server: {
      port: cmdLineArgs.port,
      wsPort: cmdLineArgs.ws_port
    },
    paths: {
      appPath
    },
    procInfo: {
      nodeVersion: process.version,
      pid: process.pid,
      started: new Date().toISOString(),
      hostname: os.hostname()
    }
  };
}

/**
 * Runs the CLI.
 * @param {object} config Merged configuration for CLI run.
 */
function run(config) {
  // Create components.
  const server = require("./services/server/WsServer")(config);

  // Start components.
  server.start();
}

if (require.main === module) {
  const cmdLineArgs = getCommandLine();
  initLogging(cmdLineArgs);
  const config = getConfig(cmdLineArgs);

  const log = getLogger();
  log.debug("Command-line arguments:", cmdLineArgs);
  log.debug("Config:", config);
} else {
  module.exports = {
    getCommandLine,
    getConfig,
    run
  };
}
