const commander = require("commander");
const { _init } = require("./cli-common-init");
const { getLogger } = require("./logger");
const { prettyJson } = require("../util");

commander
  .description("Initialize a new project in a directory.")
  .option("--server", "Generate application server stub.", true)
  .option("--client", "Generate application client stub.", true)
  .parse(process.argv);

function main(config) {
  const log = getLogger();
  log.info("Arse, I'm here!");
  log.debug(`Config: ${prettyJson(config)}`);
  return process.exit(0);
}

if (require.main === module) {
  _init(main, commander);
} else {
  module.exports = main;
}
