const path = require("path");
const LoggingSubsystem = require("./logging/subsystem");

module.exports = {
  cliEntryPath: path.join(__dirname, "cli", "cli.js"),
  liveModel: require("./live-model"),
  log: require("./logging")
    .init()
    .getLogger("app"),
  runtime: require("./live-model").runtime,
  mutations: require("./live-model").mutations,
  util: require("./util")
};
