const path = require("path");

const colors = require("colors");
const { fork } = require("child_process");
const { EventEmitter } = require("events");

const logging = require("../logging");
const { appServerEntryPoint, appServerRoot } = require("../util/path-util");
const { prettyJson } = require("../util");
const { createRecursiveWatcher } = require("../util/fs-watcher");

const BACKEND_STATES = {
  NOT_STARTED: "not_started",
  STARTING: "starting",
  RUNNING: "running",
  SHUTTING_DOWN: "shutting_down",
  DEAD: "dead"
};

/**
 * Application server: runs a backend process and handles its lifecycle and external communication.
 */
class AppServer extends EventEmitter {
  constructor(config, liveModelServer) {
    super();
    this.config = config;
    this.liveModelServer = liveModelServer;
    this.backendState = BACKEND_STATES.NOT_STARTED;
    this.log = logging.getLogger();
    this.appLog = logging.getLogger("app");
    liveModelServer.on("send_to_child", this.sendMessageToChild.bind(this));
  }

  /**
   * Attempts to start the backend process.
   * @returns Promise
   */
  start() {
    const {
      paths: { appPath }
    } = this.config;
    const { log, backendState } = this;
    const appSrcPath = appServerRoot(appPath);

    if (
      backendState === BACKEND_STATES.NOT_STARTED ||
      backendState === BACKEND_STATES.DEAD
    ) {
      // Backend process can be started.
      log.info(`Watching server source directory ${appSrcPath} for changes...`);
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
    const { log } = this;

    // Kill the current backend if it is running or starting.
    if (
      this.backendState === BACKEND_STATES.STARTING ||
      this.backendState === BACKEND_STATES.RUNNING
    ) {
      log.warn("Killing current running backend.");
      await this.killBackend();
    }

    // Do nothing if backend is shutting down.
    if (this.backendState === BACKEND_STATES.SHUTTING_DOWN) {
      setTimeout(() => this.onSrcDirUpdate(pathSpec), 200);
      return Promise.resolve();
    }

    // Start a new backend.
    if (
      this.backendState === BACKEND_STATES.NOT_STARTED ||
      this.backendState === BACKEND_STATES.DEAD
    ) {
      log.info("Starting new backend process...");
      await this.forkBackend();
    }
  }

  async killBackend() {
    const { log } = this;
    const child = this.child;
    return new Promise((resolve, reject) => {
      try {
        this.backendState = BACKEND_STATES.SHUTTING_DOWN;
        child.kill();
      } catch (e) {
        log.warn(`Cannot kill child: ${e}`);
        return reject(e);
      }
      resolve();
    });
  }

  async forkBackend() {
    const { log } = this;
    if (
      this.backendState === BACKEND_STATES.STARTING ||
      this.backendState === BACKEND_STATES.RUNNING
    ) {
      // no-op
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const {
        paths: { appPath }
      } = this.config;
      const liveModelServer = this.liveModelServer;

      const appEntryPath = appServerEntryPoint(appPath);

      let child;
      try {
        // Construct an environment for the user's app backend with additional DATASOLE_ values.
        const childEnv = Object.assign({}, process.env, {
          DATASOLE_LOG_PASSTHROUGH: true,
          DATASOLE_PATH: path.resolve(__dirname, "../..")
        });

        log.debug(`Forking child at ${appEntryPath}, env ${childEnv}`);

        // Fork child.
        this.child = child = fork(appEntryPath, process.argv.slice(2), {
          cwd: process.cwd(),
          stdio: "inherit",
          env: childEnv
        });
      } catch (e) {
        log.error(`Backend fork at ${process.cwd()} failed: ${e}`, e);
        return reject(`Cannot fork backend at ${process.cwd()}: ${e}`);
      }
      this.backendState = BACKEND_STATES.STARTING;

      child.once("close", () => {
        if (
          this.backendState === BACKEND_STATES.RUNNING ||
          this.backendState === BACKEND_STATES.STARTING
        ) {
          log.error(`Backend ${child.pid} exited unexpectedly.`);
        } else {
          log.info(`Backend ${child.pid} exited as expected.`);
        }

        this.backendState = BACKEND_STATES.DEAD;
        this.liveModelServer.clearModel();
        this.liveModelServer.clearBackendPid();

        setTimeout(() => this.forkBackend(), 500);
      });

      // Wait for first "ready" message.
      child.once("message", msg => {
        if (msg.type !== "$ready") {
          return reject(
            new Error(
              `Child sent first message that was not of type="ready": ${
                msg.type
              }`
            )
          );
        }
        log.info(colors.green(`Backend process ${child.pid} is ready.`));
        this.backendState = BACKEND_STATES.RUNNING;
        liveModelServer.setBackendPid(child.pid);

        // Register to capture subsequent messages.
        child.on("message", this.onMessageFromChild.bind(this));
      });

      // Return control to caller.
      return resolve();
    });
  }

  /**
   * Triggered to handle a message sent via process.send() from the app backend child process.
   * @param {object} msg Message object received from child.
   */
  onMessageFromChild(msg) {
    const { liveModelServer, log, appLog } = this;

    log.trace(`Received message from backend: ${prettyJson(msg)}`);

    if (msg.type === "apply") {
      liveModelServer.update(msg.ops);
      return;
    }

    if (msg.type === "rpc_response") {
      liveModelServer.send(msg.clientId, msg);
      return;
    }

    if (msg.type === "log") {
      msg.payload.forEach(appLog.baseLog.bind(appLog));
      return;
    }

    log.warn(
      `Received unsupported message type "${
        msg.type
      }" from your backend program, Datasole is dropping the message.`
    );
  }

  sendMessageToChild(message, meta) {
    this.child.send({ message, meta });
  }
}

function createAppServer(...args) {
  return new AppServer(...args);
}

module.exports = {
  createAppServer
};
