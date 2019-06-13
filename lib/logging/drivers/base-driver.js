const assert = require("assert");
const EventEmitter = require("events");

class BaseDriver extends EventEmitter {
  constructor(config) {
    super(config);
    this.config = config;
    assert(
      typeof this.writeBatch === "function",
      `Must override writeBatch() in child class ${this.constructor.name}`
    );
  }

  close() {
    return Promise.resolve();
  }
}

module.exports = BaseDriver;
