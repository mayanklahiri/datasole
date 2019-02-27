const os = require("os");
const readline = require("readline");
const log = console;

const IMAGE_NAMES = ["aurora", "field", "horses", "skier", "ocean", "plants"];

function choice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function main(argv) {
  const sendFn = process.send.bind(process) || console.log;

  // Send ready command.
  sendFn({
    type: "ready"
  });

  // Send model cleanup to clear out any stale data in the client.
  sendFn({
    type: "apply",
    ops: [{ type: "$clearAll" }]
  });

  // Maintain and rotate an order for the demo images.
  const imageIndices = [0, 1, 2, 3];
  const imageList = imageIndices.map(() => choice(IMAGE_NAMES));
  setInterval(() => {
    // Pick and replace a random image.
    const swapIdx = choice(imageIndices);
    imageList[swapIdx] = choice(IMAGE_NAMES);

    // Send the new order of demo images to all clients.
    process.send({
      type: "apply",
      ops: [
        {
          type: "$set",
          keyPath: "imageList",
          value: imageList
        }
      ]
    });
  }, 1000);

  // Periodically broadcast server metrics.
  setInterval(() => {
    process.send({
      type: "apply",
      ops: [
        {
          type: "$set",
          keyPath: "$server",
          value: {
            metrics: {
              snapshotTime: new Date().toISOString(),
              freeMem: os.freemem(),
              totalMem: os.totalmem()
              //numConnections: size(this.connections)
            },
            meta: {
              pid: process.pid
            }
          }
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
