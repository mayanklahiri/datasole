function clearAll() {
  return {
    type: "$clearAll"
  };
}

function setKeyPath(keyPath, value) {
  return {
    type: "$set",
    keyPath,
    value
  };
}

function mergeKeyPath(keyPath, value) {
  return {
    type: "$merge",
    keyPath,
    value
  };
}

function shallowAssignKeyPath(keyPath, value) {
  return {
    type: "$shallowAssign",
    keyPath,
    value
  };
}

function circularAppendKeyPath(keyPath, value, maxSize) {
  return {
    type: "$circularAppend",
    keyPath,
    value,
    maxSize
  };
}

function deleteKeys(keyPath, keyList) {
  return {
    type: "$deleteKeys",
    keyPath,
    keyList
  };
}

module.exports = {
  setKeyPath,
  mergeKeyPath,
  clearAll,
  shallowAssignKeyPath,
  circularAppendKeyPath,
  deleteKeys
};
