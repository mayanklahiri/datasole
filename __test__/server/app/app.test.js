const AppServer = require("../../../lib/servers/app");
const logging = require("../../../lib/logging");
const { makeRpcRequest } = require("../../../lib/live-model/protocol");

const { createHarness } = require("./harness");

let harness;
let appServer;

beforeEach(() => {
  harness = createHarness(jest, "test_app");
  logging.getLogger = jest.fn();
  appServer = new AppServer(harness.config);
});

afterEach(async () => {
  await appServer.stop();
});

test("starts basic application backend", async () => {
  await appServer.start(harness.context, harness.svcDeps);
  expect(harness.svcDeps.websocket.broadcast).toHaveBeenCalledTimes(1);
  expect(harness.svcDeps.websocket.broadcast).toHaveBeenCalledWith({
    type: "apply",
    ops: [
      {
        type: "$set",
        keyPath: "somePath",
        value: { foo: 123 }
      }
    ]
  });
});

test("runs a non-existent RPC function", async () => {
  await appServer.start(harness.context, harness.svcDeps);
  expect(harness.svcDeps.websocket.broadcast).toHaveBeenCalledTimes(1);
  appServer.sendMessageToChild(makeRpcRequest("junk", "abc123", { foo: 42 }), {
    clientId: "abc-123"
  });
  return new Promise(resolve =>
    appServer.once("rpc_response", () => {
      expect(harness.svcDeps.websocket.sendOne).toHaveBeenCalledTimes(1);
      expect(harness.svcDeps.websocket.sendOne).toHaveBeenCalledWith(
        "abc-123",
        {
          clientId: "abc-123",
          error: 'Cannot find function "junk".',
          rpcId: "abc123",
          type: "rpc_response"
        }
      );
      resolve();
    })
  );
});

test("runs an identity RPC function", async () => {
  await appServer.start(harness.context, harness.svcDeps);
  expect(harness.svcDeps.websocket.broadcast).toHaveBeenCalledTimes(1);
  appServer.sendMessageToChild(
    makeRpcRequest("foo.function.identity", "abc123", { foo: 42 }),
    {
      clientId: "abc-123"
    }
  );
  return new Promise(resolve =>
    appServer.once("rpc_response", () => {
      expect(harness.svcDeps.websocket.sendOne).toHaveBeenCalledTimes(1);
      expect(harness.svcDeps.websocket.sendOne).toHaveBeenCalledWith(
        "abc-123",
        {
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
        }
      );
      resolve();
    })
  );
});
