const { join: pathJoin } = require("path");
const { parse: urlParse } = require("url");
const { EventEmitter } = require("events");

const { applyOperations } = require("./operations");
const { jittered } = require("../util");

const BACKOFF_INITIAL_MS = 2 * 1000;
const BACKOFF_MIN_WAIT_MS = 200;
const BACKOFF_MULTIPLIER = 1.1;
const BACKOFF_MAX_JITTER_PCNT = 0.2;
const BACKOFF_MAX_WAIT_MS = 15 * 1000;
const IS_PROD = process.env.NODE_ENV === "production";

export class LiveModelClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.reset();
    this.connect();
  }

  reset() {
    this.model = {};
    this.modelStatus = {
      text: "Connecting...",
      connected: false,
      status: "connecting",
      stats: {
        msgsReceived: 0,
        opsApplied: 0,
        avgMsgSizeBytes: 0
      }
    };
  }

  updateStatus(update) {
    Object.assign(this.modelStatus, update);
    this.emit("update");
  }

  connect() {
    this.wsUrl = this.modelStatus.wsUrl = this.getWebSocketUrl();
    if (!IS_PROD) {
      console.log("Connecting to WebSocket endpoint", this.wsUrl);
    }
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
    this.modelStatus.stats.connectedAt = Date.now();
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

  onMessage(msg) {
    // Parse message packet.
    let msgPacket;
    try {
      msgPacket = JSON.parse(msg.data);
    } catch (e) {
      console.error(
        `Cannot parse incoming message: ${e}, message dropped.`,
        msg
      );
      return;
    }
    if (msgPacket.v !== 1) {
      console.error(
        `Invalid version ${msgPacket.v} on incoming message, message dropped.`,
        msgPacket
      );
      return;
    }

    // Update message stats.
    const stats = this.modelStatus.stats;
    stats.avgMsgSizeBytes = Math.round(
      (stats.avgMsgSizeBytes * stats.msgsReceived + msg.data.length) /
        (stats.msgsReceived + 1),
      0
    );
    stats.msgsReceived++;

    // Extract message payload.
    let msgPayload;
    try {
      msgPayload = JSON.parse(msgPacket.payload);
    } catch (e) {
      console.error(
        `Cannot decode incoming message payload: ${e}, message dropped.`,
        msgPacket
      );
      return;
    }

    // Apply payload to model.
    if (msgPayload.type === "apply") {
      applyOperations(this.model, msgPayload.ops);
      stats.opsApplied += msgPayload.ops.length;
    } else {
      console.error(`Unsupported payload type "${msgPayload.type}"`);
    }

    // Notify about operations applied.
    this.emit("update");
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
