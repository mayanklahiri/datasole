const colors = require("colors");

const _init = require("./_init");
const { autoPromise } = require("../util/auto");
const { createServers } = require("../servers");

const CMDLINE_ARGS = {
  title: "datasole-dev",
  description: "Run a development webserver.",
  options: require("./args-server")
};

async function main(config) {
  const log = require("../logging").getLogger();
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
#### ${colors.bold(config.mode)} UI is being served at ${colors.bold(listenUrl)}
####
#################################################################
`)
  );

  return Promise.resolve();
}

if (require.main === module) {
  _init(main, CMDLINE_ARGS);
} else {
  module.exports = main;
}
