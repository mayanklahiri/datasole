const _init = require("./_init");
const log = require("../logging").getLogger();

async function main(config) {
  try {
    // Lazy-load DataSoleServer after setting logging config.
    const DatasoleServer = require("../server");
    await new DatasoleServer(config).start();
  } catch (e) {
    log.error(`Server start error: ${e}`, e);
    return process.exit(1);
  }
}

if (require.main === module) {
  _init(main, require("./args-dev"));
} else {
  module.exports = main;
}
