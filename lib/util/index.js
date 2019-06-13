const { filter, fromPairs, toPairs } = require("lodash");

const prettyJson = o => JSON.stringify(o, null, 2);
const json = o => JSON.stringify(o);

function jittered(value, pcntJitter) {
  return value + Math.random() * pcntJitter * value;
}

function removeUndefinedValues(obj) {
  return fromPairs(
    filter(toPairs(obj), ([_, value]) => typeof value !== "undefined")
  );
}

function snakeToCamel(snakeStr) {
  return snakeStr
    .split("_")
    .map((frag, idx) => {
      frag = frag.toLowerCase();
      return idx ? frag[0].toUpperCase() + frag.substr(1) : frag;
    })
    .join("");
}

function exitWithDelay(code, delayMs) {
  setTimeout(() => process.exit(code), delayMs);
}

module.exports = {
  exitWithDelay,
  json,
  jittered,
  removeUndefinedValues,
  prettyJson,
  snakeToCamel
};
