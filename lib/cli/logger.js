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
        level:
          config.mode === "production"
            ? "warn"
            : config.verbose
            ? "debug"
            : "info"
      })
    ]
  });
}

function getLogger() {
  if (!ROOT_LOGGER) {
    throw new Error(`initLogging() not called.`);
  }
  return ROOT_LOGGER.child();
}

module.exports = {
  initLogging,
  getLogger
};
