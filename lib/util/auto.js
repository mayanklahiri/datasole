const assert = require("assert");
const { promisify } = require("util");

const { auto } = require("async");
const { map, last, isArray, clone } = require("lodash");

exports.autoPromise = async function(
  depGraph,
  boundMethod = "run",
  concurrency = 1
) {
  const boundGraph = map(depGraph, (rhs, lhs) => {
    if (!isArray(rhs)) {
      rhs = [rhs];
    } else {
      rhs = clone(rhs);
    }
    assert(
      rhs.length,
      `Entry "${lhs}" is not a valid async.auto-style dependency array.`
    );
    const inst = last(rhs);
    rhs[rhs.length - 1] = inst[boundMethod].bind(inst);
    return rhs;
  });

  return promisify(auto)(boundGraph, concurrency);
};
