const HttpServer = require("./http");
const ExpressServer = require("./express");
const WebSocketServer = require("./websocket");

exports.createServers = function createServers(config) {
  const isProduction = config.isProduction();

  const serverGraph = {
    // Base Express server, always required.
    express: new ExpressServer(config),

    // HTTP server containing a listen() method.
    http: ["express", new HttpServer(config)],

    // Base Websocket server, always required.
    websocket: ["http", new WebSocketServer(config)]
  };

  // Do not serve client bundle if option "disableFrontend" is set.
  if (!config.getKey("disableFrontend")) {
    // require() is in the conditional to lazy-load only one module.
    serverGraph.webserver = [
      "express",
      isProduction
        ? new (require("./web-prod"))(config)
        : new (require("./web-dev"))(config)
    ];
  }

  // Do not start backend application server if "disableBackend" is set.
  if (!config.getKey("disableBackend")) {
    const AppServer = require("./app");
    const MetricsServer = require("./metrics");
    serverGraph.app = ["websocket", new AppServer(config)];
    serverGraph.metrics = ["websocket", "app", new MetricsServer(config)];
  }

  return serverGraph;
};
