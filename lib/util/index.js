const { filter, fromPairs, toPairs } = require("lodash");

const prettyJson = o => JSON.stringify(o, null, 2);
const json = o => JSON.stringify(o);
const jsonparse = JSON.parse;

function jittered(value, pcntJitter) {
  return value + Math.random() * pcntJitter * value;
}

function removeUndefinedValues(obj) {
  return fromPairs(
    filter(toPairs(obj), ([_, value]) => typeof value !== "undefined")
  );
}

module.exports = {
  json,
  jsonparse,
  jittered,
  removeUndefinedValues,
  prettyJson
};
