const BaseDriver = require("./BaseDriver");

/**
 * Relays a batch of LogLine structs to the parent process via an object.
 */
class PassthroughDriver extends BaseDriver {
  async writeBatch(logLineBatch) {
    process.send({
      type: "log",
      payload: logLineBatch
    });
  }
}

module.exports = PassthroughDriver;
