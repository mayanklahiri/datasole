const SECONDS = 1000;

const MODE =
  process.env.NODE_ENV === "production"
    ? "production"
    : process.env.PRODUCTION
    ? "production"
    : "development";

/**
 * These values can be set by a corresponding environment variable
 * prefixed with "DATASOLE_". For example, set the 'disableFrontend' flag below
 * by setting the environment variable "DATASOLE_DISABLE_BACKEND" to the string "true".
 */
module.exports = {
  /**
   * Datasole mode: 'development' or 'production'
   */
  mode: MODE,

  /**
   * REST API URL path (relative).
   */
  apiUrl: "/api/v1",

  /**
   * API request timeout (seconds).
   */
  apiTimeoutSec: MODE === "production" ? 60 : 5,

  /**
   * Path to Datasole project root.
   */
  app: process.cwd(),

  /**
   * Console colors.
   */
  colors: true,

  /**
   * Hostname to listen on (0.0.0.0 = all intefaces).
   */
  listenAddress: "0.0.0.0",

  /**
   * Server listen port (0 = random).
   */
  port: 8000,

  /**
   * Disable client distribution serving.
   */
  disableFrontend: false,

  /**
   * Disable server application.
   */
  disableBackend: false,

  /**
   * Process information.
   */
  procInfo: {
    title: process.title,
    nodeVersion: process.version,
    datasoleVersion: require("../../package.json").version,
    started: Date.now()
  },

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
  logPassthrough: false,

  /**
   * Root URL path to assume.
   */
  urlRootPath: "/",

  /**
   * Websocket endpoint suffix to urlRootPath.
   */
  websocketPath: "__ws__",

  /**
   * Enable authorization mode for WebSocket connections.
   */
  websocketAuth: true,

  /**
   * Timeout for WebSocket auth handler.
   */
  websocketAuthTimeoutMs: 30 * SECONDS,

  /**
   * Default static distribution URL path suffix
   */
  staticUrl: "/",

  /**
   * Interval at which to broadcast server metrics (0 = disabled)
   */
  metricsIntervalMs: 5 * SECONDS
};
