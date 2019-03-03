const colors = require("colors");
const { fork } = require("child_process");
const { EventEmitter } = require("events");

const { appServerEntryPoint, appServerSrcRoot } = require("../util/path-util");
const { createRecursiveWatcher } = require("./fs-watcher");
const log = require("../util/logger").getLogger();

const BACKEND_STATES = {
  NOT_STARTED: "not_started",
  STARTING: "starting",
  RUNNING: "running",
  SHUTTING_DOWN: "shutting_down",
  DEAD: "dead"
};

/**
 * Application server: runs a backend process and handles its lifecycle and external communciation.
 */
class AppServer extends EventEmitter {
  constructor(config, liveModelServer) {
    super();
    this.config = config;
    this.liveModelServer = liveModelServer;
    this.backendState = BACKEND_STATES.NOT_STARTED;
  }

  /**
   * Attempts to start the backend process.
   * @returns Promise
   */
  start() {
    const {
      paths: { appPath }
    } = this.config;
    const { backendState } = this;
    const appSrcPath = appServerSrcRoot(appPath);

    if (
      backendState === BACKEND_STATES.NOT_STARTED ||
      backendState === BACKEND_STATES.DEAD
    ) {
      // Backend process can be started.
      log.info(`Watching server source directory ${appSrcPath}`);
      const fsWatcher = (this.fsWatcher = createRecursiveWatcher(appSrcPath));
      fsWatcher.on("update", this.onSrcDirUpdate.bind(this));
    } else {
      // Backend is not in a startable state.
      log.warn(
        `Backend is not in a startable state: "${backendState}", ignoring start() call.`
      );
    }

    return Promise.resolve();
  }

  async onSrcDirUpdate(pathSpec) {
    // Kill the current backend if it is running or starting.
    if (
      this.backendState === BACKEND_STATES.STARTING ||
      this.backendState === BACKEND_STATES.RUNNING
    ) {
      log.warn("Killing current running backend.");
      await this.killBackend();
    }

    // Start a new backend.
    if (
      this.backendState === BACKEND_STATES.SHUTTING_DOWN ||
      this.backendState === BACKEND_STATES.NOT_STARTED ||
      this.backendState === BACKEND_STATES.DEAD
    ) {
      log.info("Starting new backend process...");
      await this.forkBackend();
    }
  }

  async killBackend() {
    const child = this.child;
    return new Promise((resolve, reject) => {
      try {
        child.kill();
        this.backendState = BACKEND_STATES.SHUTTING_DOWN;
        child.once("close", () => {
          this.backendState = BACKEND_STATES.DEAD;
          log.info(`Backend killed successfully.`);
          this.liveModelServer.clearModel();
          return resolve();
        });
      } catch (e) {
        log.warn(`Cannot kill child: ${e}`);
        reject(e);
      }
    });
  }

  async forkBackend() {
    return new Promise((resolve, reject) => {
      const {
        paths: { appPath }
      } = this.config;
      const liveModelServer = this.liveModelServer;

      const appEntryPath = appServerEntryPoint(appPath);

      let child;
      try {
        // Fork child.
        this.child = child = fork(appEntryPath, process.argv, {
          cwd: process.cwd(),
          stdio: "inherit"
        });
      } catch (e) {
        log.error(`Backend fork at ${process.cwd()} failed: ${e}`);
        return reject(`Cannot fork backend at ${process.cwd()}: ${e}`);
      }
      this.backendState = BACKEND_STATES.STARTING;

      child.once("close", () => {
        this.backendState = BACKEND_STATES.DEAD;
        liveModelServer.clearBackendPid();
      });

      // Wait for first "ready" message.
      child.once("message", msg => {
        if (msg.type !== "ready") {
          return reject(
            new Error(
              `Child sent first message that was not of type="ready": ${
                msg.type
              }`
            )
          );
        }
        log.info(colors.green("Backend process started."));
        this.backendState = BACKEND_STATES.RUNNING;
        liveModelServer.setBackendPid(child.pid);

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
