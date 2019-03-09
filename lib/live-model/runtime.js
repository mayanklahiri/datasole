const EventEmitter = require("events");

class LiveModelRuntimeInterface extends EventEmitter {
  constructor() {
    super();
    this.ready = false;
  }

  signalReady() {
    if (!this.ready) {
      this.ready = true;
      this.send({ type: "ready" });
    }
  }

  send(msg) {
    process.send(msg);
  }
}

module.exports = new LiveModelRuntimeInterface();
