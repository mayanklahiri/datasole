const { get, set, merge } = require("lodash");

function applyOperations(baseObject, opList) {
  try {
    opList.forEach(op => {
      switch (op.type) {
        case "$clearAll": {
          for (let key in baseObject) {
            delete baseObject[key];
          }
          break;
        }

        case "$set": {
          set(baseObject, op.keyPath, op.value);
          break;
        }

        case "$merge": {
          const { keyPath } = op;
          set(
            baseObject,
            keyPath,
            merge(get(baseObject, keyPath, {}), op.value)
          );
          break;
        }

        case "$shallowAssign": {
          Object.assign(baseObject, op.value);
          break;
        }

        case "$circularAppend": {
          const arr = get(baseObject, op.keyPath) || [];
          if (arr.length >= op.maxSize) {
            arr.splice(0, 1);
          }
          arr.push(op.value);
          set(baseObject, op.keyPath, arr);
          break;
        }

        default: {
          throw new Error(`Unsupported operation: ${op.type}`);
        }
      }
    });
  } catch (e) {
    throw new Error(`Exception applying operation: ${e}, operation dropped.`);
  }
}

module.exports = {
  applyOperations
};
