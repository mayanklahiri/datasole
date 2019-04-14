/**
 * Simple annotating logger.
 */
const path = require("path");
const { format } = require("util");

const caller = require("./caller");
const logLevels = require("./levels");

class Logger {
  constructor(loggerName, options, transport) {
    this.loggerName = loggerName;
    this.transport = transport;
    const logLevel = (this.logLevel = options.logLevel);

    // Validate and save property 'logLevel'.
    if (!logLevels[logLevel] && !options.passthrough) {
      throw new Error(
        `Please specify a valid value for option "logLevel", received: ${logLevel}.`
      );
    }
    this.logLevel = logLevels[logLevel].level;

    // Create logger alias functions like info(), debug(), etc.
    Object.keys(logLevels).forEach(levelName => {
      this[levelName] = (...a) =>
        this.baseLog({
          caller: caller(1),
          level: levelName,
          message: format(...a)
        });
    });
  }

  baseLog(logLine) {
    const logLevelInt = logLevels[logLine.level].level;
    if (!logLevelInt) {
      throw new Error(
        `Unknown logging level for logline: "${logLevelInt.level}"`
      );
    }
    if (logLevelInt > this.logLevel) {
      // Line is too low-level for current logging level.
      return;
    }

    // Push to transport.
    this.transport.pushLine({
      pid: process.pid,
      loggerName: this.loggerName,
      caller: logLine.caller,
      message: logLine.message,
      level: logLine.level.toLowerCase(),
      time: Date.now()
    });
  }
}

module.exports = Logger;