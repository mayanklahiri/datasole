const EventEmitter = require("events");
const { cloneDeep } = require("lodash");
const { applyOperations } = require("./operations");

/**
 * An object that can only be modified through a series of mutation operations that
 * are sent to the mutate() method. Emits an "mutations" event for each call to mutate()
 * for any listeners to observe, allowing model updates to be chainable.
 */
class Model extends EventEmitter {
  constructor() {
    super();
    this._model = {};
  }

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

module.exports = Model;
