function main() {
  process.send && process.send({ type: "ready" }); // Send a "ready" packet to parent runtime.
}

if (require.main === module) {
  return main();
} else {
  module.exports = main;
}
