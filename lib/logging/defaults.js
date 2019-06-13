module.exports = {
  /**
   * Log level for "sys" logger.
   */
  logLevelSys: "info",

  /**
   * Log level for "app" logger.
   */
  logLevelApp: "info",

  /**
   * Output log format: "text" or "json"
   */
  logFormat: "text",

  /**
   * Disk output file path for logs.
   */
  logOutputPath: null,

  /**
   * Set to true to disable console output.
   */
  logDisableConsole: false,

  /**
   * Time to wait after the last received logline to trigger a flush.
   */
  logFlushDebounceMs: 500,

  /**
   * Interval at which to invoke periodic flushes in the case of a constant log stream.
   */

  logFlushThrottleMs: 1000,

  /**
   * Used internally by Datasole
   */
  logPassthrough: false
};
