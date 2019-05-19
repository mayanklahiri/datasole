const fs = require("fs");
const path = require("path");

const colors = require("colors");
const { mkdirp, copy } = require("fs-extra");

const pathutil = require("../util/path-util");
const _init = require("./_init");
const log = require("../logging").getLogger();

const CMDLINE_ARGS = {
  description: "Initialize a new project in a directory.",
  options: require("./args-init")
};

const STARTER_PACKAGE_JSON = {
  version: "0.1.0",
  dependencies: {},
  devDependencies: {},
  engines: {
    node: ">=10.15.0"
  },
  engineStrict: true
};

async function main(config) {
  const projectRoot = config.paths.appPath;
  if (!fs.existsSync(projectRoot)) {
    if (!config.cli.force) {
      return Promise.reject(
        new Error(`No such directory "${projectRoot}", use --force to create.`)
      );
    }
    log.info(colors.yellow(`Creating project root ${projectRoot}...`));
    mkdirp(projectRoot);
  }

  if (fs.readdirSync(projectRoot).length && !config.cli.force) {
    return Promise.reject(
      new Error(
        `Directory "${projectRoot}" is not empty; use --force to force init (overwrites files).`
      )
    );
  }

  log.info(
    colors.green(`Generating project stub in: ${colors.bold(projectRoot)}`)
  );

  const generateBoth = !(config.cli.server || config.cli.client);
  const generateServer = generateBoth || config.cli.server;
  const generateclient = generateBoth || config.cli.client;

  if (generateServer) {
    generateServerStub(projectRoot);
  }

  if (generateclient) {
    generateClientStub(projectRoot);
  }

  if (generateBoth) {
    generateCommonStub(projectRoot);
  }

  generatePackageJson(projectRoot, {
    name: config.app.name
  });

  log.info(colors.green("Project stub generated."));
  return Promise.resolve();
}

/**
 * Write user project's package.json file.
 * @param {string} projectRoot Path to project root
 * @param {object} opts Options.
 */
function generatePackageJson(projectRoot, opts) {
  const outJson = Object.assign({}, STARTER_PACKAGE_JSON, opts);
  const targetPath = pathutil.appRoot(projectRoot, "package.json");
  log.info(`  ↳ Writing ${colors.yellow("package.json")}`);
  fs.writeFileSync(targetPath, JSON.stringify(outJson, null, 2), "utf-8");
}

/**
 * Generate user project's client-side stub.
 * @param {string} projectRoot Path to project root
 */
function generateClientStub(projectRoot) {
  log.info(`Generating client stub in ${colors.yellow(projectRoot)}...`);
  return Promise.all(
    [
      // Destination: client-side entry point
      [
        pathutil.projectTemplate("client_main.js"),
        pathutil.appClientEntryPointPath(projectRoot),
        projectRoot
      ],
      // Destination: client-side root template for index.html
      [
        pathutil.projectTemplate("index.pug"),
        pathutil.appClientIndexTemplate(projectRoot),
        projectRoot
      ],
      // Destination: sample client-side asset to be bundled
      [
        pathutil.projectTemplate("sample.jpg"),
        pathutil.appClientAssetsPath(projectRoot, "sample.jpg"),
        projectRoot
      ],
      // Destination: client stylesheet entry
      [
        pathutil.projectTemplate("global_style.scss"),
        pathutil.appClientStylesPath(projectRoot, "global.scss"),
        projectRoot
      ]
    ].map(tuple => copyTemplate(...tuple))
  );
}

/**
 * Generate user project's server-side application stub.
 * @param {string} projectRoot Path to project root
 */
function generateServerStub(projectRoot) {
  log.info(`Generating server stub in ${colors.yellow(projectRoot)}...`);
  return Promise.all(
    [
      // Destination: server-side entry point main.js
      [
        pathutil.projectTemplate("server_main.js"),
        pathutil.appServerEntryPoint(projectRoot),
        projectRoot
      ]
    ].map(tuple => copyTemplate(...tuple))
  );
}

/**
 * Generate a common modules stub.
 */
function generateCommonStub(projectRoot) {
  log.info(`Generating common stub in ${colors.yellow(projectRoot)}...`);
  return Promise.all(
    [
      // Destination: server-side entry point main.js
      [
        pathutil.projectTemplate("common_util.js"),
        pathutil.appCommonRoot(projectRoot, "util", "index.js"),
        projectRoot
      ]
    ].map(tuple => copyTemplate(...tuple))
  );
}

function copyTemplate(srcPath, destPath, projectRoot) {
  mkdirp(path.dirname(destPath));
  if (!fs.existsSync(destPath)) {
    const relPath = path.relative(projectRoot, destPath);
    const srcRelPath = path.relative(pathutil.projectTemplate(), srcPath);
    log.info(
      `  ↳ Copy: ${colors.yellow(srcRelPath)} → ${colors.yellow(relPath)}`
    );
    safeCopy(srcPath, destPath);
  }
}

function safeCopy(srcPath, destPath) {
  return copy(srcPath, destPath, {
    preserveTimestamps: true,
    overwrite: false
  });
}

if (require.main === module) {
  _init(main, CMDLINE_ARGS);
} else {
  module.exports = main;
}
