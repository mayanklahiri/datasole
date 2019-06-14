const assert = require("assert");

const { auto } = require("async");
const { mapValues, isArray, clone } = require("lodash");

const DEFAULT_RUN_CONCURRENCY = 10;

/**
 * Runs async.auto() on a dependency graph, passing each called function
 * an additional, shared context object in addition to the usual async.auto()
 * runtime dependencies.
 */
exports.runDepGraph = async function runDepGraph(
  depGraph,
  context = {},
  boundMethod = "run",
  concurrency = DEFAULT_RUN_CONCURRENCY
) {
  const boundGraph = mapValues(depGraph, (rhs, lhs) => {
    if (isArray(rhs)) {
      // Clone so as not to replace the existing object in the array with a bound function.
      rhs = clone(rhs);
    } else {
      // Allow convenience macro for converting naked objects to an array without dependencies.
      rhs = [rhs];
    }
    assert(
      rhs.length,
      `Entry "${lhs}" is not a valid async.auto-style dependency array.`
    );
    const classInst = rhs[rhs.length - 1];
    rhs[rhs.length - 1] = async (...args) =>
      classInst[boundMethod](context, ...args);
    return rhs;
  });

  return auto(boundGraph, concurrency);
};
