const EventEmitter = require("events");

/**
 * Runs inside the user server application, provides convenience functions.
 */
class LiveModelRuntimeInterface extends EventEmitter {
  constructor() {
    super();
    this.log = console;
    this.ready = false;
    this.rpcInFlight = {};
    this.rpcHandlers = {};
    process.on("message", this.onRecv.bind(this));
  }

  signalReady() {
    if (!this.ready) {
      this.ready = true;
      this.send({ type: "ready" });
    }
  }

  send(msg) {
    if (arguments.length > 1) {
      const error = new Error(`send() must be called with exactly 1 argument.`);
      this.log.error(error);
      throw error;
    }
    process.send(msg);
  }

  async onRecv(msg) {
    const { log } = this;
    const { message, meta } = msg;
    if (message.type === "rpc_request") {
      const fn = this.rpcHandlers[message.fnName];
      if (!fn) {
        this.send({
          type: "rpc_response",
          rpcId: message.rpcId,
          clientId: message.clientId,
          error: `Cannot find function "${message.fnName}"`
        });
        return;
      }
      await fn(message, meta)
        .then(result =>
          this.send({
            type: "rpc_response",
            rpcId: message.rpcId,
            clientId: message.clientId,
            result
          })
        )
        .catch(error => {
          log.warn(error);
          this.send({
            type: "rpc_response",
            rpcId: message.rpcId,
            clientId: message.clientId,
            error
          });
        });
      return;
    }
    log.error(`Received unknown message type "${message.type}" from parent.`);
  }

  registerRpcHandler(fnPath, fnHandler) {
    this.rpcHandlers[fnPath] = fnHandler;
  }

  clearRpcHandler(fnPath) {
    delete this.rpcHandlers[fnPath];
  }

  getRpcHandler(fnPath) {
    return this.rpcHandlers[fnPath];
  }
}

Object.assign(LiveModelRuntimeInterface.prototype, require("./protocol"));

module.exports = new LiveModelRuntimeInterface();
