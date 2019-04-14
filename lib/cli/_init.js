const col = require("colors");
const commander = require("commander");

const logging = require("../logging");
const EnvMapper = require("./env-mapper");

/**
 * Common initialization for CLI sub-commands.
 */
async function _init(mainFn, { title, description, options }, env) {
  // Set process title if specified.
  process.title = title || process.title;

  // Set maximum number of lines in JS runtime stack trace.
  Error.stackTraceLimit = 100;

  // Parse selected environment variables.
  const envMapper = new EnvMapper(env);

  // Initialize logging subsystem.
  if (envMapper.areColorsDisabled()) {
    col.disable();
  }
  const log = logging.getLogger();

  // Set sub-command description for help messages.
  commander.description(description);

  // Register sub-command options.
  options.forEach(optSpec => commander.option(...optSpec));

  // Parse arguments
  commander.parse(process.argv);
  try {
    return await mainFn(commander, envMapper);
  } catch (e) {
    log.error(`Cannot execute subcommand:`, e);
    return process.exit(1);
  }
}

module.exports = _init;
