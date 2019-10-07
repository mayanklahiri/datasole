const path = require("path");

const requireLib = p => require(`../../../lib/${p}`);
const requireRoot = p => require(`../../../${p}`);
const getTestResourcePath = p => path.join(__dirname, "__resources__", p);

const Config = requireLib("config/Config");
const HttpServer = requireLib("server/components/HttpServer");

/**
 * Create and start an HTTP server on a random port.
 * @param {?object} config Config overrides.
 * @returns {Server} Listening HTTP server.
 */
async function createAndStartServer(config) {
  const server = new HttpServer(
    new Config(
      Object.assign({}, config, {
        port: 0
      })
    )
  );
  await expect(server.start()).resolves.toBe(server);
  expect(() => server.getLocalUrl()).toThrow(/not listening/i);
  await server.listen();
  const port = server.getListenPort();
  expect(port > 1024);
  return server;
}

module.exports = {
  createAndStartServer,
  getTestResourcePath,
  requireLib,
  requireRoot
};
