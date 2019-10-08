const { cloneDeep } = require("lodash");
const { applyOperations } = require("../../../live-model/operations");
const BaseServer = require("../BaseServer");

class LiveModelServer extends BaseServer {
  constructor(...args) {
    super(...args);
    this._model = {};
  }

  async run() {}

  /**
   * Gets a shared reference to the current model (UNSAFE).
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
  mutate(opList) {
    applyOperations(this._model, opList);
    this.emit("mutations", opList);
  }

  /**
   * Get current metrics about the data model.
   */
  getMetrics() {
    return {
      modelSizeChars: JSON.stringify(this._model).length
    };
  }
}

module.exports = LiveModelServer;
