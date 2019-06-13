const fs = require("fs").promises;
const path = require("path");

const colors = require("colors");
const { ensureDir, mkdirp, copy } = require("fs-extra");

const pathutil = require("../util/path-util");
const _init = require("./_init");

const STARTER_PACKAGE_JSON = {
  version: "0.1.0",
  dependencies: {},
  devDependencies: {},
  engines: {
    node: ">=12.0.0"
  },
  engineStrict: true
};

let log;

async function main(config) {
  log = require("../logging").getLogger();
  const projectRoot = config.getCheckedKey("app");
  const force = config.getKey("force");

  await ensureDir(projectRoot);
  const dirListing = await fs.readdir(projectRoot);
  if (dirListing.length && !force) {
    throw new Error(
      `Directory "${projectRoot}" is not empty; use --force to force init (overwrites files).`
    );
  }

  log.info(
    colors.green(`Generating project stub in: ${colors.bold(projectRoot)}`)
  );

  const generateBoth = !(config.getKey("server") || config.getKey("client"));
  const generateServer = generateBoth || config.getKey("server");
  const generateclient = generateBoth || config.getKey("client");

  if (generateServer) {
    log.info(`Generating server stub in ${colors.yellow(projectRoot)}...`);
    await generateServerStub(projectRoot);
  }

  if (generateclient) {
    log.info(`Generating client stub in ${colors.yellow(projectRoot)}...`);
    await generateClientStub(projectRoot);
  }

  if (generateBoth) {
    log.info(`Generating common stub in ${colors.yellow(projectRoot)}...`);
    await generateCommonStub(projectRoot);
  }

  await generatePackageJson(projectRoot, {
    name: config.getKey("name")
  });

  log.info(colors.green("Project stub generated."));
  return process.exit(0);
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
  return fs.writeFile(targetPath, JSON.stringify(outJson, null, 2), "utf-8");
}

/**
 * Generate user project's client-side stub.
 * @param {string} projectRoot Path to project root
 */
function generateClientStub(projectRoot) {
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

async function copyTemplate(srcPath, destPath, projectRoot) {
  const relPath = path.relative(projectRoot, destPath);
  const srcRelPath = path.relative(pathutil.projectTemplate(), srcPath);
  await ensureDir(path.dirname(destPath));
  await safeCopy(srcPath, destPath);
  log.info(`  ↳ Copy: ${colors.yellow(srcRelPath)} → ${colors.green(relPath)}`);
}

function safeCopy(srcPath, destPath) {
  return copy(srcPath, destPath, {
    preserveTimestamps: true,
    overwrite: false
  });
}

if (require.main === module) {
  _init(main, require("./args-init"));
} else {
  module.exports = main;
}
