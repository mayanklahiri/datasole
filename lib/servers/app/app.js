const path = require("path");

const colors = require("colors");
const { fork } = require("child_process");

const logging = require("../../logging");
const BaseServer = require("../base");

const { appServerEntryPoint, appServerRoot } = require("../../util/path-util");
const { createRecursiveWatcher } = require("../../util/fs-watcher");

const BACKEND_STATES = {
  NOT_STARTED: "not_started",
  STARTING: "starting",
  RUNNING: "running",
  SHUTTING_DOWN: "shutting_down",
  DEAD: "dead"
};

const BACKEND_RESPAWN_TIME_MS = 3000;

/**
 * Application server: runs a backend process and handles its lifecycle and external communication.
 */
class AppServer extends BaseServer {
  constructor(config) {
    super(config);
    this._backendState = BACKEND_STATES.NOT_STARTED;
    this._appLog = logging.getLogger("app");
  }

  /**
   * Attempts to start the backend process.
   * @returns Promise
   */
  async run() {
    // Extract config properties
    const { log } = this._context;
    const { websocket } = this._svcDeps;
    const { _backendState: backendState, _config: config } = this;

    const isProduction = config.isProduction();
    const appPath = config.getCheckedKey("app");

    if (
      backendState === BACKEND_STATES.NOT_STARTED ||
      backendState === BACKEND_STATES.DEAD
    ) {
      // Backend process can be started.
      const appSrcPath = appServerRoot(appPath);
      await this.forkBackend();

      // In development mode, restart backend on source file changes.
      if (!isProduction) {
        log.info(
          `Watching server source directory ${appSrcPath} for changes...`
        );
        const fsWatcher = (this._fsWatcher = createRecursiveWatcher(
          appSrcPath
        ));
        fsWatcher.on("update", this.onSrcDirUpdate.bind(this));
      }

      // Listen for messages from the client.
      websocket.on("incoming_message", this.onMessageFromClient.bind(this));
    } else {
      // Backend is not in a startable state.
      log.warn(
        `Backend is not in a startable state: "${backendState}", ignoring start() call.`
      );
    }
  }

  /**
   * Kills backend, useful for tests.
   */
  async stop() {
    await this.killBackend();
  }

  async onSrcDirUpdate(pathSpec) {
    const { log } = this._context;

    // Kill the current backend if it is running or starting.
    if (
      this._backendState === BACKEND_STATES.STARTING ||
      this._backendState === BACKEND_STATES.RUNNING
    ) {
      log.warn(
        "Killing current running backend due to source directory update."
      );
      await this.killBackend();
    }

    // Do nothing if backend is shutting down.
    if (this._backendState === BACKEND_STATES.SHUTTING_DOWN) {
      setTimeout(() => this.onSrcDirUpdate(pathSpec), 500);
      return Promise.resolve();
    }

    // Start a new backend.
    if (
      this._backendState === BACKEND_STATES.NOT_STARTED ||
      this._backendState === BACKEND_STATES.DEAD
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
        this._backendState = BACKEND_STATES.SHUTTING_DOWN;
        child.kill();
      } catch (e) {
        log.error(`Cannot kill child: ${e}`);
        return reject(e);
      }
      resolve();
    });
  }

  async forkBackend() {
    const { _config: config } = this;
    const { log } = this._context;
    if (
      this._backendState === BACKEND_STATES.STARTING ||
      this._backendState === BACKEND_STATES.RUNNING
    ) {
      // no-op
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const appPath = config.getCheckedKey("app");
      const appEntryPath = appServerEntryPoint(appPath);

      let child;
      let resolved;
      try {
        // Construct an environment for the user's app backend with additional DATASOLE_ values.
        const childEnv = Object.assign({}, process.env, {
          DATASOLE_LOG_PASSTHROUGH: true,
          DATASOLE_PATH: path.resolve(__dirname, "../..")
        });

        log.debug(`Forking child at "${appEntryPath}"`);

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
      this._backendState = BACKEND_STATES.STARTING;

      // Handle child exit events.
      child.once("close", () => {
        if (
          this._backendState === BACKEND_STATES.RUNNING ||
          this._backendState === BACKEND_STATES.STARTING
        ) {
          log.error(`Backend ${child.pid} exited unexpectedly.`);
        } else {
          log.info(`Backend ${child.pid} exited as expected.`);
        }
        this._backendState = BACKEND_STATES.DEAD;
        if (resolved) {
          // Respawn backend.
          setTimeout(() => this.forkBackend(), BACKEND_RESPAWN_TIME_MS);
        } else {
          // Exit without initial promise resolution: app died.
          resolved = true;
          return reject(new Error(`Backend exited unexpectedly.`));
        }
      });

      // Log child process errors.
      child.on("error", e => log.error(e));

      // Listen for messages from child, special casing the first "ready" message.
      child.on("message", msg => {
        if (msg.type === "ready") {
          if (!resolved) {
            log.info(colors.green(`Backend process ${child.pid} is ready.`));
            resolved = true;
            this._backendState = BACKEND_STATES.RUNNING;
            return resolve();
          }
        } else {
          this.onMessageFromChild(msg);
        }
      });
    });
  }

  onMessageFromClient(msgPayload, msgMeta) {
    const { log } = this._context;

    if (msgPayload.type === "rpc_request") {
      // Client has sent an RPC request, forward it to the app server.
      this.sendMessageToChild(msgPayload, msgMeta);
      return;
    }

    log.warn(`Unknown message type "${msgPayload.type}" from client`, msgMeta);
  }

  /**
   * Triggered to handle a message sent via process.send() from the app backend child process.
   * @param {object} msg Message object received from child.
   */
  onMessageFromChild(msg) {
    const { log, liveModel } = this._context;
    const { _appLog: appLog } = this;
    const { websocket } = this._svcDeps;

    log.trace("Received message from backend:", msg);

    if (msg.type === "apply") {
      liveModel.mutate(msg.ops);
      websocket.broadcast(msg);
      return;
    }

    if (msg.type === "rpc_response") {
      websocket.sendOne(msg.clientId, msg);
      this.emit("rpc_response", msg);
      return;
    }

    if (msg.type === "log") {
      msg.payload.forEach(logLine => appLog.getTransport().pushLine(logLine));
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

module.exports = AppServer;
