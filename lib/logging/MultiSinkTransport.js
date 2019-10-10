const EventEmitter = require("events");

const { throttle, debounce } = require("lodash");

const MIN_FLUSH_INTERVAL_MS = 500;

/**
 * Buffered, multi-sink log transporter.
 */
class MultiSinkTransport extends EventEmitter {
  constructor(config, drivers) {
    super();
    this._config = config;
    this._drivers = drivers;
    this._buffer = [];

    // Created rate-controlled flush functions.
    const { logFlushThrottleMs } = config;
    this._debounced = {
      flush: debounce(this.flush.bind(this), logFlushThrottleMs)
    };
    this._throttled = {
      flush: throttle(this.flush.bind(this), logFlushThrottleMs)
    };
  }

  startFlusher() {
    if (!this._intervalFlush) {
      const { logFlushThrottleMs } = this._config;
      const intervalMs = Math.max(
        MIN_FLUSH_INTERVAL_MS,
        logFlushThrottleMs * 2
      );
      this._intervalFlush = setInterval(this.flush.bind(this), intervalMs);
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
    this._throttled.flush();
    this._debounced.flush();
  }

  /**
   * Write accumulated buffer to log sinks.
   */
  async flush() {
    // No-op if buffer is empty.
    if (!this._buffer.length) {
      // empty buffer, no-op.
      return;
    }

    // Swap buffers before yielding event loop.
    const buffer = this._buffer;
    this._buffer = [];

    // Pass batch to each logging driver.
    return Promise.all(this._drivers.map(driver => driver.writeBatch(buffer)));
  }

  /**
   * Flush and close transport (and all underlying drivers).
   */
  async close() {
    // Stop periodic flush interval timer.
    if (this._intervalFlush) {
      clearInterval(this._intervalFlush);
      delete this._intervalFlush;
    }

    // Flush any buffered lines to drivers.
    await this.flush();

    // Close each driver and wait for "finish" event.
    return Promise.all(this._drivers.map(driver => driver.close()));
  }
}

module.exports = MultiSinkTransport;
