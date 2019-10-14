const { runtime, log } = require(process.env.DATASOLE_PATH);

function main() {
  // Inform datasole that application is ready.
  runtime.signalReady();
  log.info("Server application started.");
}

if (require.main === module) {
  main();
} else {
  module.exports = main;
}
