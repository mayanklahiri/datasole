/**
 * Simple annotating logger.
 */

const path = require("path");
const { format } = require("util");

const color = require("colors");

const caller = require("./caller");

const LOG_LEVELS = {
  error: {
    level: 1,
    color: color.red
  },
  warn: {
    level: 2,
    color: color.yellow
  },
  info: {
    level: 3,
    color: color.white
  },
  debug: {
    level: 4,
    color: color.gray
  }
};

class FormattedLogger {
  constructor() {
    this.logLevel = this.getLogLevel();
    Object.keys(LOG_LEVELS).forEach(logLevel => {
      this[logLevel] = (...a) =>
        this.log({
          level: logLevel,
          message: format(...a)
        });
    });
  }

  log(info) {
    const lineLevel = LOG_LEVELS[info.level].level;

    if (!lineLevel) {
      throw new Error(`Unknown logging level for logline: "${info.level}"`);
    }

    if (lineLevel > this.logLevel) {
      // Line is too low-level for current logging level.
      return;
    }

    const callingLocation = path.basename(caller(2));
    const lines = info.message.split(/\n/);
    const col = LOG_LEVELS[info.level].color;
    const processId = `${process.title}:${process.pid}`;

    // Assemble formatted logline.
    const output = lines
      .map(line =>
        [
          `${col.dim(processId)}: [${color.dim(col(callingLocation))}]`,
          color.dim(col(info.level)) + ":",
          col(line)
        ].join(" ")
      )
      .join("\n");

    // Write logs
    console.log(output);
  }

  /**
   * Determine a logging level from a combination of environment variables.
   */
  getLogLevel() {
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
    if (!LOG_LEVELS[logLevel]) {
      throw new Error(`Unknown logging level "${logLevel}".`);
    }
    return LOG_LEVELS[logLevel].level;
  }
}

/**
 * Retrieve a new logger for module.
 */
function getLogger() {
  return new FormattedLogger();
}

module.exports = {
  getLogger
};
