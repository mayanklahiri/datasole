const fs = require("fs");
const path = require("path");

const colors = require("colors");
const { mkdirp, copy } = require("fs-extra");

const { _init } = require("./common-init");
const log = require("./logger").getLogger();

const CMDLINE_ARGS = {
  description: "Initialize a new project in a directory.",
  options: [
    ["--server", "Generate only the server stub.", false],
    ["--client", "Generate only the client stub.", false]
  ]
};

async function main(args) {
  const generateBoth = !(args.server || args.client);
  const generateServer = generateBoth || args.server;
  const generateclient = generateBoth || args.client;
  if (generateServer) {
    await generateServerStub(args);
  }
  if (generateclient) {
    await generateClientStub(args);
  }
  log.info(colors.green("Project stubs generated."));
}

async function generateServerStub() {
  const srcPath = path.resolve(__dirname, "template");
  const targetPath = path.resolve(process.cwd(), "server");
  log.info(`Generating server stub in ${targetPath}...`);
  return Promise.all(
    [
      // Destination: server/lib/main.js
      [
        path.resolve(srcPath, "server_main.js"),
        path.resolve(targetPath, "lib", "main.js")
      ]
    ].map(async pair => await copyTemplate(...pair))
  );
}

async function generateClientStub() {
  const srcPath = path.resolve(__dirname, "template");
  const targetPath = path.resolve(process.cwd(), "client");
  log.info(`Generating client stub in ${targetPath}...`);
  return Promise.all(
    [
      // Destination: client/lib/client.js
      [
        path.resolve(srcPath, "client_main.js"),
        path.resolve(targetPath, "lib", "client.js")
      ],
      // Destination: client/template/index.pug
      [
        path.resolve(srcPath, "index.pug"),
        path.resolve(targetPath, "template", "index.pug")
      ],
      // Destination: client/assets/sample.jpg
      [
        path.resolve(srcPath, "sample.png"),
        path.resolve(targetPath, "assets", "sample.png")
      ]
    ].map(async pair => await copyTemplate(...pair))
  );
}

async function copyTemplate(srcPath, destPath) {
  await mkdirp(path.dirname(destPath));
  if (!fs.existsSync(destPath)) {
    log.info(`+ Writing ${colors.yellow(destPath)}`);
    await safeCopy(srcPath, destPath);
  }
}

async function safeCopy(srcPath, destPath) {
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
