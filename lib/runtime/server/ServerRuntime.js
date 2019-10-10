const EventEmitter = require("events");
const {
  makeApplyOperation,
  makeReadyOperation,
  makeApiResponseJson,
  makeRpcResponse
} = require("../../protocol");

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
  async onRecvFromParent(packet) {
    const { message } = packet;
    switch (message.type) {
      case "rpc_request": {
        return await this.runRpcRequest(packet);
      }

      case "api_request": {
        return await this.runApiHandler(packet);
      }

      case "ws_auth_request": {
        return await this.runWsAuthRequestHandler(packet);
      }

      default: {
        break;
      }
    }
  }

  registerRpcHandler(fnPath, fnHandler) {
    this.rpcHandlers[fnPath] = fnHandler;
  }

  registerWsAuthHandler(fnHandler) {
    this.wsAuthHandler = fnHandler;
  }

  clearRpcHandler(fnPath) {
    delete this.rpcHandlers[fnPath];
  }

  getRpcHandler(fnPath) {
    return this.rpcHandlers[fnPath];
  }

  async runWsAuthRequestHandler({ message: wsAuthRequest }) {
    const wsAuthHandler = this.wsAuthHandler;
    if (!wsAuthHandler) {
      this.sendRaw({
        type: "ws_auth_response",
        status: 200,
        wsAuthRequest
      });
    } else {
      try {
        const result = await wsAuthHandler(wsAuthRequest);
        this.sendRaw(
          Object.assign({}, result, { type: "ws_auth_response", wsAuthRequest })
        );
      } catch (e) {
        this.sendRaw({
          type: "ws_auth_response",
          status: 500,
          error: e.message
        });
      }
    }
  }

  async runRpcRequest({ message, meta }) {
    const { rpcId } = message;
    const { clientId } = meta;

    // Retrieve RPC handler.
    const fnName = message.fnName;
    const fn = this.rpcHandlers[fnName];
    if (!fn) {
      this.sendRaw(
        makeRpcResponse(rpcId, clientId, {
          error: `Cannot find RPC function "${fnName}".`
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
          fnName
        })
      );
    }
  }

  setApiHandler(handlerFn) {
    return (this.apiHandlerFn = handlerFn);
  }

  async runApiHandler(msg) {
    let result;
    const { reqId } = msg.message;

    if (!this.apiHandlerFn) {
      result = makeApiResponseJson(reqId, 500, {
        error: "No server-side API handler registered."
      });
    } else {
      try {
        result = await this.apiHandlerFn(msg);
      } catch (e) {
        result = makeApiResponseJson(reqId, 500, {
          error: `Server-side API handler threw an error: ${e}.`
        });
      }
    }

    this.sendRaw(result);
  }
}

Object.assign(LiveModelRuntime.prototype, require("../../protocol"));

module.exports = LiveModelRuntime;
