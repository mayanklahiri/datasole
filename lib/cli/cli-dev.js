const _init = require("./_init");
const { autoPromise } = require("../util/auto");

const {
  LiveModelServer,
  HttpServer,
  ExpressServer,
  WebSocketServer,
  AppServer
} = require("../servers");

const CMDLINE_ARGS = {
  title: "datasole-dev",
  description: "Run a development webserver.",
  options: require("./args-server")
};

async function main(config) {
  const servers = {
    liveModel: new LiveModelServer(config),
    http: new HttpServer(config),
    web: ["http", "liveModel", new ExpressServer(config)],
    websocket: ["web", new WebSocketServer(config)],
    app: ["liveModel", new AppServer(config)]
  };
  return await autoPromise(servers, "start");
}

if (require.main === module) {
  _init(main, CMDLINE_ARGS);
} else {
  module.exports = main;
}
