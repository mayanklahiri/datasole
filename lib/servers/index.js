const AppServer = require("./app");
const HttpServer = require("./http");
const ExpressServer = require("./express");
const WebSocketServer = require("./websocket");
const MetricsServer = require("./metrics");

exports.createServers = function createServers(config) {
  return {
    express: new ExpressServer(config),
    http: ["express", new HttpServer(config)],
    websocket: ["http", new WebSocketServer(config)],
    app: ["websocket", new AppServer(config)],
    metrics: ["websocket", "app", new MetricsServer(config)]
  };
};
