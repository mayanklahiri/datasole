const path = require("path");

const colors = require("colors");
const caller = require("caller");
const winston = require("winston");

const LOG_LEVELS = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4
};
const LOG_COLORS = [colors.gray, colors.white, colors.yellow, colors.red];
const LOG_LEVEL = getLogLevel();

/**
 * Determine a logging level from a combination of environment variables.
 */
function getLogLevel() {
  const envLogLevel = process.env.LOGLEVEL || process.env.LOG_LEVEL;
  const envProduction = !!process.env.PRODUCTION;
  const envDebug = !!process.env.DEBUG;
  let logLevel = "info";
  if (envLogLevel) {
    logLevel = envLogLevel;
  } else {
    if (envProduction) {
      logLevel = "warn";
    } else {
      if (envDebug) {
        logLevel = "debug";
      } else {
        logLevel = "info";
      }
    }
  }
  logLevel = logLevel.toLowerCase();
  if (!LOG_LEVELS[logLevel]) {
    throw new Error(`Unknown logging level "${logLevel}".`);
  }
  return LOG_LEVELS[logLevel];
}

/**
 * Custom Winston console output transport.
 */
class FormattedLogger extends winston.Transport {
  constructor(callingModule) {
    super();
    this.callingModule = callingModule;
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit("logged", info);
    });
    const lineLevel = LOG_LEVELS[info.level];
    if (!lineLevel) {
      throw new Error(`Unknown logging level for logline: "${lineLevel}"`);
    }
    if (lineLevel < LOG_LEVEL) {
      // Line is too low-level for current logging level.
      return;
    }
    const lines = info.message.split(/\n/);
    const col = LOG_COLORS[lineLevel - 1];

    // Assemble formatted logline.
    const output = lines
      .map(line =>
        [
          `[${colors.blue(this.callingModule)}]`,
          col(info.level),
          col(line)
        ].join(" ")
      )
      .join("\n");

    console.log(output);
    return callback();
  }
}

/**
 * Retrieve a new logger for module.
 */
function getLogger() {
  const callingModule = path.basename(caller());
  const transports = [new FormattedLogger(callingModule)];
  return winston.createLogger({
    level: "debug", // Log level is handled in transport, set lowest resolution here.
    transports
  });
}

module.exports = {
  getLogger
};
