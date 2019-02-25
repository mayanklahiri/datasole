const { initLogging } = require("./logger");
const { getConfig } = require("./cli-config");

function _init(mainFn, args) {
  const config = getConfig(args);
  initLogging(config);
  return mainFn(config);
}

module.exports = {
  _init
};
