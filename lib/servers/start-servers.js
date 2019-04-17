const colors = require("colors");
const { createExpressServer } = require("./express");
const { createWebsocketServer } = require("./websocket");

const log = require("../logging").getLogger();

function startWebserver(config, liveModelServer, options) {
  const expServer = createExpressServer(config, options);
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
####  Server listening in "${config.mode}" mode at ${listenUrl}
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

function startBackend(config, liveModelServer, options) {
  const { createAppServer } = require("../servers/app");
  return createAppServer(config, liveModelServer).start();
}

module.exports = {
  startWebserver,
  startBackend
};
