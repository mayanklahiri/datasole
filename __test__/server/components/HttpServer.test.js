const bent = require("bent");
const _harness = require("./_harness");

const logging = _harness.requireLib("logging");

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
    staticPath: _harness.getTestResourcePath("static-dist-simple")
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
    staticPath: _harness.getTestResourcePath("static-dist-simple")
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
