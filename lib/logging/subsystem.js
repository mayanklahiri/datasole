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
    const config = (this.config_ = Object.assign(
      {},
      DEFAULTS,
      new EnvMapper(env).getLoggingConfig()
    ));
    this.transport_ = new LoggingTransport(this.config_);
    this.loggers_ = {
      sys: new Logger("sys", { logLevel: config.logLevelSys }, this.transport_),
      app: new Logger("app", { logLevel: config.logLevelApp }, this.transport_)
    };
  }

  getTransport() {
    return this.transport_;
  }

  getLogger(loggerName) {
    loggerName = loggerName || DEFAULT_LOGGER_NAME;
    const logger = this.loggers_[loggerName];
    if (!logger) {
      throw new Error(`Unable to find logger "${loggerName}".`);
    }
    return logger;
  }
}

module.exports = LoggingSubsystem;
