const assert = require("assert");
const EventEmitter = require("events");

const col = require("colors");
const { get, set, cloneDeep } = require("lodash");
const log = require("../../logging").getLogger();

class BaseServer extends EventEmitter {
  constructor(config) {
    super(config);
    this._config = config;
    this._metrics = {};
  }

  getDependencies() {
    return [];
  }

  async run() {
    throw new Error("child class must override run()");
  }

  async close() {}

  /**
   * Wrapped version of child class's overloaded run() method.
   * Invoke this method on each class from async.auto();
   *
   * @param {*} context
   * @param {*} svcDeps
   */
  async start(svcDeps) {
    assert(!this._started, "start() already called.");
    this._started = true;
    this._svcDeps = svcDeps;
    const displayName = col.bold(this.getName());
    try {
      log.debug(`Starting service ${displayName}.`);
      await this.run(svcDeps);
    } catch (e) {
      log.error(`Service ${displayName} start failure:`, e);
      throw e;
    }

    return this;
  }

  getMetrics() {
    return cloneDeep(this._metrics);
  }

  incrementMetric(keyPath) {
    const { _metrics: metrics } = this;
    set(metrics, keyPath, get(metrics, keyPath, 0) + 1);
  }

  getConfig() {
    return cloneDeep(this._config);
  }

  getName() {
    return this.constructor.name;
  }
}

module.exports = BaseServer;
