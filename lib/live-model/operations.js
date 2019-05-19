const { assign, get, set, merge } = require("lodash");

function applyOperations(baseObject, opList) {
  try {
    opList.forEach(op => {
      switch (op.type) {
        case "$clearAll": {
          for (let key in baseObject) {
            baseObject[key] = null; // trigger proxies
            delete baseObject[key];
          }
          break;
        }

        case "$set": {
          const { keyPath, value } = op;
          if (!keyPath) throw new Error("must specify a key path for $set");
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
          if (typeof value !== "object") {
            throw new Error("must specify an object value for $shallowAssign");
          }
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
          const container = keyPath ? get(baseObject, keyPath) : baseObject;
          if (container && typeof container === "object") {
            keyList.forEach(key => delete container[key]);
          }
          break;
        }

        default: {
          throw new Error(`unsupported operation: ${op.type}`);
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
