const os = require("os");

const { prettyJson } = require("../util");

function getPugDefines(config) {
  const build = {
    time: new Date().toISOString(),
    hostname: os.hostname(),
    username: os.userInfo().username
  };

  return {
    CONFIG: prettyJson(config),
    BUILD: prettyJson(build),
    MODE: config.mode,
    CONFIG_server: config.server,
    ENV: process.env,
    BASE_URL: config.server.urlRootPath,
    NODE_ENV: process.env.NODE_ENV,
    DEBUG: process.env.NODE_ENV !== "production",
    PRODUCTION: process.env.NODE_ENV === "production"
  };
}

module.exports = getPugDefines;
