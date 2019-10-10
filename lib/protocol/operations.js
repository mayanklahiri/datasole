/**
 * Wraps a sequence of mutation operations in an "apply" message type.
 *
 * @param {Array.<object>} ops Sequence of apply operations.
 */
function makeApplyOperation(ops) {
  if (typeof ops !== "object" || !ops.length) {
    throw new Error(`Require a non-empty array.`);
  }
  return {
    type: "apply",
    ops
  };
}

function makeReadyOperation() {
  return { type: "ready" };
}

module.exports = {
  makeApplyOperation,
  makeReadyOperation
};
