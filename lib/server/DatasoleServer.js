const log = require("../logging").getLogger();
const EventEmitter = require("events");
const col = require("colors");
const { auto } = require("async");
const { fromPairs, map, mapValues } = require("lodash");
const { pkgJson } = require("../util/path-util");

/**
 * A Datasole composite server that listens on an HTTP port.
 */
class DatasoleServer extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.components = this.createComponents();
  }

  /**
   * Start listening on configured port (includes HTTP and Websocket handlers).
   */
  async start() {
    const { components } = this;
    const depGraph = mapValues(components, inst => [
      ...inst.getDependencies(),
      async deps => inst.start(deps)
    ]);
    await auto(depGraph, 1); // 1 = start components serially
    await this.components.HttpServer.listen();
    this.printFriendlyMessage();
  }

  /**
   * Creates a component graph depending on the configuration.
   *
   * @param {object} config Config object
   */
  createComponents() {
    const { config } = this;

    // Lazy-load modules.
    const components = [
      require("./components/model/LiveModelServer"),
      require("./components/web/HttpServer"),
      require("./components/web/WebSocketServer")
    ];

    // Serve client bundle or webpack-dev-server if option "disableFrontend" is not set.
    if (!config.getKey("disableFrontend")) {
      components.push(
        config.isProduction()
          ? require("./components/web/WebServer")
          : require("./components/web/WebDevServer")
      );
    }

    // Start backend application server if "disableBackend" is not set.
    if (!config.getKey("disableBackend")) {
      // Lazy-load AppServer only if required (may load Webpack unnecessarily otherwise,
      // slowing server start time).
      components.push(
        ...[
          require("./components/app/AppServer"),
          require("./components/model/MetricsServer")
        ]
      );
    }

    // Instantiate component map.
    const instances = map(components, Clazz => new Clazz(config));
    return fromPairs(map(instances, inst => [inst.getName(), inst]));
  }

  printFriendlyMessage() {
    const { config } = this;
    const version = `node:${col.bold(
      process.versions.node
    )} datasole:${col.bold(pkgJson().version)}`;
    const msg = [
      col.bold(col.green(`Server process ${process.pid} started.`)),
      "=================================================================",
      `Endpoint: ${col.green(col.bold(this.getEndpoint()))}`,
      `Mode:     ${col.bold(config.getMode())}`,
      `Versions: ${version}`,
      "================================================================="
    ].join("\n");

    log.info(msg);
  }

  getEndpoint() {
    return this.components.HttpServer.getLocalUrl();
  }
}

module.exports = DatasoleServer;
