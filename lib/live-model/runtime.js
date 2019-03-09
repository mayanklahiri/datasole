const EventEmitter = require("events");
const { get } = require("lodash");

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
    process.send(msg);
  }

  async onRecv(msg) {
    const { log } = this;
    if (msg.type === "rpc_request") {
      const fn = this.rpcHandlers[msg.fnName];
      if (!fn) {
        this.send({
          type: "rpc_response",
          rpcId: msg.rpcId,
          clientId: msg.clientId,
          error: `Cannot find function "${msg.fnName}"`
        });
        return;
      }
      await fn(msg)
        .then(result =>
          this.send({
            type: "rpc_response",
            rpcId: msg.rpcId,
            clientId: msg.clientId,
            result
          })
        )
        .catch(error => {
          log.warn(error);
          this.send({
            type: "rpc_response",
            rpcId: msg.rpcId,
            clientId: msg.clientId,
            error
          });
        });
      return;
    }
    log.error(`Received unknown message type "${msg.type}" from parent.`);
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

module.exports = new LiveModelRuntimeInterface();
