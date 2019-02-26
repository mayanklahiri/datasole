// Stdlib modules
const os = require("os");
const path = require("path");

// Package modules
const { pkgJsonPath, builtInAppsPath } = require("../util/path-util");
const { dirExists } = require("../util/fs-util");

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

  // Return merged config.
  const mergedConfig = {
    mode: "development",
    cli: {
      app: cmdLineArgs.app,
      frontend: !!cmdLineArgs.frontend,
      backend: !!cmdLineArgs.backend,
      openBrowser: !!cmdLineArgs.open
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
      datasoleVersion: require(pkgJsonPath()).version,
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

module.exports = {
  getConfig
};
