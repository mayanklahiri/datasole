const stableJson = require("json-stable-stringify");
const prettyJson = o => JSON.stringify(o, null, 2);
const json = o => stableJson(o);
const jsonparse = JSON.parse;

function jittered(value, pcntJitter) {
  return value + Math.random() * pcntJitter * value;
}

module.exports = {
  json,
  jsonparse,
  jittered,
  prettyJson
};
