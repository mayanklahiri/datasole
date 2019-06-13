const BaseDriver = require("./base-driver");

/**
 * Relays a batch of LogLine structs to the parent process via an object.
 */
class PassthroughDriver extends BaseDriver {
  writeBatch(logLineBatch) {
    process.send({
      type: "log",
      payload: logLineBatch
    });
  }
}

module.exports = PassthroughDriver;
