const path = require("path");
const EventEmitter = require("events");
const _harness = require("../_harness");
const { requireLib } = _harness;

const AppServer = requireLib("server/components/app/AppServer");
const LiveModelServer = requireLib("server/components/model/LiveModelServer");
const logging = requireLib("logging");
const log = logging.getLogger("test");
const Config = requireLib("config/Config");
const { makeRpcRequest } = requireLib("protocol/rpc");
const { makeWsAuthRequest } = requireLib("protocol/auth");

let mockHttpServer, mockWebSocketServer;

let APP;
let svcDeps;

beforeEach(() => {
  mockHttpServer = new EventEmitter();
  mockWebSocketServer = new EventEmitter();
  mockWebSocketServer.broadcast = jest.fn();
  mockWebSocketServer.sendOne = jest.fn();
  mockWebSocketServer.authorize = jest.fn();
  mockWebSocketServer.rejectAuthRequest = jest.fn();
  svcDeps = {
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

function createAppServer(config) {
  return (APP = new AppServer(
    new Config(
      Object.assign({}, config, {
        app: path.resolve(__dirname, "__resources__/test_app")
      })
    )
  ));
}

test("Valid 'app' path forks a backend", async () => {
  logging.mute();

  const app = createAppServer();
  app.forkBackend = jest.fn();
  app.killBackend = jest.fn();
  await app.run(svcDeps);
  expect(app.forkBackend).toHaveBeenCalledTimes(1);
});

test("Invalid 'app' path does not fork a backend", async () => {
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

  await app.run(svcDeps);
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
  await app.run(svcDeps);

  return new Promise(resolve => {
    app.once("rpc_response", () => {
      expect(svcDeps.WebSocketServer.sendOne).toHaveBeenCalledTimes(1);
      expect(svcDeps.WebSocketServer.sendOne).toHaveBeenCalledWith("abc-123", {
        clientId: "abc-123",
        error: 'Cannot find RPC function "junk".',
        rpcId: "abc123",
        type: "rpc_response"
      });
      resolve();
    });
    svcDeps.WebSocketServer.emit(
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
  await app.run(svcDeps);

  return new Promise(resolve => {
    app.once("rpc_response", () => {
      expect(svcDeps.WebSocketServer.sendOne).toHaveBeenCalledTimes(1);
      expect(svcDeps.WebSocketServer.sendOne).toHaveBeenCalledWith("abc-123", {
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

test("ws_auth_request/response messages are sent to/from the child", async () => {
  logging.mute();

  const app = createAppServer();
  await app.run(svcDeps);

  return new Promise(resolve => {
    const wsAuthReq = makeWsAuthRequest({
      url: "/foo",
      method: "GORK",
      headers: {}
    });

    // Expect auth request response.
    app.once("ws_auth_response", wsAuthResponse => {
      resolve(wsAuthResponse);
    });

    // Trigger auth request flow.
    svcDeps.WebSocketServer.emit("ws_auth_request", wsAuthReq);
  });
});

test("Dynamically set the WS auth handler to reject new connections", async () => {
  logging.mute();

  const app = createAppServer();
  await app.run(svcDeps);

  app.sendMessageToChild(
    makeRpcRequest("registerRejectingAuthHandler", null, { foo: 42 }),
    {
      clientId: "abc-123"
    }
  );

  return new Promise(resolve => {
    app.once("ws_auth_response", wsAuthResponse => {
      expect(wsAuthResponse.code).toBe(409);
      expect(wsAuthResponse.error).toMatch(/teapot/i);
      resolve();
    });
    svcDeps.WebSocketServer.emit(
      "ws_auth_request",
      makeWsAuthRequest({
        url: "/foo",
        method: "GORK",
        headers: {}
      })
    );
  });
});
