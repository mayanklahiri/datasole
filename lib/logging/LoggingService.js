const EventEmitter = require("events");

const { forEach } = require("lodash");

const Config = require("../config/Config");
const Logger = require("./Logger");
const MultiSinkTransport = require("./MultiSinkTransport");
const ConsoleDriver = require("./drivers/ConsoleDriver");
const FileDriver = require("./drivers/FileDriver");
const PassthroughDriver = require("./drivers/PassthroughDriver");

const DEFAULT_LOG_STREAM = "sys";

/**
 * Logging singleton exported by index.js.
 *
 * Until "init" is called, logging is in test mode (console output).
 */
class LoggingService extends EventEmitter {
  constructor(config) {
    super();
    this.setConfig(config);
  }

  /**
   * Update logging service configuration dynamically.
   * @param {object} config
   */
  setConfig(config) {
    const drivers = [];

    // Use default config if 'config' is null.
    config = config || new Config();

    // Create drivers according to config.
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

    // Create transport and loggers.
    const transport = (this._transport = new MultiSinkTransport(
      config,
      drivers
    ));

    const logLevelSys = config.getCheckedKey("logLevelSys");
    const logLevelApp = config.getCheckedKey("logLevelApp");

    this._loggers = {
      sys: new Logger("sys", { logLevel: logLevelSys }, transport),
      app: new Logger("app", { logLevel: logLevelApp }, transport)
    };

    transport.startFlusher();
  }

  /**
   * Gets a Logger instance.
   * @param {string} loggerName Logger name: usually "sys" or "app"
   */
  getLogger(loggerName) {
    loggerName = loggerName || DEFAULT_LOG_STREAM;
    const logger = this._loggers[loggerName];
    if (!logger) {
      throw new Error(`Unable to find logger "${loggerName}".`);
    }
    return logger;
  }

  /**
   * Close transport and flush any remaining log lines.
   */
  async close() {
    await this._transport.close();
    this.emit("close");
  }

  /**
   * Retrieves current transport instance.
   */
  getTransport() {
    return this._transport;
  }

  /**
   * Temporarily drop logging output.
   */
  mute() {
    forEach(this._loggers, logger => logger.mute());
  }

  /**
   * Resume logging after being muted.
   */
  unmute() {
    forEach(this._loggers, logger => logger.unmute());
  }
}

module.exports = LoggingService;
