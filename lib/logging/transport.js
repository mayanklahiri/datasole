const path = require("path");
const fs = require("fs");

const stripAnsi = require("strip-ansi");
const col = require("colors");
const { throttle, debounce, forEach } = require("lodash");

/**
 * Amount of time to wait after the last received event to trigger a flush.
 */
const FLUSH_DEBOUNCE_MS = 1000;

/**
 * Also trigger periodic flushes.
 */
const FLUSH_THROTTLE_MS = 1000;

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
 * Stdout and file multi-sink buffering log transport.
 */
class LoggingTransport {
  constructor(config) {
    const passthrough = (this._passthrough = !!config.logPassthrough);
    if (!passthrough) {
      this._logFormat = config.logFormat.toLowerCase();
      this._jsonOutput = this._logFormat === "json";
      const logOutputPath = (this._logOutputPath = config.logOutputPath);
      if (logOutputPath) {
        this._fsStream = fs.createWriteStream(logOutputPath, {
          flags: "a"
        });
      }
    }
    this._buffer = [];
    this._debouncedFlush = debounce(this.flush.bind(this), FLUSH_DEBOUNCE_MS);
    this._throttledFlush = throttle(this.flush.bind(this), FLUSH_THROTTLE_MS);
  }

  /**
   * Add a structured log line to the internal log buffer, possibly triggering a flush.
   * @param {object} logLine Structured logline.
   */
  pushLine(logLine) {
    this._buffer.push(logLine);
    this._throttledFlush();
    this._debouncedFlush();
  }

  /**
   * Write accumulated buffer to log sinks.
   */
  flush() {
    // No-op if buffer is empty.
    if (!this._buffer.length) {
      // empty buffer, no-op.
      return;
    }

    // Use process.send() if transport is in process passthrough mode.
    if (this._passthrough) {
      process.send({
        type: "log",
        payload: this._buffer
      });
      this._buffer = [];
      return;
    }

    // Format and write buffer to sinks.
    const fsStream = this._fsStream;
    const jsonOutput = !!this._jsonOutput;
    forEach(this._buffer, logLine => {
      // Always write to stdout.
      const consoleText = this.consoleFormat(logLine);
      process.stdout.write(consoleText);

      // Write to log file if set, stripping out ANSI color codes from the message.
      if (fsStream) {
        if (jsonOutput) {
          logLine.message = stripAnsi(logLine.message);
          fsStream.write(JSON.stringify(logLine) + "\n");
        } else {
          fsStream.write(consoleText);
        }
      }
    });

    // Reset buffer after write.
    this._buffer = [];
  }

  // Format a log line in human-readable format.
  consoleFormat(logLine) {
    const loggerName = logLine.loggerName.toLowerCase();
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

module.exports = LoggingTransport;
