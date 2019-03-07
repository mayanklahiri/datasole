const { _init } = require("./common-init");
const { LiveModelServer } = require("../live-model/server");
const { getConfig } = require("./config");
const {
  startWebserver,
  startBackend,
  SERVER_OPTIONS
} = require("./start-servers");

const CMDLINE_ARGS = {
  description: "Run a development webserver.",
  options: SERVER_OPTIONS
};

async function main(args) {
  const config = getConfig(args);
  const liveModelServer = (this.liveModelServer = new LiveModelServer(config));
  if (config.cli.frontend) {
    await startWebserver(config, liveModelServer);
  }
  if (config.cli.backend) {
    await startBackend(config, liveModelServer);
  }
}

if (require.main === module) {
  _init(main, CMDLINE_ARGS);
} else {
  module.exports = main;
}
