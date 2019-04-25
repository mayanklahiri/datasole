const _init = require("./_init");
const { LiveModelServer } = require("../live-model/server");
const { getConfig } = require("./config");
const { startWebserver, startBackend } = require("../servers/start-servers");

const CMDLINE_ARGS_SPEC = {
  description: "Run a development webserver.",
  options: [
    // Passed individually to commander.option() as arguments
    [
      "-a, --app <name>",
      `Path to Datasole project directory (default: working directory)`
    ],
    [
      "-p, --port <n>",
      "Port for webserver to listen on (default: 8000, use 0 for random port)",
      8000
    ],
    [
      "--open",
      "Attempt to open a local browser window after starting webserver (default: false).",
      false
    ],
    ["--no-backend", "Do not run the application backend (default: false)"],
    ["--no-frontend", "Do not serve the application frontend (default: false)"],
    [
      "--url_prefix <path>",
      "Relative path prefix to serve application client at (useful when behind reverse proxy) (default: '/')",
      "/"
    ],
    [
      "--websocket_path <suffix>",
      "Path suffix for WebSocket connections (default: '__ws__').",
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
  _init(main, CMDLINE_ARGS_SPEC, process.env);
} else {
  module.exports = main;
}
