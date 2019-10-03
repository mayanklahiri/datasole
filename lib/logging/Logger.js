/**
 * Simple annotating logger.
 */
const path = require("path");
const { format } = require("util");

const { map } = require("lodash");
const callerFile = require("caller");

const callerSite = require("../util/caller");
const logLevels = require("./levels");

class Logger {
  constructor(loggerName, options, transport) {
    this.loggerName = loggerName;
    this.transport = transport;
    this.options = options;
    const logLevel = (this.logLevel = options.logLevel);

    // Validate and save property 'logLevel'.
    this.setLogLevel(logLevel);

    // Create logger alias functions like info(), debug(), etc.
    Object.keys(logLevels).forEach(levelName => {
      this[levelName] = (...a) =>
        this.baseLog({
          module: path.basename(callerFile()),
          caller: callerSite(),
          level: levelName,
          msgArgs: a
        });
    });
  }

  setLogLevel(logLevelStr) {
    if (!logLevels[logLevelStr] && !this.options.passthrough) {
      throw new Error(
        `Please specify a valid value for log level, received: ${logLevelStr}.`
      );
    }
    this.logLevel = logLevels[logLevelStr].level;
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
    if (this._mute) {
      // Logging is temporarily muted.
      return;
    }

    // Handle the message differently for each type.
    const { msgArgs } = logLine;
    let message;
    const firstArg = msgArgs[0];
    const stackTraces = [];
    if (typeof firstArg === "string") {
      if (msgArgs.length === 1) {
        message = firstArg;
      } else {
        message = format(...msgArgs);
      }
    } else {
      message = map(msgArgs, arg => {
        if (typeof arg === "string") {
          return arg;
        }
        if (arg instanceof Error) {
          stackTraces.push(`${firstArg.message}\n${firstArg.stack.toString()}`);
          return `${firstArg.message}`;
        }
        return JSON.stringify(arg, null, 2);
      }).join(" ");
    }

    // Annotate and push to transport.
    const annotated = {
      ts: Date.now(),
      msg: message,
      level: logLine.level.toLowerCase(),
      pid: process.pid,
      loggerName: this.loggerName,
      caller: logLine.caller
    };
    if (stackTraces.length) {
      annotated.stackTraces = stackTraces.join("\n");
    }
    this.transport.pushLine(annotated);
  }

  getTransport() {
    return this.transport;
  }

  mute() {
    this._mute = true;
  }

  unmute() {
    delete this._mute;
  }
}

module.exports = Logger;
