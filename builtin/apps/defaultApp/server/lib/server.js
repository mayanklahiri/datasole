const log = console;

function main(argv) {
  log.info("Starting up server!");
  setInterval(
    () =>
      process.send([
        {
          type: "$set",
          keyPath: "$server.junk",
          value: {
            now: Date.now(),
            random: Math.random(),
            pid: process.pid
          }
        }
      ]),
    5000
  );
}

if (require.main === module) {
  return main(process.argv.slice(2));
} else {
  module.exports = main;
}
