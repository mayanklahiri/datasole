const path = require("path");
module.exports = {
  cliEntryPath: path.join(__dirname, "cli", "cli.js"),
  liveModel: require("./live-model"),
  log: require("./logging").getLogger("app"),
  runtime: require("./live-model").runtime,
  mutations: require("./live-model").mutations,
  util: require("./util")
};
