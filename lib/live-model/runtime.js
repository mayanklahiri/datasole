const EventEmitter = require("events");
const {
  makeApplyOperation,
  makeReadyOperation,
  makeRpcResponse
} = require("./protocol");

/**
 * Runs inside the user server application, provides convenience functions.
 */
class LiveModelRuntime extends EventEmitter {
  constructor() {
    super();
    this.log = console;
    this.ready = false;
    this.rpcHandlers = {};
    process.on("message", this.onRecvFromParent.bind(this));
  }

  /**
   * Tell the Datasole parent process that the backend is ready.
   */
  signalReady() {
    if (!this.ready) {
      this.ready = true;
      this.sendRaw(makeReadyOperation());
    }
  }

  /**
   * Send a raw message to the parent.
   * @private
   */
  sendRaw(msg) {
    if (arguments.length !== 1) {
      throw new Error(`sendRaw() must be called with exactly 1 argument.`);
    }
    process.send(msg);
  }

  /**
   * Sends a set of mutations to apply to the model.
   * @param {array} opList Mutation operations.
   */
  sendMutations(opList) {
    return this.sendRaw(makeApplyOperation(opList));
  }

  /**
   * Event handler for receiving a message from the Datasole parent.
   * @param {object} msg Received message
   * @private
   */
  async onRecvFromParent(msg) {
    const { message, meta } = msg;
    const { rpcId } = message;
    const { clientId } = meta;

    switch (message.type) {
      case "rpc_request": {
        // Retrieve RPC handler.
        const fnName = message.fnName;
        const fn = this.rpcHandlers[fnName];
        if (!fn) {
          this.sendRaw(
            makeRpcResponse(rpcId, clientId, {
              error: `Cannot find function "${fnName}".`
            })
          );
          return;
        }

        // Execute handler on function and return result.
        try {
          const result = await fn(message, meta);
          this.sendRaw(
            makeRpcResponse(rpcId, clientId, {
              result
            })
          );
        } catch (e) {
          this.sendRaw(
            makeRpcResponse(rpcId, clientId, {
              error: `Error executing RPC function "${fnName}": ${e}`,
              stack: e.stack.toString(),
              fnName
            })
          );
        }
        return;
      }

      default: {
        this.emit(
          "error",
          `Received unknown message type "${message.type}" from parent.`
        );
        break;
      }
    }
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

Object.assign(LiveModelRuntime.prototype, require("./protocol"));

module.exports = LiveModelRuntime;
