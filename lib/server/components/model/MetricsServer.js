const os = require("os");

const log = require("../../../logging").getLogger();
const BaseServer = require("../BaseServer");
const { makeApplyOperation } = require("../../../protocol");
const { setKeyPath } = require("../../../live-model/mutations");

class MetricsServer extends BaseServer {
  getDependencies() {
    return ["AppServer", "WebSocketServer"];
  }

  /**
   * Service entry point.
   */
  async run(svcDeps) {
    const { _config: config } = this;
    this._svcDeps = svcDeps;
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
    const {
      WebSocketServer: websocket,
      AppServer: app,
      LiveModelServer: liveModel
    } = this._svcDeps;

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

    return metrics;
  }

  async broadcastMetrics(metricsIntervalMs) {
    const { WebSocketServer: websocket } = this._svcDeps;
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
