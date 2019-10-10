const _init = require("./_init");

async function main(config) {
  // Override mode to production.
  config.setKey(
    "mode",
    (process.env.NODE_ENV = process.env.PRODUCTION = "production")
  );

  // Rebuild required?
  if (config.getKey("rebuild")) {
    await require("./cli-build")(config);
  }

  return require("./cli-dev")(config);
}

if (require.main === module) {
  _init(main, require("./args-run"));
} else {
  module.exports = main;
}
