/**
 * Datasole top-level library export.
 */
const path = require("path");
const liveModel = require("./live-model");

const util = require("./util");
const cliEntryPath = path.join(__dirname, "cli", "cli.js");
const appLogger = require("./logging").getLogger("app");
const runtime = new liveModel.runtime();

module.exports = {
  cliEntryPath,
  liveModel,
  util,
  runtime,
  log: appLogger,
  mutations: liveModel.mutations
};
