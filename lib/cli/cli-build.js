const { _init } = require("./common-init");
const { getConfig } = require("./config");
const { wpBuild } = require("../webpack/build");
const { appClientDistPath } = require("../util/path-util");
const log = require("../util/logger").getLogger();

const CMDLINE_ARGS = {
  description:
    "Build a production-ready distribution of the client application.",
  options: [
    [
      "-a, --app <name>",
      "Name of or path to Datasole application directory",
      process.cwd()
    ],
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
  process.env.NODE_ENV = config.mode = "production";
  const distPath = appClientDistPath(config.paths.appPath);
  log.info(`Generating web distribution in ${distPath}`);
  await wpBuild(config);
}

if (require.main === module) {
  _init(main, CMDLINE_ARGS);
} else {
  module.exports = main;
}
