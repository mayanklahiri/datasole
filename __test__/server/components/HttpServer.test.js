const bent = require("bent");
const _harness = require("./_harness");
const Config = _harness.requireLib("config/Config");
const HttpServer = _harness.requireLib("server/components/HttpServer");
const logging = _harness.requireLib("logging");

let SERVER;

beforeEach(() => {
  SERVER = null;
});

afterEach(async () => {
  logging.unmute();
  if (SERVER) {
    await SERVER.close();
  }
});

test("Server listens, accepts requests, shuts down cleanly", async () => {
  const server = (SERVER = new HttpServer(
    new Config({
      port: 0
    })
  ));
  logging.mute();
  await expect(server.start()).resolves.toBe(server);
  expect(() => server.getListenUrl()).toThrow(/not listening/i);
  await server.listen();
  const port = server.getListenPort();
  const url = server.getListenUrl();
  expect(port > 1024);
  expect(url).toBe(`http://localhost:${port}/`);
  const result = await bent("string", 404)(url);
  expect(result.match(/not found/im));
  await server.close();
  try {
    await bent("string", 404)(url);
  } catch (e) {
    expect(e.code).toBe("ECONNREFUSED");
  }
});
