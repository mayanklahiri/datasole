const os = require("os");

const { prettyJson } = require("../util");

function getPugDefines(config) {
  const build = {
    time: new Date().toISOString(),
    hostname: os.hostname(),
    username: os.userInfo().username
  };
  return {
    CONFIG: prettyJson(Object.assign({}, { build }, config)),
    MODE: config.mode,
    BASE_URL: config.server.urlRootPath,
    NODE_ENV: process.env.NODE_ENV,
    DEBUG: process.env.NODE_ENV === "development"
  };
}

module.exports = getPugDefines;
