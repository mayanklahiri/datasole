const prettyJson = o => JSON.stringify(o, null, 2);
const json = o => JSON.stringify(o);
const jsonparse = JSON.parse;

function jittered(value, pcntJitter) {
  return value + Math.random() * pcntJitter * value;
}

/**
 * Module wrapper of @substack's `caller.js`
 * @original: https://github.com/substack/node-resolve/blob/master/lib/caller.js
 * @blessings: https://twitter.com/eriktoth/statuses/413719312273125377
 * @see https://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
 */
function caller(depth) {
  var pst, stack, file, frame, line;

  pst = Error.prepareStackTrace;
  Error.prepareStackTrace = function(_, stack) {
    Error.prepareStackTrace = pst;
    return stack;
  };

  stack = new Error().stack;
  depth =
    !depth || isNaN(depth)
      ? 1
      : depth > stack.length - 2
      ? stack.length - 2
      : depth;
  stack = stack.slice(depth + 1);

  do {
    frame = stack.shift();
    file = frame && frame.getFileName();
    line = frame && frame.getLineNumber();
  } while (stack.length && file === "module.js");

  return `${file}:${line}`;
}

module.exports = {
  json,
  jsonparse,
  jittered,
  prettyJson,
  caller
};
