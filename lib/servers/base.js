const assert = require("assert");
const EventEmitter = require("events");

const col = require("colors");
const { cloneDeep } = require("lodash");

class BaseServer extends EventEmitter {
  constructor(config) {
    super(config);
    this._config = config;
    this._metrics = {};
  }

  getName() {
    return this.constructor.name;
  }

  async start(context, svcDeps) {
    assert(!this._context, "Context present, start() already called.");
    this._context = context;
    this._svcDeps = svcDeps;
    const { log } = context;
    const displayName = col.bold(this.getName());
    log.debug(`Starting service ${displayName}.`);

    try {
      await this.run();
      log.debug(`Service ${displayName} started OK.`);
    } catch (e) {
      log.error(`Service ${displayName} start failure:`, e);
      return Promise.reject(e);
    }

    return Promise.resolve(this);
  }

  async run() {
    return Promise.reject(new Error("child class must override run()"));
  }

  getMetrics() {
    return Promise.resolve(cloneDeep(this._metrics));
  }
}

module.exports = BaseServer;
