const path = require("path");
const EventEmitter = require("events");
const { defer } = require("lodash");
const _harness = require("../_harness");
const { requireLib } = _harness;

const AppServer = requireLib("server/components/app/AppServer");
const LiveModelServer = requireLib("server/components/model/LiveModelServer");
const logging = requireLib("logging");
const log = logging.getLogger("test");
const Config = requireLib("config/Config");
const { makeRpcRequest } = requireLib("protocol/rpc");
const { makeWsAuthRequest } = requireLib("protocol/auth");

logging.getLogger("sys").setLogLevel("debug");
logging.getLogger("app").setLogLevel("debug");

let mockHttpServer, mockWebSocketServer;

let APP, DEPS;

beforeEach(() => {
  mockHttpServer = new EventEmitter();
  mockWebSocketServer = new EventEmitter();
  mockWebSocketServer.broadcast = jest.fn();
  mockWebSocketServer.sendOne = jest.fn();
  mockWebSocketServer.authorizeWebsocket = jest.fn();
  mockWebSocketServer.rejectWebsocket = jest.fn();
  DEPS = {
    HttpServer: mockHttpServer,
    WebSocketServer: mockWebSocketServer,
    LiveModelServer: new LiveModelServer()
  };
  APP = null;
});

afterEach(async () => {
  jest.resetAllMocks();
  if (APP) {
    await APP.stop();
  }
  logging.unmute();
});

function createAppServer(config, appName) {
  return (APP = new AppServer(
    new Config(
      Object.assign({}, config, {
        app: path.resolve(__dirname, "__resources__", appName || "test_app")
      })
    )
  ));
}

test("Valid 'app' path forks a backend", async () => {
  logging.mute();

  const app = createAppServer();
  app.forkBackend = jest.fn();
  app.killBackend = jest.fn();
  await app.run(DEPS);
  expect(app.forkBackend).toHaveBeenCalledTimes(1);
  expect(app.killBackend).toHaveBeenCalledTimes(0);
});

test("Invalid 'app' path does not fork a backend", async () => {
  logging.mute();

  expect(
    () =>
      new AppServer(
        new Config({
          app: path.resolve(__dirname, "__nonexistent__")
        })
      )
  ).toThrow(/does not exist/);
});

test("Source directory update starts backend from scratch", async () => {
  logging.mute();

  const app = createAppServer();
  jest.spyOn(app, "forkBackend");
  jest.spyOn(app, "killBackend");

  await app.onSrcDirUpdate("/");
  expect(app.killBackend).toHaveBeenCalledTimes(0);
  expect(app.forkBackend).toHaveBeenCalledTimes(1);

  app.forkBackend.mockRestore();
  app.killBackend.mockRestore();
});

test("Source directory update restarts backend", async () => {
  logging.mute();

  const app = createAppServer();
  jest.spyOn(app, "forkBackend");
  jest.spyOn(app, "killBackend");

  await app.run(DEPS);
  expect(app.forkBackend).toHaveBeenCalledTimes(1);
  expect(app.killBackend).toHaveBeenCalledTimes(0);

  await app.onSrcDirUpdate("/");
  expect(app.killBackend).toHaveBeenCalledTimes(1);
  expect(app.forkBackend).toHaveBeenCalledTimes(2);

  app.forkBackend.mockRestore();
  app.killBackend.mockRestore();
});

test("Runs a non-existent RPC function", async () => {
  logging.mute();

  const app = createAppServer();
  await app.run(DEPS);

  return new Promise(resolve => {
    app.once("rpc_response", () => {
      expect(DEPS.WebSocketServer.sendOne).toHaveBeenCalledTimes(1);
      expect(DEPS.WebSocketServer.sendOne).toHaveBeenCalledWith("abc-123", {
        clientId: "abc-123",
        error: 'Cannot find RPC function "junk".',
        rpcId: "abc123",
        type: "rpc_response"
      });
      resolve();
    });
    DEPS.WebSocketServer.emit(
      "incoming_message",
      makeRpcRequest("junk", "abc123", { foo: 42 }),
      {
        clientId: "abc-123"
      }
    );
  });
});

test("Runs an identity RPC function", async () => {
  logging.mute();

  const app = createAppServer();
  await app.run(DEPS);

  return new Promise(resolve => {
    app.once("rpc_response", () => {
      expect(DEPS.WebSocketServer.sendOne).toHaveBeenCalledTimes(1);
      expect(DEPS.WebSocketServer.sendOne).toHaveBeenCalledWith("abc-123", {
        clientId: "abc-123",
        rpcId: "abc123",
        type: "rpc_response",
        result: {
          args: {
            fnName: "foo.function.identity",
            foo: 42,
            rpcId: "abc123",
            type: "rpc_request"
          },
          meta: {
            clientId: "abc-123"
          }
        }
      });
      resolve();
    });
    app.sendMessageToChild(
      makeRpcRequest("foo.function.identity", "abc123", { foo: 42 }),
      {
        clientId: "abc-123"
      }
    );
  });
});

test("WebSocket auth requests are propagated to an accepting child", async () => {
  logging.mute();

  const app = createAppServer({ websocketAuth: true }, "ws_acceptor");
  await app.run(DEPS);

  return new Promise(resolve => {
    const wsAuthReq = makeWsAuthRequest({
      url: "/foo",
      method: "GORK",
      headers: {}
    });

    // Trigger auth request flow.
    defer(() => DEPS.WebSocketServer.emit("ws_auth_request", wsAuthReq));

    // Expect WebSocket to have been authorized when "ws_auth_response" is emitted.
    app.once("ws_auth_response", wsAuthResponse => {
      expect(DEPS.WebSocketServer.authorizeWebsocket).toHaveBeenCalledTimes(1);
      expect(DEPS.WebSocketServer.rejectWebsocket).toHaveBeenCalledTimes(0);
      resolve(wsAuthResponse);
    });
  });
});

test("WebSocket auth requests are dropped from a rejecting child", async () => {
  logging.mute();

  const app = createAppServer({ websocketAuth: true }, "ws_rejector");
  await app.run(DEPS);

  return new Promise(resolve => {
    const wsAuthReq = makeWsAuthRequest({
      url: "/__ws__",
      method: "GORK",
      headers: {}
    });

    // Trigger auth request flow.
    defer(() => DEPS.WebSocketServer.emit("ws_auth_request", wsAuthReq));

    // Expect WebSocket to NOT have been authorized when "ws_auth_response" is emitted.
    app.once("ws_auth_response", wsAuthResponse => {
      expect(DEPS.WebSocketServer.authorizeWebsocket).toHaveBeenCalledTimes(0);
      expect(DEPS.WebSocketServer.rejectWebsocket).toHaveBeenCalledTimes(1);
      expect(wsAuthResponse).toMatchObject({
        status: 500
      });
      expect(wsAuthResponse).toBeDefined();
      resolve(wsAuthResponse);
    });
  });
});
