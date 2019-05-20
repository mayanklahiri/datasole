const EventEmitter = require("events");
const mutations = require("./mutations");

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

  sendMutations(opList) {
    this.send(this.makeApplyOperation(opList));
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
          clientId: meta.clientId,
          error: `Cannot find function "${message.fnName}"`
        });
        return;
      }
      await fn(message, meta)
        .then(result =>
          this.send({
            type: "rpc_response",
            rpcId: message.rpcId,
            clientId: meta.clientId,
            result
          })
        )
        .catch(error => {
          log.warn(error);
          this.send({
            type: "rpc_response",
            rpcId: message.rpcId,
            clientId: meta.clientId,
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

  invokeRpcHandler(fnPath, ...args) {
    const rpcFn = this.rpcHandlers[fnPath];
    if (!rpcFn) {
      throw new Error(`No RPC handler for "${fnPath}" registered.`);
    }
    return rpcFn(...args);
  }

  getRpcHandler(fnPath) {
    return this.rpcHandlers[fnPath];
  }
}

Object.assign(LiveModelRuntimeInterface.prototype, require("./protocol"));

module.exports = new LiveModelRuntimeInterface();
