const colors = require("colors");

const { _init } = require("./cli-common-init");
const { getConfig } = require("./cli-config");
const log = require("./logger").getLogger();

const CMDLINE_ARGS = {
  description: "Initialize a new project in a directory.",
  options: [
    [
      "-a, --app <name>",
      "Name of or path to Datasole application directory",
      process.cwd()
    ],
    [
      "-p, --port <n>",
      "Port for webserver to listen on (use 0 for random port)",
      8080
    ],
    [
      "--no-open",
      "Do not attempt to open a local browser window after starting webserver."
    ],
    ["--no-backend", "Do not run the application backend"],
    ["--no-frontend", "Do not serve the application frontend"],
    [
      "--url_prefix <path>",
      "Relative path prefix to serve application client at (useful when behind reverse proxy)",
      "/"
    ],
    [
      "--websocket_path <suffix>",
      "Path suffix for WebSocket connections.",
      "__ws__"
    ]
  ]
};

async function main(args) {
  const config = getConfig(args);
  if (config.cli.frontend) {
    await startWebserver(config);
  }
  if (config.cli.backend) {
    await startBackend(config);
  }
}

function startWebserver(config) {
  const { createExpressServer } = require("../servers/express");
  const { createWebsocketServer } = require("../servers/websocket");

  const expServer = createExpressServer(config);
  wsServer = createWebsocketServer(config, expServer.getHttpServer());
  return expServer
    .listen()
    .then(listenInfo => {
      const listenUrl = `http://localhost:${listenInfo.port}${
        config.server.urlRootPath
      }`;

      log.info(
        colors.green(`
#####################################################################################
####
####  Server in "${config.mode}" mode is listening at ${listenUrl}
####
#####################################################################################`)
      );

      // Open a browser window if possible.
      if (config.cli.openBrowser) {
        const opener = require("opener");
        log.info(
          colors.yellow(
            colors.bold(`Opening ${listenUrl} in local web browser...`)
          )
        );
        opener(listenUrl);
      }
    })
    .catch(err => {
      log.error(err);
      return process.exit(1);
    });
}

function startBackend(config) {
  const { createAppServer } = require("../servers/app");
  const liveModelServer = wsServer.getLiveModelServer();
  return createAppServer(config, liveModelServer).start();
}

if (require.main === module) {
  _init(main, CMDLINE_ARGS);
} else {
  module.exports = main;
}
