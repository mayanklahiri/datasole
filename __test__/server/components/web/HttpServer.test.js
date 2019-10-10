const path = require("path");
const bent = require("bent");
const _harness = require("../_harness");

const logging = _harness.requireLib("logging");
const log = logging.getLogger("test");

const { createAndStartServer } = _harness;

let SERVER;

beforeEach(async () => {
  if (SERVER) {
    await SERVER.close();
  }
  SERVER = null;
});

afterEach(async () => {
  if (SERVER) {
    await SERVER.close();

    // Ensure clean server shutdown.
    try {
      await bent("string")(SERVER.getLocalUrl());
    } catch (e) {
      expect(e.code).toBe("ECONNREFUSED");
    }
  }
  SERVER = null;
  logging.unmute();
});

test("Minimal handler returns built-in 404.", async () => {
  logging.mute();

  const server = (SERVER = await createAndStartServer());
  const url = server.getLocalUrl();
  const result = await bent("string", 404)(url);
  expect(result.match(/__builtin_404/im));
});

test("Fallback to static page handler.", async () => {
  logging.mute();

  const SENTINEL_PATH = "/sub/inner/file.txt";
  const URL_ROOT = "/foobar/123";

  const server = (SERVER = await createAndStartServer({
    urlRootPath: URL_ROOT,
    staticPath: path.join(__dirname, "__resources__", "static-dist-simple")
  }));

  // Check absolute URL path mapping.
  const urlPath = server.getUrlPath(SENTINEL_PATH);
  expect(urlPath).toBe(`${URL_ROOT}${SENTINEL_PATH}`);

  // Check local URL path mapping.
  const localUrl = server.getLocalUrl(SENTINEL_PATH);
  expect(localUrl).toBe(
    `http://localhost:${server.getListenPort()}${URL_ROOT}${SENTINEL_PATH}`
  );

  // Ensure correct 200 response from expected URL.
  const result = await bent("string", 200)(localUrl);
  expect(result.match(/__builtin_sentinel/));

  // Ensure correct 404 response from root path.
  await bent("string", 404)(server.getLocalServerRoot());
});

test("Fallback to static page handler at a nested path prefix.", async () => {
  logging.mute();

  const SENTINEL_PATH = "/sub/inner/file.txt";
  const URL_ROOT = "/foobar/123";
  const STATIC_URL = "/static";

  const server = (SERVER = await createAndStartServer({
    urlRootPath: URL_ROOT,
    staticUrl: STATIC_URL,
    staticPath: path.join(__dirname, "__resources__", "static-dist-simple")
  }));

  // Check local URL path mapping.
  const staticPath = server.getStaticPath(SENTINEL_PATH);
  expect(staticPath).toBe(`${URL_ROOT}${STATIC_URL}${SENTINEL_PATH}`);

  // Ensure correct 200 response from expected URL.
  const result = await bent("string", 200)(
    server.getLocalServerRoot(staticPath)
  );
  expect(result.match(/__builtin_sentinel/));

  // Ensure correct 404 response from root path.
  await bent("string", 404)(server.getLocalServerRoot());
  await bent("string", 404)(server.getLocalUrl());
});

test("Custom built-in error templates", async () => {
  logging.mute();

  const server = (SERVER = await createAndStartServer({
    urlRootPath: "inner",
    builtinTemplatePath: path.join(
      __dirname,
      "__resources__",
      "custom-error-templates"
    )
  }));

  // Ensure correct custom error page response from expected URL.
  const result = await bent("string", 404)(server.getLocalServerRoot());
  expect(result.match(/__custom_builtin_404/));
});

test("Inbound GET API requests emit the 'api_request' event and times out", async () => {
  logging.mute();

  const API_URL_PATH = `/api/v${Math.floor(Math.random() * 1e4)}`;
  const server = (SERVER = await createAndStartServer({
    apiUrl: API_URL_PATH,
    apiTimeoutSec: 1
  }));

  return new Promise(async resolve => {
    let apiRequestRecv;
    server.once("api_request", apiRequest => {
      apiRequestRecv = apiRequest;
      log.info(`Received API request: ${JSON.stringify(apiRequest, null, 2)}`);
    });

    // Ensure correct custom error page response from expected URL.
    const result = await bent("string", 500)(
      server.getLocalServerRoot(`${API_URL_PATH}/foo?bar=123&drink=whiskey`)
    );
    expect(result.match(/__custom_builtin_500/));
    expect(apiRequestRecv).toBeDefined();
    expect(apiRequestRecv.method).toBe("get");
    expect(apiRequestRecv.path).toBe("/foo");
    expect(apiRequestRecv.reqId).toBeDefined();
    expect(apiRequestRecv.query).toEqual({
      bar: "123",
      drink: "whiskey"
    });
    resolve();
  });
});

test("Inbound POST API requests emit the 'api_request' event and can be responded to", async () => {
  logging.mute();

  const API_URL_PATH = `/api/v${Math.floor(Math.random() * 1e4)}`;
  const server = (SERVER = await createAndStartServer({
    apiUrl: API_URL_PATH,
    apiTimeoutSec: 2
  }));

  let apiRequestRecv;

  server.once("api_request", apiRequest => {
    apiRequestRecv = apiRequest;
    const apiResponse = {
      reqId: apiRequest.reqId,
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        foo: {
          bar: 123
        }
      })
    };

    log.info(`Received API request: ${JSON.stringify(apiRequest, null, 2)}`);
    log.info(`Sending API response: ${JSON.stringify(apiResponse, null, 2)}`);

    server.acceptApiResponse(apiResponse);
  });

  // Ensure correct custom error page response from expected URL.
  const apiResponse = await bent("POST", "json", 200)(
    server.getLocalServerRoot(`${API_URL_PATH}/postbin`),
    { foo: "bar123" }
  );

  // Check 'api_request' emitted by HttpServer
  expect(apiRequestRecv).toBeDefined();
  expect(apiRequestRecv.method).toBe("post");
  expect(apiRequestRecv.path).toBe("/postbin");
  expect(apiRequestRecv.reqId).toBeDefined();
  expect(apiRequestRecv.body).toEqual({
    foo: "bar123"
  });

  // Check HTTP response
  expect(apiResponse).toEqual({ foo: { bar: 123 } });
});
