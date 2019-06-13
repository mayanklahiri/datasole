const os = require("os");

const BaseServer = require("./base");
const { makeApplyOperation } = require("../live-model/protocol");
const { setKeyPath } = require("../live-model/mutations");

class MetricsServer extends BaseServer {
  /**
   * Service entry point.
   */
  async run() {
    const { _config: config } = this;
    const { log } = this._context;
    const metricsIntervalMs = config.getCheckedKey("metricsIntervalMs");
    if (metricsIntervalMs) {
      log.debug(
        `Starting metrics broadcast at interval ${metricsIntervalMs} ms.`
      );
      this._timeout = setTimeout(
        () => this.broadcastMetrics(metricsIntervalMs),
        metricsIntervalMs
      );
    } else {
      log.warn("Not broadcasting server-side metrics to clients.");
    }

    return Promise.resolve();
  }

  async collectMetrics() {
    const { websocket, liveModel, app } = this._svcDeps;

    const metrics = {
      snapshotTime: new Date().toISOString(),
      app: await app.getMetrics(),
      websocket: await websocket.getMetrics(),
      liveModel: await liveModel.getMetrics(),
      hostInfo: {
        serverPid: process.pid,
        backendPid: this.backendPid,
        hostname: os.hostname(),
        userInfo: os.userInfo(),
        cwd: process.cwd(),
        freeMemPcnt: Math.round((100 * os.freemem()) / os.totalmem())
      }
    };

    return Promise.resolve(metrics);
  }

  async broadcastMetrics(metricsIntervalMs) {
    const { log } = this._context;
    const { websocket } = this._svcDeps;

    const metrics = await this.collectMetrics();
    const msg = makeApplyOperation([setKeyPath("$server.metrics", metrics)]);

    try {
      await websocket.broadcast(msg);
    } catch (e) {
      log.error(`Error broadcasting server metrics: ${e}`);
      log.debug(e);
    }

    this._timeout = setTimeout(
      () => this.broadcastMetrics(metricsIntervalMs),
      metricsIntervalMs
    );
  }
}

module.exports = MetricsServer;
