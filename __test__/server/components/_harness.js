const path = require("path");
const WebSocket = require("ws");
const { defer } = require("lodash");

const requireLib = p => require(path.resolve(__dirname, `../../../lib/${p}`));
const requireResolveLib = p =>
  require.resolve(path.resolve(__dirname, `../../../lib/${p}`));
const requireRoot = p => require(path.resolve(__dirname, `../../../${p}`));
const log = requireLib("logging").getLogger();
const Config = requireLib("config/Config");
const HttpServer = requireLib("server/components/web/HttpServer");
const LiveModelServer = requireLib("server/components/model/LiveModelServer");
const WebSocketServer = requireLib("server/components/web/WebSocketServer");

/**
 * Create an HTTP server on a random port.
 * @param {?object} config Config overrides.
 * @returns {Server} Listening HTTP server.
 */
async function createServer(overrides) {
  const config = Object.assign({}, overrides, {
    port: 0
  });
  const server = new HttpServer(new Config(config));
  await expect(server.start()).resolves.toBe(server);
  expect(() => server.getLocalUrl()).toThrow(/not listening/i);
  return server;
}

/**
 * Create an HTTP and Websocket server on a random port.
 * @param {?object} config Config overrides.
 * @returns {Server} Listening HTTP server.
 */
async function createServerWithWebsocket(overrides) {
  const config = new Config(Object.assign({}, overrides, { port: 0 }));

  // Manual dependency creation.

  // LiveModelServer
  const liveModelServer = new LiveModelServer(config);
  await expect(liveModelServer.start()).resolves.toBe(liveModelServer);

  // HttpServer
  const httpServer = new HttpServer(config);
  await expect(httpServer.start()).resolves.toBe(httpServer);

  // WebSocketServer
  const svcDeps = {
    HttpServer: httpServer,
    LiveModelServer: liveModelServer
  };
  const wsServer = new WebSocketServer(config);
  await expect(wsServer.start(svcDeps)).resolves.toBe(wsServer);

  // Listen on random port.
  await httpServer.listen();

  return { httpServer, wsServer, liveModelServer };
}

/**
 * Create and start an HTTP server on a random port.
 * @param {?object} config Config overrides.
 * @returns {Server} Listening HTTP server.
 */
async function createAndStartServer(config) {
  const server = await createServer(config);
  await server.listen();
  const port = server.getListenPort();
  expect(port > 1024);
  return server;
}

async function createWsConnection(endpoint) {
  return new Promise((resolve, reject) => {
    log.warn(`Creating connection to ${endpoint}...`);
    const socket = new WebSocket(endpoint);
    let resolved;
    socket.once("open", () => {
      if (!resolved) {
        resolved = true;
        resolve(socket);
      }
    });
    socket.once("error", err => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });
  });
}

async function execAndWaitForEvent(emitter, evtName, fn) {
  let fnOk, fnErr;
  return new Promise((resolve, reject) => {
    fnOk = (...args) => {
      emitter.removeListener("error", fnErr);
      resolve(...args);
    };
    emitter.once(evtName, fnOk);

    fnErr = (...args) => {
      emitter.removeListener(evtName, fnOk);
      reject(...args);
    };
    emitter.once("error", fnErr);

    defer(fn);
  });
}

const authAlwaysAllow = wsServer => async wsAuthRequest => {
  try {
    await wsServer.authorize(wsAuthRequest);
  } catch (e) {
    await wsServer.refuseAuthRequest(wsAuthRequest, e);
  }
};

module.exports = {
  authAlwaysAllow,
  createServer,
  createAndStartServer,
  createServerWithWebsocket,
  createWsConnection,
  execAndWaitForEvent,
  requireLib,
  requireResolveLib,
  requireRoot
};
