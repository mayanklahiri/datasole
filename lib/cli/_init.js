const col = require("colors");
const commander = require("commander");

const logging = require("../logging");
const EnvMapper = require("./env-mapper");

/**
 * Common initialization for CLI sub-commands.
 */
async function _init(mainFn, { title, description, options }, env) {
  const log = logging.getLogger();

  // Set process title if specified.
  process.title = title || process.title;
  log.debug(`Datasole process ${process.pid} (${process.title}) started.`);

  // Set maximum number of lines in JS runtime stack trace.
  Error.stackTraceLimit = 100;

  // Parse selected environment variables.
  const envMapper = new EnvMapper(env);

  // Initialize logging subsystem.
  if (envMapper.areColorsDisabled()) {
    col.disable();
  }

  // Flush logs before exit.
  process.once("exit", () => logging.getTransport().flush());

  // Set sub-command description for help messages.
  commander.description(description);

  // Register sub-command options.
  options.forEach(optSpec => commander.option(...optSpec));

  // Parse arguments
  commander.parse(process.argv);
  await mainFn(commander, envMapper).catch(e => {
    log.error(`Cannot execute subcommand:`, e);
    log.error(`Process ${process.pid}: exiting with code 1.`);
    return process.exit(1);
  });
}

module.exports = _init;
