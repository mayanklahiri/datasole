const commander = require("commander");
const { _init } = require("./cli-common-init");
const { getLogger } = require("./logger");
const { prettyJson } = require("../util");

commander
  .description("Initialize a new project in a directory.")
  .option("--server", "Generate application server stub.", true)
  .option("--client", "Generate application client stub.", true);

function main(argv) {
  commander.parse(argv);

  const log = getLogger();
  log.info("Arse, I'm here!");
  log.debug(`Debug`);
  log.warn(`warn`);
  log.error("aeiroeairoea");
  return process.exit(0);
}

if (require.main === module) {
  _init(main);
} else {
  module.exports = main;
}
