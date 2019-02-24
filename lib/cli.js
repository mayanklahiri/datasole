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
const { wpBuild } = require("./webpack/build");

const CMDLINE_ARGS = [
  [
    ["-a", "--app"],
    {
      help:
        "Built-in app name or path to app. (default: 'defaultApp', built-in demo app)",
      defaultValue: "defaultApp"
    }
  ],
  [
    ["-p", "--port"],
    {
      help:
        "Port for webserver to listen on (default: 8080, use 0 for random port)",
      defaultValue: 8080
    }
  ],
  [
    ["-m", "--mode"],
    {
      help: "'development' or 'production' (default: development)",
      defaultValue: "development"
    }
  ],
  [
    ["-b", "--build"],
    {
      help: "Run a Webpack build in the current mode (default: false)",
      defaultValue: false,
      type: Boolean,
      nargs: 0,
      action: "store"
    }
  ],
  [
    ["-s", "--serve"],
    {
      help: "Run webserver (default: true)",
      defaultValue: true,
      type: Boolean,
      nargs: 0,
      action: "store"
    }
  ],
  [
    ["--verbose"],
    {
      help: "Verbose logging (default: false)",
      defaultValue: false,
      type: Boolean,
      nargs: 0,
      action: "store"
    }
  ],
  [
    ["--backend"],
    {
      help: "Run the application backend if present (default: true)",
      defaultValue: true,
      type: Boolean,
      nargs: 0,
      action: "store"
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
        log.info(
          `
#####################################################################################
####
####  ${config.mode} mode server listening at http://localhost:${
            listenInfo.port
          }${config.server.urlRootPath}
####
#####################################################################################`
        );
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
    cli: {
      build: cmdLineArgs.build,
      serve: cmdLineArgs.serve,
      backend: cmdLineArgs.backend,
      verbose: cmdLineArgs.verbose
    },
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
