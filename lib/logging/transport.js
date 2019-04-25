const path = require("path");
const fs = require("fs");

const stripAnsi = require("strip-ansi");
const col = require("colors");
const { throttle, debounce, map } = require("lodash");

/**
 * Amount of time to wait after the last received event to trigger a flush.
 */
const FLUSH_DEBOUNCE_MS = 1000;

/**
 * Also trigger periodic flushes for long bursts.
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
  sys: col.magenta,
  app: col.cyan
};

class LoggingTransport {
  constructor(config) {
    const passthrough = (this.passthrough_ = !!config.logPassthrough);
    if (!passthrough) {
      this.logFormat_ = config.logFormat.toLowerCase();
      const logOutputPath = (this.logOutputPath_ = config.logOutputPath);
      if (logOutputPath) {
        this.fsStream_ = fs.createWriteStream(logOutputPath, {
          flags: "a"
        });
      }
    }
    this.buffer_ = [];
    this.debouncedFlush_ = debounce(this.flush.bind(this), FLUSH_DEBOUNCE_MS);
    this.throttledFlush_ = throttle(this.flush.bind(this), FLUSH_THROTTLE_MS);
  }

  pushLine(logLine) {
    this.buffer_.push(logLine);
    this.throttledFlush_();
    this.debouncedFlush_();
  }

  consoleFormat(logLine) {
    const loggerName = logLine.loggerName.toLowerCase();
    const colFnLevel = COLORS_LEVEL[logLine.level];
    const colFnName = COLORS_NAME[loggerName];
    const shortTime = new Date(logLine.ts).toISOString();
    const callerBase =
      loggerName === "app"
        ? path.relative(process.cwd(), logLine.caller)
        : path.relative(path.resolve(__dirname, "..", ".."), logLine.caller);
    return [
      col.gray(shortTime),
      `${colFnName(logLine.loggerName)}:${colFnLevel(logLine.level)}`,
      colFnLevel(`[${callerBase}]`),
      colFnLevel(logLine.msg)
    ].join(" ");
  }

  flush() {
    if (!this.buffer_.length) {
      // empty buffer, no-op.
      return;
    }

    if (this.passthrough_) {
      process.send({
        type: "log",
        payload: this.buffer_
      });
    } else {
      const jsonOutput = this.logFormat_ === "json";
      const outBuffer =
        map(this.buffer_, logLine => {
          if (jsonOutput) {
            logLine.msg = stripAnsi(logLine.msg);
            return JSON.stringify(logLine);
          } else {
            return this.consoleFormat(logLine);
          }
        }).join("\n") + "\n";

      if (this.fsStream_) {
        this.fsStream_.write(outBuffer);
      } else {
        process.stdout.write(outBuffer);
      }
    }

    this.buffer_.splice(0, this.buffer_.length);
  }
}

module.exports = LoggingTransport;
