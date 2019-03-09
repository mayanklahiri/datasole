const crypto = require("crypto");
const { join: pathJoin } = require("path");
const { parse: urlParse } = require("url");
const { EventEmitter } = require("events");

const { applyOperations } = require("./operations");
const { parseMessagePacket } = require("./protocol");
const { json, jittered } = require("../util");

const BACKOFF_INITIAL_MS = 2 * 1000;
const BACKOFF_MIN_WAIT_MS = 200;
const BACKOFF_MULTIPLIER = 1.1;
const BACKOFF_MAX_JITTER_PCNT = 0.2;
const BACKOFF_MAX_WAIT_MS = 15 * 1000;
const RPC_TIMEOUT_MS = 5 * 1000;
const IS_PROD = process.env.NODE_ENV === "production";

export class LiveModelClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.reset();
    this.connect();
    this.log = console;
  }

  reset() {
    this.model = {};
    this.rpcPromises = {};
    this.modelStatus = {
      text: "Connecting...",
      connected: false,
      status: "connecting",
      metrics: {
        msgsReceived: 0,
        opsApplied: 0,
        avgMsgSizeBytes: 0
      }
    };
  }

  connect() {
    this.wsUrl = this.modelStatus.wsUrl = this.getWebSocketUrl();
    if (!IS_PROD) {
      console.log("Connecting to WebSocket endpoint", this.wsUrl);
    }
    this.updateStatus({
      text: "Connecting to server...",
      connected: false,
      status: "connecting"
    });
    try {
      const ws = (this.ws = new WebSocket(this.wsUrl));
      ws.onopen = this.onConnected.bind(this);
      ws.onerror = this.onError.bind(this);
      ws.onclose = this.onClose.bind(this);
      ws.onmessage = this.onMessage.bind(this);
    } catch (e) {
      try {
        this.ws.close();
      } catch (e) {}
      delete this.ws;
      this.onError(new Error(`Cannot create connection: ${e}`));
    }
  }

  onConnected() {
    if (!IS_PROD) {
      console.log("Connected to server.");
    }
    this.modelStatus.metrics.connectedAt = Date.now();
    this.updateStatus({
      text: "Connected.",
      connected: true,
      status: "connected",
      reconnect: {}
    });
  }

  onError(e) {
    this.updateStatus({
      text: "Error with WebSocket connection.",
      connected: false,
      status: "error",
      error: e.message
    });
  }

  onClose() {
    // Update reconnection parameters for exponential backoff.
    const reconnParams = this.modelStatus.reconnect || {};
    if (!reconnParams.waitMs) {
      reconnParams.waitMs = jittered(
        BACKOFF_INITIAL_MS,
        BACKOFF_MAX_JITTER_PCNT
      );
    } else {
      reconnParams.waitMs *= BACKOFF_MULTIPLIER;
    }
    reconnParams.waitMs = Math.floor(
      Math.max(
        BACKOFF_MIN_WAIT_MS,
        Math.min(BACKOFF_MAX_WAIT_MS, reconnParams.waitMs)
      )
    );
    reconnParams.nextAttemptAt = Date.now() + reconnParams.waitMs;
    reconnParams.count = (reconnParams.count || 0) + 1;
    this.modelStatus.reconnect = reconnParams;

    // Initiate connection retry.
    if (!IS_PROD) {
      console.log(
        `Disconnected, retrying connection after ${reconnParams.waitMs} ms...`
      );
    }
    this.reconnTimeout = setTimeout(() => {
      delete this.reconnTimeout;
      this.connect();
    }, reconnParams.waitMs);

    // Send status update.
    this.updateStatus({
      text: "WebSocket connection dropped, reconnecting...",
      connected: false,
      status: "connecting"
    });
  }

  send(msgPayload) {
    const { log } = this;
    if (typeof msgPayload !== "string") {
      throw new Error(
        `Can only send non-null string, got ${typeof msgPayload}.`
      );
    }
    try {
      this.ws.send(msgPayload);
    } catch (e) {
      log.warn(
        `Cannot send message "${msgPayload.substr(0, 100)}" to server `,
        e
      );
    }
  }

  /**
   * Incoming Websocket message from the server.
   * @param {object} msgEvt Websocket message event.
   */
  onMessage(msgEvt) {
    const { log } = this;
    const rawMsgStr = msgEvt.data;

    // Decode
    let msgPayload;
    try {
      msgPayload = parseMessagePacket(rawMsgStr);
    } catch (e) {
      log.warn(
        `Received invalid message from the server: ${e}, message dropped.`,
        rawMsgStr
      );
      return;
    }

    // Update message metrics.
    const metrics = (this.modelStatus.metrics = this.modelStatus.metrics || {});
    metrics.avgMsgSizeBytes = Math.round(
      (metrics.avgMsgSizeBytes * metrics.msgsReceived + rawMsgStr.length) /
        (metrics.msgsReceived + 1),
      0
    );
    metrics.msgsReceived++;

    // Resolve RPC promise.
    if (msgPayload.type === "rpc_response") {
      const { rpcId, error, result } = msgPayload;
      if (this.rpcPromises[rpcId]) {
        // Request has not timed out.
        const { resolve, reject } = this.rpcPromises[rpcId];
        delete this.rpcPromises[rpcId];
        log.debug(`RPC ${rpcId}: error=${error} result=${result}`);
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      } else {
        // RPC has timed out.
        log.warn(`Got result for timed-out RPC ${rpcId}, dropping message.`);
      }
      return; // no model updates emitted.
    }

    // Apply payload to model.
    if (msgPayload.type === "apply") {
      applyOperations(this.model, msgPayload.ops);
      metrics.opsApplied += msgPayload.ops.length;
    } else {
      log.error(`Unsupported payload type "${msgPayload.type}"`, msgPayload);
      return;
    }

    // Notify about operations applied.
    this.emit("update");
  }

  updateStatus(update) {
    Object.assign(this.modelStatus, update);
    this.emit("update");
  }

  /**
   * Invokes a server-side function and returns a promise for its result.
   */
  invokeRpc(remoteFnName, remoteFnArgs) {
    const { log } = this;
    const rpcId = crypto.randomBytes(6).toString("hex");
    log.debug(
      `RPC ${rpcId}: invoking server-side function "${remoteFnName}"`,
      remoteFnArgs
    );
    return new Promise((resolve, reject) => {
      try {
        this.send(
          json({
            v: 1,
            payload: json({
              type: "rpc_request",
              rpcId,
              fnName: remoteFnName,
              fnArgs: remoteFnArgs
            })
          })
        );
      } catch (e) {
        log.error(`Cannot invoke RPC function "${remoteFnName}": ${e}`);
        return reject(e);
      }
      this.rpcPromises[rpcId] = { resolve, reject };
      setTimeout(() => {
        if (this.rpcPromises[rpcId]) {
          // RPC invocation has timed out.
          const err = new Error(
            `RPC ${rpcId}: invoking server-side function "${remoteFnName}" timed out after ${RPC_TIMEOUT_MS} ms.`
          );
          log.warn(err.message);
          delete this.rpcPromises[rpcId];
          return reject(err);
        }
      }, RPC_TIMEOUT_MS);
    });
  }

  /**
   * Inspects window.location to assemble a reasonable WebSocket URL.
   */
  getWebSocketUrl() {
    const parsedUrl = urlParse(window.location.href);
    const wsProto = parsedUrl.protocol.replace(/http/, "ws");
    const wsRootPath = CONFIG.server.urlRootPath;
    const wsRelPrefix = CONFIG.server.urlWsRelPath;
    const wsUrl =
      wsProto + "//" + pathJoin(parsedUrl.host, wsRootPath, wsRelPrefix);
    return wsUrl;
  }

  /**
   * Get stable reference to internal model.
   * @returns {object} Model
   */
  getModel() {
    return this.model;
  }

  getModelStatus() {
    return this.modelStatus;
  }
}
