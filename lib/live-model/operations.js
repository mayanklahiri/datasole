const { assign, get, set, merge } = require("lodash");

function applyOperations(baseObject, opList) {
  try {
    opList.forEach(op => {
      switch (op.type) {
        case "$clearAll": {
          for (let key in baseObject) {
            baseObject[key] = null;
            delete baseObject[key];
          }
          break;
        }

        case "$set": {
          const { keyPath, value } = op;
          set(baseObject, keyPath, value);
          break;
        }

        case "$merge": {
          const { keyPath, value } = op;
          set(baseObject, keyPath, merge(get(baseObject, keyPath, {}), value));
          break;
        }

        case "$shallowAssign": {
          const { keyPath, value } = op;
          if (!keyPath) {
            Object.assign(baseObject, value);
          } else {
            set(
              baseObject,
              keyPath,
              assign(get(baseObject, keyPath, {}), value)
            );
          }
          break;
        }

        case "$circularAppend": {
          const { keyPath, value, maxSize } = op;
          const arr = get(baseObject, keyPath, []);
          if (typeof value === "object" && value.length) {
            arr.push(...value);
          } else {
            arr.push(value);
          }
          if (arr.length > maxSize) {
            arr.splice(0, arr.length - maxSize);
          }
          set(baseObject, keyPath, arr);
          break;
        }

        case "$deleteKeys": {
          const { keyPath, keyList } = op;
          const container = get(baseObject, keyPath);
          if (container && typeof container === "object") {
            keyList.forEach(key => delete container[key]);
          }
          break;
        }

        default: {
          throw new Error(`Unsupported operation: ${op.type}`);
        }
      }
    });
  } catch (e) {
    this.log.error(e);
    throw new Error(`Exception applying operation: ${e}, operation dropped.`);
  }
}

module.exports = {
  applyOperations
};
