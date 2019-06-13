const path = require("path");
const col = require("colors");

const BaseDriver = require("./base-driver");

/**
 * Console colors for various logging levels.
 */
const COLORS_LEVEL = {
  info: col.white,
  warn: col.yellow,
  warning: col.yellow,
  error: col.red,
  trace: col.gray,
  debug: col.gray
};

/**
 * Console colors for various logger names.
 */
const COLORS_NAME = {
  sys: col.yellow,
  app: col.cyan
};

/**
 * Formats and writes a batch of LogLine structs to standard output.
 */
class ConsoleDriver extends BaseDriver {
  writeBatch(logLineBatch) {
    logLineBatch.forEach(logLine =>
      process.stdout.write(ConsoleDriver.consoleFormat(logLine))
    );
  }

  // Format a log line in human-readable format.
  static consoleFormat(logLine) {
    const loggerName = logLine.loggerName;
    const colFnLevel = COLORS_LEVEL[logLine.level];
    const colFnName = COLORS_NAME[loggerName];
    const shortTime = new Date(logLine.ts).toISOString();
    const callerBase =
      loggerName === "app"
        ? path.relative(process.cwd(), logLine.caller)
        : path.relative(path.resolve(__dirname, "..", ".."), logLine.caller);
    return (
      [
        col.gray(shortTime),
        `${colFnName(logLine.loggerName)}:${colFnLevel(logLine.level)}`,
        colFnLevel(`[${callerBase}]`),
        colFnLevel(logLine.message)
      ].join(" ") + "\n"
    );
  }
}

module.exports = ConsoleDriver;
