const readline = require("readline");
const log = console;

const IMAGE_NAMES = ["farmland", "wheat", "tractor", "windmill", "field"];

function choice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function main(argv) {
  const sendFn = process.send.bind(process) || console.log;

  // Send ready command.
  sendFn({
    type: "ready"
  });

  // Send model cleanup.
  sendFn({
    type: "apply",
    ops: [{ type: "$clearAll" }]
  });

  // Send junk periodically.
  setInterval(() => {
    const imageList = [1, 2, 3, 4].map(() => choice(IMAGE_NAMES));

    process.send({
      type: "apply",
      ops: [
        {
          type: "$set",
          keyPath: "junk",
          value: {
            now: Date.now(),
            random: Math.random(),
            pid: process.pid
          }
        },
        {
          type: "$set",
          keyPath: "imageList",
          value: imageList
        }
      ]
    });
  }, 500);

  // Read standard input lines and stream to circular buffer.
  const rl = readline.createInterface({
    input: process.stdin
  });
  rl.on("line", line => {
    process.send({
      type: "apply",
      ops: [
        {
          type: "$circularAppend",
          keyPath: "stdin.lines",
          value: line,
          maxSize: 100
        }
      ]
    });
  });
}

if (require.main === module) {
  return main(process.argv.slice(2));
} else {
  module.exports = main;
}
