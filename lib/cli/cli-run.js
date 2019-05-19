const _init = require("./_init");

const CMDLINE_ARGS = {
  title: "datasole-run",
  description: "Run a production webserver (requires 'build').",
  options: require("./args-server")
};

async function main(config) {
  // Override mode to production.
  config.mode = process.env.NODE_ENV = "production";
  return require("./cli-dev")(config);
}

if (require.main === module) {
  _init(main, CMDLINE_ARGS);
} else {
  module.exports = main;
}
