const { fork } = require("child_process");
const { EventEmitter } = require("events");

const { appServerEntryPoint } = require("../util/path-util");
const log = require("../cli/logger").getLogger();

class AppServer extends EventEmitter {
  constructor(config, liveModelServer) {
    super();
    this.config = config;
    this.liveModelServer = liveModelServer;
  }

  start() {
    const {
      paths: { appPath }
    } = this.config;

    const appEntryPath = appServerEntryPoint(appPath);
    const liveModelServer = this.liveModelServer;

    // Attempt to fork the backend app.
    return new Promise((resolve, reject) => {
      try {
        // Fork child.
        const child = fork(appEntryPath, process.argv, {
          cwd: appPath,
          stdio: "inherit"
        });

        // Wait for first "ready" message.
        let ready = false;
        child.once("message", msg => {
          if (msg.type !== "ready") {
            return reject(
              new Error(
                `Child sent first message that was not type "ready": ${
                  msg.type
                }`
              )
            );
          }
          log.info("Backend is ready...");

          // Register to capture subsequent messages.
          child.on("message", msg => {
            if (msg.type !== "apply") {
              log.warn(
                `Received unsupported message type "${
                  msg.type
                }" from backend, dropping message.`
              );
              return;
            }
            liveModelServer.update(msg.ops);
          });
        });
      } catch (e) {
        log.error(`Cannot fork child at ${appEntryPath}: ${e}`);
        return reject(e);
      }

      // Return control to caller.
      return resolve();
    });
  }
}

function createAppServer(...args) {
  return new AppServer(...args);
}

module.exports = {
  createAppServer
};
