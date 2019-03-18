const { json } = require("../util");

function getPugDefines(config) {
  return {
    CONFIG: json(config),
    MODE: config.mode,
    BASE_URL: config.server.urlRootPath,
    NODE_ENV: process.env.NODE_ENV,
    DEBUG: process.env.NODE_ENV === "development"
  };
}

module.exports = getPugDefines;
