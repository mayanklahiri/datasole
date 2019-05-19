const os = require("os");

const { prettyJson } = require("../util");

function getPugDefines(config) {
  const build = {
    time: new Date().toISOString(),
    timeMs: Date.now(),
    hostname: os.hostname(),
    username: os.userInfo().username
  };

  return {
    CONFIG: prettyJson(config),
    BUILD: prettyJson(build),
    ENV: prettyJson(process.env),
    CONFIG_server: prettyJson(config.server),
    MODE: config.mode,
    BASE_URL: config.server.urlRootPath,
    NODE_ENV: config.mode,
    DEBUG: config.mode !== "production",
    PRODUCTION: config.mode === "production"
  };
}

module.exports = getPugDefines;
