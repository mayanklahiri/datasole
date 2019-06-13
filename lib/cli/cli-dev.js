const colors = require("colors");

const _init = require("./_init");
const { autoPromise } = require("../util/auto");

async function main(config) {
  // Lazy-load dependencies for fast exit.
  const log = require("../logging").getLogger();
  const { createServers } = require("../servers");

  const context = { log };
  const servers = createServers(config);
  const startResult = await autoPromise(servers, "start", 1, context);
  const httpServer = startResult.http;
  await httpServer.listen();
  const listenUrl = httpServer.getListenUrl();

  log.info(
    colors.green(`
#################################################################
####
#### ${colors.bold(config.getMode())} UI is being served at ${colors.bold(
      listenUrl
    )}
####
#################################################################
`)
  );

  return Promise.resolve();
}

if (require.main === module) {
  _init(main, require("./args-dev"));
} else {
  module.exports = main;
}
