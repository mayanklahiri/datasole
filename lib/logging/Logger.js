class Logger {
  constructor(prefix) {
    this.prefix = prefix;
    this.baseLog = console;
  }

  info(...args) {
    this.baseLog.info("[info]", this.prefix, ...args);
  }
  error(...args) {
    this.baseLog.error("[error]", this.prefix, ...args);
  }
  debug(...args) {
    this.baseLog.debug("[debug]", this.prefix, ...args);
  }
}

module.exports = Logger;
