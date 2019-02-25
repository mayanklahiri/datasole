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
      verbose: cmdLineArgs.verbose,
      openBrowser: cmdLineArgs.open
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

module.exports = {
  getConfig
};
