// Stdlib modules
const os = require("os");
const path = require("path");

// Package modules
const pathUtil = require("../util/path-util");
const { dirExists } = require("../util/fs-util");

/**
 * Generate a configuration from defaults and command-line overrides.
 * @param {object} cmdLineArgs Command-line arguments, with default values.
 * @returns {object} The merged configuration.
 */
function getConfig(cmdLineArgs, envMapper) {
  // Get path to built-in or custom specified app.
  let appRoot = process.cwd();
  if (cmdLineArgs.app) {
    // Is this a path to an external app?
    if (dirExists(cmdLineArgs.app)) {
      appRoot = cmdLineArgs.app;
    } else {
      throw new Error(`Application directory "${cmdLineArgs.app}" not found.`);
    }
  }

  // Return merged config.
  const mergedConfig = {
    mode: process.env.PRODUCTION ? "production" : "development",
    cli: {
      colors: !envMapper.areColorsDisabled(),
      app: cmdLineArgs.app,
      force: !!cmdLineArgs.force,
      frontend: !!cmdLineArgs.frontend,
      backend: !!cmdLineArgs.backend,
      openBrowser: !!cmdLineArgs.open,
      server: !!cmdLineArgs.server,
      client: !!cmdLineArgs.client
    },
    server: {
      port: cmdLineArgs.port,
      urlRootPath: cmdLineArgs.url_prefix,
      urlWsRelPath: cmdLineArgs.websocket_path
    },
    paths: {
      appPath: path.resolve(appRoot)
    },
    app: {
      root: path.resolve(appRoot),
      name: cmdLineArgs.name || "datasole-app"
    },
    procInfo: {
      title: process.title,
      nodeVersion: process.version,
      datasoleVersion: require(pathUtil.pkgJsonPath()).version,
      pid: process.pid,
      started: new Date().toISOString(),
      hostname: os.hostname()
    }
  };

  // Ensure URL root path ends with a trailing slash.
  const urlRootPath = mergedConfig.server.urlRootPath;
  if (urlRootPath && urlRootPath[urlRootPath.length - 1] !== "/") {
    mergedConfig.server.urlRootPath += "/";
  }

  // Ensure WS relative path does not start with a slash.
  const urlWsRelPath = mergedConfig.server.urlWsRelPath;
  if (urlWsRelPath && urlWsRelPath[0] === "/") {
    mergedConfig.server.urlWsRelPath = urlWsRelPath.slice(1);
  }

  return mergedConfig;
}

module.exports = {
  getConfig
};
