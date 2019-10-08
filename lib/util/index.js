const { filter, fromPairs, toPairs, get } = require("lodash");

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
    .trim()
    .split("_")
    .map((frag, idx) => {
      frag = (frag || "").toLowerCase();
      return idx ? frag.substr(0, 1).toUpperCase() + frag.substr(1) : frag;
    })
    .join("");
}

function exitWithDelay(code, delayMs) {
  setTimeout(() => process.exit(code), delayMs);
}

/**
 * Heuristics for extracting a remote client IP.
 * @param {object} req Underlying Express request object for the Websocket.
 */
function getRemoteIp(req) {
  return (
    get(req.headers, "x-forwarded-for") ||
    get(req.headers, "X-real-ip") ||
    get(req.connection, "remoteAddress") ||
    "<UNKNOWN-IP>"
  );
}

module.exports = {
  exitWithDelay,
  json,
  jittered,
  removeUndefinedValues,
  prettyJson,
  snakeToCamel,
  getRemoteIp
};
