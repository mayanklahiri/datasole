const { mutations, runtime, log } = require(process.env.DATASOLE_PATH);

function main() {
  log.info("Application starting.");

  runtime.sendMutations([
    mutations.clearAll(),
    mutations.setKeyPath("app_info", {
      pid: process.pid,
      cwd: process.cwd(),
      argv: process.argv
    })
  ]);

  // Inform datasole that application is ready.
  runtime.signalReady();
}

if (require.main === module) {
  main();
} else {
  module.exports = main;
}
