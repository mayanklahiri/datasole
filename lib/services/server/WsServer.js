const crypto = require("crypto");
const express = require("express");
const ws = require("ws");

const BaseService = require("../base/BaseService");
const { json, socksend, jsonparse } = require("../../util");

class WsServer extends BaseService {
  /**
   * Create and start a new WebSocket server on a random port.
   */
  start() {
    // Alias object properties to locals.
    const { log, config } = this;
    const {
      paths: { staticRoot, templateRoot }
    } = config;

    if (this.status) {
      throw new Error(`WebSocker server already started.`);
    }
    this.status = this.STATUS.STARTING;

    // Create an http.Server instance listening on a random port using Express.
    const app = express();
    app.use(express.static(staticRoot));
    app.set("view engine", "pug");
    app.set("views", templateRoot);
    app.get("/", (req, res) => {
      const locals = {
        config,
        req: {
          url: req.url,
          query: req.query,
          headers: req.headers
        }
      };
      res.render("index", {
        serverJson: json(locals)
      });
    });
    app.use((req, res) => res.redirect("/"));
    const server = app.listen(8080);

    // Attach a WebSocket server the http.Server instance returned by Express.
    const wss = (this.wss = new ws.Server({ server, path: "/__ws__" }));
    wss.on("error", this.onError.bind(this));
    wss.on("listening", this.onListening.bind(this));
    wss.on("connection", this.onConnection.bind(this));
  }

  /**
   * Event handler for WebSocket server error.
   * @param {*} error
   */
  onError(error) {
    log.error(`Error event received: ${error}`, error);
  }

  /**
   * Event handler for WebSocket server listening.
   */
  onListening() {
    const { log, config } = this;
    const listenPort = this.wss.address().port;
    const url = `http://127.0.0.1:${listenPort}/`;
    const wsUrl = `ws://127.0.0.1:${listenPort}/__ws__`;
    Object.assign(config.procInfo, {
      url,
      wsUrl
    });
    log.info(`Server listening at ${url}`);
    this.status = this.STATUS.READY;
  }

  /**
   * Event handler for new WebSocket connections.
   */
  onConnection(socket, req) {
    const { log } = this;
    req = req || {};

    // Retrieve and save remote client identifiers.
    const remoteClient = {
      clientId: crypto.randomBytes(8).toString("hex"),
      connected: new Date().toISOString(),
      remoteIp: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      headers: jsonparse(json(req.headers))
    };

    log.info(
      `New connection ${remoteClient.clientId} from ${remoteClient.remoteIp}`
    );
    socksend(socket, {
      $op: "assign",
      $val: {
        server: {
          remoteClient
        }
      }
    });

    const intervalId = setInterval(() => {
      socket.send(
        json({
          serverNow: Date.now()
        })
      );
    }, 991);

    socket.once("close", () => {
      clearInterval(intervalId);
      log.info(
        `Lost connection ${remoteClient.clientId} from ${remoteClient.remoteIp}`
      );
    });

    socket.on("error", () => {
      log.info("error on conenction");
    });
  }
}

module.exports = CONSTANTS => new WsServer(CONSTANTS);
