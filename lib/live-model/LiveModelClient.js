const { merge, set } = require("lodash");

const path = require("path");
const url = require("url");
const EventEmitter = require("events");

class LiveModelClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.model = {};
    this.modelStatus = {
      text: "Connecting...",
      connected: false
    };
    this.connect();
  }

  updateStatus(update) {
    Object.assign(this.modelStatus, merge(this.modelStatus, update));
    this.emit("update");
  }

  connect() {
    // Create connection.
    this.wsUrl = this.modelStatus.wsUrl = this.getWebSocketUrl();
    console.log("Connecting to WebSocket endpoint", this.wsUrl);
    const ws = (this.ws = new WebSocket(this.wsUrl));
    ws.onopen = this.onConnected.bind(this);
    ws.onerror = this.onError.bind(this);
    ws.onclose = this.onClose.bind(this);
    ws.onmessage = this.onMessage.bind(this);
  }

  onConnected() {
    console.log("Connected to server Websocket.");
    this.updateStatus({
      text: "Connected.",
      connected: true
    });
  }

  onError() {
    console.error("Error on Websocket connection.");
    this.updateStatus({
      text: "Error with WebSocket connection.",
      connected: false
    });
  }

  onClose() {
    console.error("Websocket connection closed.");
    this.updateStatus({
      text: "WebSocket connection dropped.",
      connected: false
    });
  }

  onMessage(msg) {
    const { payload } = JSON.parse(msg.data);
    console.log("Message incoming", payload);
    const model = this.model;
    payload.forEach(op => {
      switch (op.type) {
        case "$set": {
          set(model, op.keyPath, op.value);
          break;
        }

        default: {
          throw new Error(`Unsupported operation: ${op.type}`);
        }
      }
    });
    this.emit("update");
  }

  /**
   * Inspects window.location to assemble a reasonable WebSocket URL.
   */
  getWebSocketUrl() {
    const parsedUrl = url.parse(window.location.href);
    const wsProto = parsedUrl.protocol.replace(/http/, "ws");
    const wsRootPath = CONFIG.server.urlRootPath;
    const wsRelPrefix = CONFIG.server.urlWsRelPath;
    const wsUrl =
      wsProto + "//" + path.join(parsedUrl.host, wsRootPath, wsRelPrefix);
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

module.exports = LiveModelClient;
