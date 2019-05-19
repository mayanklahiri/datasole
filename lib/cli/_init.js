const col = require("colors");
const commander = require("commander");

const { getConfig } = require("./config");
const logging = require("../logging");
const EnvMapper = require("./env-mapper");

// Set maximum number of lines in JS runtime stack trace.
Error.stackTraceLimit = 100;

/**
 * Common CLI entry point for all sub-commands.
 * @param {function} mainFn Post-initialization function to invoke with command config.
 * @param {object} argSpec Command line argument specification.
 * @param {array.<string>} argv Unparsed command line arguments.
 * @param {object} env Environment variables.
 */
async function _init(mainFn, argSpec, argv = process.argv, env = process.env) {
  const { title, description, options } = argSpec;

  // Parse command-line arguments.
  commander.description(description);
  options.forEach(optSpec => commander.option(...optSpec));
  commander.parse(argv);

  // Parse selected environment variables.
  const envMapper = new EnvMapper(env);

  // Derive complete process configuration from arguments and environment.
  const config = getConfig(commander, envMapper);

  // Configure logging.
  const log = logging.getLogger();

  // Set process title if specified.
  if (title || config.procInfo.title) {
    process.title = title || config.procInfo.title;
  }
  log.debug(`Datasole process ${process.pid} (${process.title}) started.`);

  // Flush logs before exit.
  process.once("exit", () => logging.getTransport().flush());

  // Disable ANSI colors.
  if (!config.cli.colors) {
    col.disable();
  }

  // Execute subcommand main() function.
  await mainFn(config).catch(e => {
    log.error(`Cannot execute subcommand: ${col.bold(e.message)}`);
    log.debug(e);
    log.error(`Process ${process.pid}: exiting with code 1.`);
    return process.exit(1);
  });
}

module.exports = _init;
