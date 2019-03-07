const colors = require("colors");

const { json } = require("../util");
const log = require("../util/logger").getLogger();

function startWebserver(config, liveModelServer) {
  const { createExpressServer } = require("../servers/express");
  const { createWebsocketServer } = require("../servers/websocket");

  const expServer = createExpressServer(config);
  const wsServer = createWebsocketServer(
    config,
    expServer.getHttpServer(),
    liveModelServer
  );
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

function startBackend(config, liveModelServer) {
  const { createAppServer } = require("../servers/app");
  return createAppServer(config, liveModelServer).start();
}

const SERVER_OPTIONS = [
  ["-a, --app <name>", "Name of or path to Datasole application directory"],
  [
    "-p, --port <n>",
    "Port for webserver to listen on (use 0 for random port)",
    8000
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
];

module.exports = {
  startWebserver,
  startBackend,
  SERVER_OPTIONS
};
