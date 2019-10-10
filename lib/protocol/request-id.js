function genRequestId() {
  return 1 + Math.floor(Math.random() * (Number.MAX_SAFE_INTEGER - 1));
}

module.exports = { genRequestId };
