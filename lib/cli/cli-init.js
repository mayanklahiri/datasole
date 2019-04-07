const fs = require("fs");
const path = require("path");

const colors = require("colors");
const { mkdirp, copy } = require("fs-extra");

const pathutil = require("../util/path-util");
const _init = require("./_init");
const log = require("../util/logger").getLogger();

const CMDLINE_ARGS = {
  description: "Initialize a new project in a directory.",
  options: [
    ["-n, --name <name>", "Project package name"],
    [
      "-p, --path <path>",
      "Project root directory (defaults to working directory)"
    ],
    ["--title <title>", "Change process title for logs"],
    ["--force", "Force initialization even if directory is not empty"],
    ["--server", "Generate only the server stub.", false],
    ["--client", "Generate only the client stub.", false]
  ]
};

const STARTER_PACKAGE_JSON = {
  version: "0.1.0",
  dependencies: [],
  devDependencies: [],
  engines: {
    node: ">=10.15.0"
  },
  engineStrict: true
};

function main(args) {
  const projectRoot = path.resolve(args.path || process.cwd());
  if (!fs.existsSync(projectRoot)) {
    if (!args.force) {
      return Promise.reject(
        new Error(`No such directory "${projectRoot}", use --force to create.`)
      );
    }
    log.info(colors.yellow(`Creating project root ${projectRoot}...`));
    mkdirp(projectRoot);
  }

  if (fs.readdirSync(projectRoot).length && !args.force) {
    return Promise.reject(
      new Error(
        `Directory "${projectRoot}" is not empty; use --force to force init (overwrites files).`
      )
    );
  }

  log.info(
    colors.green(`Generating project stub in: ${colors.bold(projectRoot)}`)
  );

  const generateBoth = !(args.server || args.client);
  const generateServer = generateBoth || args.server;
  const generateclient = generateBoth || args.client;

  if (generateServer) {
    generateServerStub(projectRoot);
  }

  if (generateclient) {
    generateClientStub(projectRoot);
  }

  if (generateBoth) {
    generateCommonStub(projectRoot);
  }

  generatePackageJson(projectRoot, args, {
    name: args.name || args.title
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
