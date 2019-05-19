/**
 * Simple annotating logger.
 */
const { format } = require("util");

const { map } = require("lodash");

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
          msgArgs: a
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

    // Handle the message differently for each type.
    const { msgArgs } = logLine;
    let message;
    if (typeof msgArgs[0] === "string") {
      if (msgArgs.length === 1) {
        message = msgArgs[0];
      } else {
        message = format(...msgArgs);
      }
    } else {
      message = map(msgArgs, arg => {
        if (typeof arg === "string") {
          return arg;
        }
        return JSON.stringify(arg, null, 2);
      }).join(" ");
    }

    // Annotate and push to transport.
    this.transport.pushLine({
      ts: Date.now(),
      message,
      level: logLine.level.toLowerCase(),
      pid: process.pid,
      loggerName: this.loggerName,
      caller: logLine.caller
    });
  }

  getTransport() {
    return this.transport;
  }
}

module.exports = Logger;
