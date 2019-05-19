const fs = require("fs");

const col = require("colors");

const _init = require("./_init");

const { wpBuild, generateWpConfig } = require("../webpack");
const { appClientDistPath } = require("../util/path-util");
const log = require("../logging").getLogger();

const CMDLINE_ARGS = {
  title: "datasole-build",
  description:
    "Build a production-ready distribution of the client application.",
  options: require("./args-build")
};

async function main(config) {
  // Set production mode.
  config.mode = process.env.NODE_ENV = "production";

  // Ensure that application root path exists.
  const appRootPath = config.paths.appPath;
  if (!fs.existsSync(appRootPath)) {
    throw new Error(`Application root path "${appRootPath}" does not exist.`);
  }
  if (!fs.statSync(appRootPath).isDirectory()) {
    throw new Error(
      `Application root path "${appRootPath}" is not a directory.`
    );
  }

  const distPath = appClientDistPath(appRootPath);
  log.info(col.yellow(`Building production web distribution...`));
  log.info(`Source root: ${appRootPath}`);
  log.info(`Output root: ${distPath}`);
  log.info(col.yellow(`Running Webpack...`));

  // Generate WebPack config for a production build.
  const wpConfig = generateWpConfig(config, {
    clean: true, // clean out dist before build
    interactive: false // disable progress bar and console clearing
  });

  // Execute Webpack build.
  const buildResult = await wpBuild(wpConfig);
  const buildErrors = buildResult.compilation.errors || [];
  if (buildErrors.length) {
    throw new Error(
      `Build failed: ${buildErrors.length} Webpack errors: ` +
        buildErrors.map(e => e.toString()).join("\n")
    );
  }

  log.info(col.green(col.bold("Build completed successfully.")));
}

if (require.main === module) {
  _init(main, CMDLINE_ARGS);
} else {
  module.exports = main;
}
