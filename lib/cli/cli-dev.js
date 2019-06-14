const colors = require("colors");
const _init = require("./_init");
const { runDepGraph } = require("../util/auto");
const LiveModel = require("../live-model/model");

async function main(config) {
  // Lazy-load dependencies.
  const log = require("../logging").getLogger();
  const { createServers } = require("../servers");

  // Create LiveModel instance.
  const liveModel = new LiveModel();

  // Shared service context object.
  const context = { log, liveModel };

  // Dependency graph of servers.
  const servers = createServers(config);

  // Start all servers.
  const startResult = await runDepGraph(servers, context, "start", 1);

  // Start HTTP server listening.
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
}

if (require.main === module) {
  _init(main, require("./args-dev"));
} else {
  module.exports = main;
}
