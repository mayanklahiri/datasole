const { runtime, log } = require(process.env.DATASOLE_PATH);

function main() {
  // Inform datasole that application is ready.
  runtime.signalReady();

  // Keep event loop alive.
  setInterval(() => {
    log.info(`Backend process ${process.pid} is alive...`);
  }, 4000);
}

if (require.main === module) {
  main();
} else {
  module.exports = main;
}
