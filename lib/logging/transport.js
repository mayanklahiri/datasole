const path = require("path");
const fs = require("fs");
const EventEmitter = require("events");

const { throttle, debounce, forEach } = require("lodash");

const ConsoleDriver = require("./drivers/console");
const FileDriver = require("./drivers/file");
const PassthroughDriver = require("./drivers/passthrough");

/**
 * Buffered, multi-sink log transporter.
 */
class LoggingTransport extends EventEmitter {
  constructor(config) {
    super();
    const drivers = (this._drivers = []);
    this._buffer = [];
    this.config = config;

    // Create drivers based on config.
    if (config.getKey("logPassthrough")) {
      drivers.push(new PassthroughDriver(config));
    } else {
      if (!config.getKey("logDisableConsole")) {
        drivers.push(new ConsoleDriver(config));
      }
      if (config.getKey("logOutputPath")) {
        drivers.push(new FileDriver(config));
      }
    }

    // Propagate error events from all drivers.
    drivers.forEach(driver =>
      driver.on("error", error => this.emit.bind(this, "error"))
    );

    // Created rate-controlled flush functions.
    const { logFlushThrottleMs } = config;
    this._debouncedFlush = debounce(this.flush.bind(this), logFlushThrottleMs);
    this._throttledFlush = throttle(this.flush.bind(this), logFlushThrottleMs);
  }

  startIntervalFlusher() {
    if (!this._intervalFlush) {
      const { logFlushThrottleMs } = this.config;
      this._intervalFlush = setInterval(
        this.flush.bind(this),
        logFlushThrottleMs * 2
      );
    }
  }

  getDrivers() {
    return this._drivers;
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

    // Swap buffers before yielding event loop.
    const buffer = this._buffer;
    this._buffer = [];

    // Pass batch to each logging driver.
    this._drivers.forEach(driver => driver.writeBatch(buffer));
  }

  /**
   * Flush and close transport (and all underlying drivers).
   */
  close() {
    // Flush any buffered lines to drivers.
    this.flush();

    // Stop periodic flush interval timer.
    if (this._intervalFlush) {
      clearInterval(this._intervalFlush);
      delete this._intervalFlush;
    }

    // Close each driver and wait for "finish" event.
    return Promise.all(this._drivers.map(driver => driver.close()));
  }
}

module.exports = LoggingTransport;
