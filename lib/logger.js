const winston = require("winston");
const { format } = winston;

let ROOT_LOGGER;

function initLogging(config) {
  if (ROOT_LOGGER) {
    throw new Error(`initLogging() already called.`);
  }
  ROOT_LOGGER = winston.createLogger({
    transports: [
      new winston.transports.Console({
        format: format.combine(format.colorize(), format.simple()),
        level: config.mode === "production" ? "info" : "debug"
      })
    ]
  });
}

function getLogger(metadata) {
  if (!ROOT_LOGGER) {
    throw new Error(`initLogging() not called.`);
  }
  return ROOT_LOGGER.child(metadata);
}

module.exports = {
  initLogging,
  getLogger
};
