const { cloneDeep } = require("lodash");

const BaseSever = require("./base");
const { applyOperations } = require("../live-model/operations");
const { makeApplyOperation } = require("../live-model/protocol");

class LiveModelServer extends BaseSever {
  /**
   * Service entry point.
   */
  run() {
    this._model = {};
    const { log } = this._context;
    log.debug("Empty new model created.");
    return Promise.resolve();
  }

  /**
   * Gets a shared reference to the current model.
   *
   * @returns {object} Current model reference, be aware of mutations to this object.
   */
  getModelUnsafe() {
    return this._model;
  }

  /**
   * Gets a deep clone of the model.
   *
   * @returns {object} Deep clone of the model.
   */
  getModelSafe() {
    return cloneDeep(this._model);
  }

  /**
   * Applies a sequence of operations to the model as a transaction,
   * and emits an update event when the operations have all been applied.
   *
   * @param {Array.<object>} opList A sequence of operations to apply to the model in order.
   */
  update(opList) {
    // Apply the operations in sequence to the model.
    applyOperations(this._model, opList);

    // Broadcast the initial operations.
    this.emit("broadcast", makeApplyOperation(opList));
  }

  async getMetrics() {
    const metrics = {
      modelSizeChars: JSON.stringify(this._model).length
    };
    return Promise.resolve(metrics);
  }
}

module.exports = LiveModelServer;
