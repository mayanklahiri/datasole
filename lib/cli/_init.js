const col = require("colors");
const commander = require("commander");

/**
 * Common initialization for CLI sub-commands.
 */
async function _init(mainFn, cmdlineArgs) {
  Error.stackTraceLimit = 150;
  commander.description(cmdlineArgs.description);
  cmdlineArgs.options.forEach(optSpec => commander.option(...optSpec));
  commander.parse(process.argv);
  process.title = commander.title || process.title;
  try {
    await mainFn(commander);
  } catch (e) {
    console.error(
      `${col.dim(process.title)}: ${col.red(e.message)}\n${col.gray(
        e.stack.toString()
      )}`
    );
    return process.exit(1);
  }
}

module.exports = _init;
