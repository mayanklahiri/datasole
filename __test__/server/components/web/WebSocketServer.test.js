const _harness = require("../_harness");
const { requireLib, authAlwaysAllow } = _harness;
const {
  createServerWithWebsocket,
  createWsConnection,
  execAndWaitForEvent
} = _harness;
const { makeMessagePacket } = requireLib("protocol/envelope");
const logging = requireLib("logging");
const log = logging.getLogger("test");

let SERVERS, CLIENT;

beforeEach(() => {
  SERVERS = null;
  CLIENT = null;
});

afterEach(async () => {
  if (SERVERS) {
    SERVERS.wsServer.close();
    SERVERS.httpServer.close();
    SERVERS = null;
  }
  if (CLIENT) {
    CLIENT.close();
    CLIENT = null;
  }
  jest.resetAllMocks();
  logging.unmute();
});

test("WebSocket client connect and disconnect events (no auth)", async () => {
  logging.mute();

  const config = {
    urlRootPath: "/foo/bar",
    websocketPath: "/__websocket__"
  };
  const { httpServer, wsServer } = (SERVERS = await createServerWithWebsocket(
    config
  ));
  const wsPath = httpServer.getWebsocketLocalEndpoint();

  // Connect.
  const connInfo = await execAndWaitForEvent(
    wsServer,
    "client_new",
    async () => {
      CLIENT = await createWsConnection(wsPath);
      log.info(`Connected to ${wsPath}`);
    }
  );
  expect(connInfo.clientId).toBeDefined();
  expect(connInfo.remoteIp).toBeDefined();
  expect(connInfo.socket).toBeDefined();
  expect(connInfo.req).toBeDefined();
  expect((await wsServer.getMetrics()).numConnections).toStrictEqual(1);

  // Disconnect.
  const clientEndInfo = await execAndWaitForEvent(
    wsServer,
    "client_end",
    () => {
      try {
        CLIENT.close();
      } catch (e) {
        log.warn(e);
      }
    }
  );
  expect(clientEndInfo.clientId).toStrictEqual(connInfo.clientId);
  expect((await wsServer.getMetrics()).numConnections).toStrictEqual(0);
});

test("WebSocket client connect with auth", async () => {
  logging.mute();

  const config = {
    urlRootPath: "/foo/bar",
    websocketPath: "/__websocket__",
    websocketAuth: true
  };
  const { httpServer, wsServer } = (SERVERS = await createServerWithWebsocket(
    config
  ));
  const wsPath = httpServer.getWebsocketLocalEndpoint();

  // Authorize requests.
  wsServer.once("ws_auth_request", authAlwaysAllow(wsServer));

  // Connect.
  const connInfo = await execAndWaitForEvent(
    wsServer,
    "client_new",
    async () => {
      CLIENT = await createWsConnection(wsPath);
      log.info(`Connected to ${wsPath}`);
    }
  );
  expect(connInfo.clientId).toBeDefined();
  expect(connInfo.remoteIp).toBeDefined();
  expect(connInfo.socket).toBeDefined();
  expect(connInfo.req).toBeDefined();
  expect((await wsServer.getMetrics()).numConnections).toStrictEqual(1);

  // Disconnect.
  const clientEndInfo = await execAndWaitForEvent(wsServer, "client_end", () =>
    CLIENT.close()
  );
  expect(clientEndInfo.clientId).toStrictEqual(connInfo.clientId);
  expect((await wsServer.getMetrics()).numConnections).toStrictEqual(0);
});

test("WebSocket client connect with timeout", async () => {
  logging.mute();

  const config = {
    websocketAuth: true,
    websocketAuthTimeoutMs: 500
  };
  const { httpServer, wsServer } = (SERVERS = await createServerWithWebsocket(
    config
  ));
  const wsPath = httpServer.getWebsocketLocalEndpoint();
  expect((await wsServer.getMetrics()).numConnections).toStrictEqual(0);

  // Note: no authorization handler installed.

  const startTimeMs = Date.now();
  try {
    CLIENT = await createWsConnection(wsPath);
    fail("should not be able to connected without authorization handler");
  } catch (e) {
    const deltaMs = Date.now() - startTimeMs;
    expect(deltaMs >= 450);
    expect(e.message).toMatch(/503/); // HTTP 503 Service Unavailable
  }

  expect((await wsServer.getMetrics()).numConnections).toStrictEqual(0);
});

test("Broadcasting to multiple clients", async () => {
  logging.mute();

  const config = {};
  const { httpServer, wsServer } = (SERVERS = await createServerWithWebsocket(
    config
  ));
  const wsPath = httpServer.getWebsocketLocalEndpoint();
  expect((await wsServer.getMetrics()).numConnections).toStrictEqual(0);

  // Create two clients
  const client1 = await createWsConnection(wsPath);
  expect((await wsServer.getMetrics()).numConnections).toStrictEqual(1);
  const client2 = await createWsConnection(wsPath);
  expect((await wsServer.getMetrics()).numConnections).toStrictEqual(2);

  setTimeout(() => wsServer.broadcast({ type: "foo" }), 0);

  // Listen for a single message per client.
  const results = await Promise.all([
    new Promise(resolve => client1.once("message", resolve)),
    new Promise(resolve => client2.once("message", resolve))
  ]);
  expect(results.map(x => JSON.parse(x))).toEqual([
    { v: 1, payload: JSON.stringify({ type: "foo" }) },
    { v: 1, payload: JSON.stringify({ type: "foo" }) }
  ]);

  // Close clients.
  try {
    await execAndWaitForEvent(wsServer, "client_end", () => client1.close());
    await execAndWaitForEvent(wsServer, "client_end", () => client2.close());
  } catch (e) {
    log.warn(e);
  }

  expect((await wsServer.getMetrics()).numConnections).toStrictEqual(0);
});

test("Client messages: malformed", async () => {
  logging.mute();

  const config = {};
  const { httpServer, wsServer } = (SERVERS = await createServerWithWebsocket(
    config
  ));
  const wsPath = httpServer.getWebsocketLocalEndpoint();

  // Create a client
  const client = await createWsConnection(wsPath);

  // Listen for event from wsServer
  const errObj = await execAndWaitForEvent(
    wsServer,
    "incoming_message_malformed",
    () => client.send("malformed garbage")
  );
  expect(errObj).toEqual({
    error:
      "Cannot parse message: SyntaxError: Unexpected token m in JSON at position 0.",
    msgStr: "malformed garbage"
  });
});

test("Client messages: well formed", async () => {
  logging.mute();

  const config = {};
  const { httpServer, wsServer } = (SERVERS = await createServerWithWebsocket(
    config
  ));
  const wsPath = httpServer.getWebsocketLocalEndpoint();

  // Create a client
  const client = await createWsConnection(wsPath);
  const msgPacket = makeMessagePacket({
    type: "foo"
  });

  // Listen for event from wsServer
  const inMsg = await execAndWaitForEvent(wsServer, "incoming_message", () =>
    client.send(msgPacket)
  );
  expect(inMsg).toEqual({
    type: "foo"
  });
});
