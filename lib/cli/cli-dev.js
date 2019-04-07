const _init = require("./_init");
const { LiveModelServer } = require("../live-model/server");
const { getConfig } = require("./config");
const { startWebserver, startBackend } = require("./start-servers");

const CMDLINE_ARGS = {
  description: "Run a development webserver.",
  options: [
    ["-a, --app <name>", "Name of or path to Datasole application directory"],
    [
      "-p, --port <n>",
      "Port for webserver to listen on (use 0 for random port)",
      8000
    ],
    [
      "--no-open",
      "Do not attempt to open a local browser window after starting webserver."
    ],
    ["--no-backend", "Do not run the application backend"],
    ["--no-frontend", "Do not serve the application frontend"],
    [
      "--url_prefix <path>",
      "Relative path prefix to serve application client at (useful when behind reverse proxy)",
      "/"
    ],
    [
      "--websocket_path <suffix>",
      "Path suffix for WebSocket connections.",
      "__ws__"
    ]
  ]
};

async function main(args) {
  const config = getConfig(args);
  const liveModelServer = (this.liveModelServer = new LiveModelServer(config));
  if (config.cli.frontend) {
    await startWebserver(config, liveModelServer);
  }
  if (config.cli.backend) {
    await startBackend(config, liveModelServer);
  }
}

if (require.main === module) {
  _init(main, CMDLINE_ARGS);
} else {
  module.exports = main;
}
