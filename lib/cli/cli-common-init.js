/**
 * Common initialization for CLI sub-commands.
 */
function _init(mainFn) {
  Error.stackTraceLimit = 150;
  return mainFn(process.argv);
}

module.exports = {
  _init
};
