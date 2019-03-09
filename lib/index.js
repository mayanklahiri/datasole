const path = require("path");
module.exports = {
  liveModel: require("./live-model"),
  util: require("./util"),
  logger: require("./util/logger"),
  runtime: require("./live-model").runtime,
  cliEntryPath: path.join(__dirname, "cli", "cli.js")
};
