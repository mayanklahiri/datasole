const EnvMapper = require("../cli/env-mapper");
const Logger = require("./logger");
const LoggingTransport = require("./transport");

const DEFAULTS = {
  logLevelSys: "info",
  logLevelApp: "info",
  logOutputPath: null,
  logFormat: "text",
  logPassthrough: false // internal option
};

const DEFAULT_LOGGER_NAME = "sys";

/**
 * Singleton created at first require.
 */
class LoggingSubsystem {
  constructor(env) {
    // Configure logging subsystem solely from environment variables.
    const config = (this._config = Object.assign(
      {},
      DEFAULTS,
      new EnvMapper(env).getLoggingConfig()
    ));
    this._transport = new LoggingTransport(this._config);
    this._loggers = {
      sys: new Logger("sys", { logLevel: config.logLevelSys }, this._transport),
      app: new Logger("app", { logLevel: config.logLevelApp }, this._transport)
    };
  }

  getTransport() {
    return this._transport;
  }

  getLogger(loggerName) {
    loggerName = loggerName || DEFAULT_LOGGER_NAME;
    const logger = this._loggers[loggerName];
    if (!logger) {
      throw new Error(`Unable to find logger "${loggerName}".`);
    }
    return logger;
  }
}

module.exports = LoggingSubsystem;
