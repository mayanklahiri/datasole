#!/usr/bin/env node
/**
 * Command Line Interface
 */
const os = require("os");
const path = require("path");

const { ArgumentParser } = require("argparse");

const { pkgJsonPath, builtInAppsPath } = require("./pathutil");
const { initLogging, getLogger } = require("./logger");
const { prettyJson } = require("./util");
const { dirExists } = require("./fs-util");

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
    ["--url_prefix"],
    {
      help: "Relative path to root all servers at (default: '/')",
      defaultValue: "/"
    }
  ],
  [
    ["--websocket_path"],
    {
      help: "Relative path for WebSocket connections (default: '__ws__')",
      defaultValue: "__ws__"
    }
  ]
];

/**
 * CLI entry point.
 */
function main() {
  // Derive config from defaults and command line.
  const cmdLineArgs = getCommandLine();
  initLogging(cmdLineArgs);
  const config = getConfig(cmdLineArgs);
  const log = getLogger();
  log.debug("Command-line arguments:", cmdLineArgs);
  log.debug(`Config: ${prettyJson(config)}`);

  // Run CLI function based on the merged config.
  run(config);
}

/**
 * Parse command-line arguments from process.argv.
 * @returns {object} Command-line options as a key/value map.
 */
function getCommandLine() {
  const pkgJson = require(pkgJsonPath());
  const parser = new ArgumentParser({
    addHelp: true,
    version: pkgJson.version,
    description: pkgJson.description
  });
  CMDLINE_ARGS.forEach(argSpec => parser.addArgument(...argSpec));
  return parser.parseArgs();
}

/**
 * Generate a configuration from defaults and command-line overrides.
 * @param {object} cmdLineArgs Command-line arguments, with default values.
 * @returns {object} The merged configuration.
 */
function getConfig(cmdLineArgs) {
  // Get path to built-in or custom specified app.
  let appPath;
  if (cmdLineArgs.app) {
    // Is this a built-in app?
    const builtInAppPath = builtInAppsPath(cmdLineArgs.app);
    if (dirExists(builtInAppPath)) {
      appPath = builtInAppPath;
    } else {
      // Is this a path to an external app?
      if (dirExists(cmdLineArgs.app)) {
        appPath = cmdLineArgs.app;
      } else {
        throw new Error(`Application not found.`);
      }
    }
  } else {
    throw new Error(`No application specified.`);
  }

  // Check run mode.
  if (cmdLineArgs.mode !== "production" && cmdLineArgs.mode !== "development") {
    throw new Error(
      `Unknown run mode "${
        cmdLineArgs.mode
      }", use "development" or "production".`
    );
  }

  // Return merged config.
  const mergedConfig = {
    mode: cmdLineArgs.mode,
    server: {
      port: cmdLineArgs.port,
      urlRootPath: cmdLineArgs.url_prefix,
      urlWsRelPath: cmdLineArgs.websocket_path
    },
    paths: {
      appPath: path.resolve(appPath)
    },
    procInfo: {
      nodeVersion: process.version,
      pid: process.pid,
      started: new Date().toISOString(),
      hostname: os.hostname()
    }
  };

  // Ensure URL root path ends with a trailing slash.
  const urlRootPath = mergedConfig.server.urlRootPath;
  if (urlRootPath[urlRootPath.length - 1] !== "/") {
    mergedConfig.server.urlRootPath += "/";
  }

  // Ensure WS relative path does not start with a slash.
  const urlWsRelPath = mergedConfig.server.urlWsRelPath;
  if (urlWsRelPath[0] === "/") {
    mergedConfig.server.urlWsRelPath = urlWsRelPath.slice(1);
  }

  return mergedConfig;
}

/**
 * Run the CLI.
 * @param {object} config Merged configuration for CLI run.
 */
function run(config) {
  if (config.mode === "production") {
    throw new Error("Production mode not implemented.");
  } else {
    // Development mode.
    const { createDevServer } = require("./servers/dev");
    const { createWebsocketServer } = require("./servers/websocket");
    const log = getLogger();

    // Create development server.
    const devServer = createDevServer(config);
    const wsServer = createWebsocketServer(config, devServer.getServer());
    devServer
      .listen()
      .then(listenInfo => {
        log.info(`Webserver listening at http://localhost:/`);
        log.info("Server listening", listenInfo);
      })
      .catch(err => {
        log.error(err);
        return process.exit(1);
      });
  }
}

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
