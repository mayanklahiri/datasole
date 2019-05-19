const AppServer = require("./app");
const LiveModelServer = require("./live-model");
const HttpServer = require("./http");
const ExpressServer = require("./express");
const WebSocketServer = require("./websocket");
const MetricsServer = require("./metrics");

exports.createServers = function createServers(config) {
  return {
    liveModel: new LiveModelServer(config),
    express: ["liveModel", new ExpressServer(config)],
    http: ["express", new HttpServer(config)],
    websocket: ["http", "liveModel", new WebSocketServer(config)],
    app: ["liveModel", "websocket", new AppServer(config)],
    metrics: ["liveModel", "websocket", "app", new MetricsServer(config)]
  };
};
