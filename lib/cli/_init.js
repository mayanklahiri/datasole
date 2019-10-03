const col = require("colors");
const commander = require("commander");
const minimist = require("minimist");
const { map, fromPairs, filter } = require("lodash");
const logging = require("../logging");
const Config = require("../config");
const { prettyJson, snakeToCamel, exitWithDelay } = require("../util");

// Set maximum number of lines in JS runtime stack trace.
Error.stackTraceLimit = 100;

// Wait before exiting to prevent process flapping.
const EXIT_DELAY_MS = 2000;

/**
 * Common CLI entry point for all sub-commands.
 * @param {function} mainFn Post-initialization function to invoke with command config.
 * @param {object} argSpec Command line argument specification.
 * @param {array.<string>} argv Unparsed command line arguments.
 * @param {object} env Environment variables.
 */
async function _init(mainFn, argSpec, argv = process.argv, env = process.env) {
  const { description, options } = argSpec;

  // Parse command-line arguments for subcommand.
  commander.description(description);
  options.forEach(optSpec => commander.option(...optSpec));
  commander.parse(argv);
  const args = fromPairs(
    filter(
      map(minimist(argv.slice(2)), (val, key) => {
        if (key !== "_") {
          return [snakeToCamel(key), val];
        }
      })
    )
  );

  // Derive process configuration from arguments and environment.
  let config;
  try {
    config = new Config(env, args);
  } catch (e) {
    console.error(`Datasole: cannot validate configuration: ${e.message}`);
    console.debug(e.stack);
    return exitWithDelay(1, EXIT_DELAY_MS);
  }

  // Disable ANSI colors if requested.
  if (config.getEnvMapper().areAnsiColorsDisabled()) {
    col.disable();
  }

  // Initialize logging.
  logging.setConfig(config);
  const log = logging.getLogger("sys");
  log.debug(`Datasole configuration: ${prettyJson(config.getConfig())}`);

  // Process cleanup handler.
  log.debug(`Datasole process ${process.pid} started with valid config.`);
  process.once("exit", code => {
    const message = `Datasole process ${
      process.pid
    } exiting with code ${code}.`;

    code ? log.error(message) : log.debug(message);
    logging.close();
  });

  // Execute subcommand's main() function.
  await mainFn(config).catch(e => {
    log.error(
      `datasole: cannot execute subcommand "${col.bold(
        mainFn.name
      )}": ${col.bold(e.message)}`
    );
    log.warn(e.stack);
    return exitWithDelay(1, EXIT_DELAY_MS);
  });
}

module.exports = _init;
