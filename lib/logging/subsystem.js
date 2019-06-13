const assert = require("assert");
const EventEmitter = require("events");
const Config = require("../config");
const Logger = require("./logger");
const LoggingTransport = require("./transport");

const DEFAULT_LOG_STREAM = "sys";

/**
 * Singleton created at first require.
 */
class LoggingSubsystem extends EventEmitter {
  init(config) {
    config = this._config = config || new Config(process.env);

    // Create unified logging transport.
    const transport = (this._transport = new LoggingTransport(config));
    transport.on("error", this.emit.bind(this, "error"));

    // Create log streams.
    this._loggers = {
      sys: new Logger(
        "sys",
        { logLevel: config.getCheckedKey("logLevelSys") },
        transport
      ),
      app: new Logger(
        "app",
        { logLevel: config.getCheckedKey("logLevelApp") },
        transport
      )
    };

    // Flag that is set after first getLogger() call.
    this._loggingUsed = false;

    return this;
  }

  getConfig() {
    return this._config.getConfig();
  }

  getTransport() {
    return this._transport;
  }

  getLogger(loggerName) {
    assert(
      this._loggers,
      `Must call logging.init() to initialize logging subsystem.`
    );
    loggerName = loggerName || DEFAULT_LOG_STREAM;
    const logger = this._loggers[loggerName];
    if (!logger) {
      throw new Error(`Unable to find logger "${loggerName}".`);
    }
    if (!this._loggingUsed) {
      this.getTransport().startIntervalFlusher();
      this._loggingUsed = true;
    }
    return logger;
  }

  async close() {
    await this.getTransport().close();
  }
}

module.exports = LoggingSubsystem;
