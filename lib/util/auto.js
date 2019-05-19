const assert = require("assert");
const { callbackify, promisify } = require("util");

const { auto } = require("async");
const { mapValues, isArray, clone } = require("lodash");

/**
 * Runs async.auto() on a dependency graph, passing each called function
 * an additional, shared context object in addition to the usual async.auto()
 * runtime dependencies.
 */
exports.autoPromise = async function autoPromise(
  depGraph,
  boundMethod = "run",
  concurrency = 1,
  context = {}
) {
  const boundGraph = mapValues(depGraph, (rhs, lhs) => {
    if (isArray(rhs)) {
      // Clone so as not to replace the existing object in the array with a bound function.
      rhs = clone(rhs);
    } else {
      // Convenience macro for converting naked objects to an array without dependencies.
      rhs = [rhs];
    }
    assert(
      rhs.length,
      `Entry "${lhs}" is not a valid async.auto-style dependency array.`
    );
    const inst = rhs[rhs.length - 1];
    rhs[rhs.length - 1] = callbackify(inst[boundMethod].bind(inst, context));
    return rhs;
  });

  return promisify(auto)(boundGraph, concurrency);
};
