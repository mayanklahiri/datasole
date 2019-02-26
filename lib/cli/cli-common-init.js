const commander = require("commander");

/**
 * Common initialization for CLI sub-commands.
 */
function _init(mainFn, cmdlineArgs) {
  Error.stackTraceLimit = 150;
  commander.description(cmdlineArgs.description);
  cmdlineArgs.options.forEach(optSpec => commander.option(...optSpec));
  commander.parse(process.argv);
  return mainFn(commander);
}

module.exports = {
  _init
};
