const colors = require("colors");

const log = require("../util/logger").getLogger();

function startWebserver(config, liveModelServer) {
  const { createExpressServer } = require("../servers/express");
  const { createWebsocketServer } = require("../servers/websocket");

  const expServer = createExpressServer(config);
  createWebsocketServer(config, expServer.getHttpServer(), liveModelServer);
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

module.exports = {
  startWebserver,
  startBackend
};
