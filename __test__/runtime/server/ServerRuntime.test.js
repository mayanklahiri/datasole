const { requireLib } = require("../_harness");

const {
  makeApiRequest,
  makeApiResponseJson,
  makeReadyOperation,
  makeRpcRequest
} = requireLib("protocol");
const mutations = requireLib("live-model/mutations");
const DatasoleServerRuntime = requireLib("runtime/server");

let mockSend, mockOn;

beforeEach(() => {
  mockOn = process.on = jest.fn();
  mockSend = process.send = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("construction registers a process.on('message') handler", () => {
  new DatasoleServerRuntime();
  expect(mockOn).toHaveBeenCalledTimes(1);
  expect(mockOn.mock.calls[0][0]).toBe("message");
});

test("test signalReady() idempotence", () => {
  const runtime = new DatasoleServerRuntime();
  runtime.signalReady();
  runtime.signalReady();
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend).toHaveBeenCalledWith(makeReadyOperation());
});

test("sendRaw() sends unmodified object to parent process", () => {
  const runtime = new DatasoleServerRuntime();
  runtime.sendRaw({ foo: 123 });
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend).toHaveBeenCalledWith({ foo: 123 });
  expect(() => runtime.sendRaw("a", "b")).toThrow(/1 argument/);
});

test("sendMutations() sends an apply operation to parent process", () => {
  const runtime = new DatasoleServerRuntime();
  const opList = [
    mutations.setKeyPath("foo", 123),
    mutations.setKeyPath("bar", 456)
  ];
  runtime.sendMutations(opList);
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend).toHaveBeenCalledWith({ type: "apply", ops: opList });
});

test("unknown message received from parent process", async () => {
  const runtime = new DatasoleServerRuntime();
  runtime.onRecvFromParent({
    message: {
      type: "unknown_message_type_123"
    },
    meta: { clientId: 1 }
  });
  expect(mockSend).toHaveBeenCalledTimes(0);
});

test("test successful RPC execution", async () => {
  const runtime = new DatasoleServerRuntime();

  const RPC_RESULT = { mock: 123, foo: "bar" };
  const mockRpcFn = jest.fn().mockReturnValue(RPC_RESULT);
  runtime.registerRpcHandler("myHandler", mockRpcFn);

  const rpcRequest = makeRpcRequest("myHandler", "a");
  runtime.onRecvFromParent({
    message: rpcRequest,
    meta: { clientId: 1 }
  });

  expect(mockRpcFn).toHaveBeenCalledTimes(1);
  expect(mockRpcFn).toHaveBeenCalledWith(rpcRequest, { clientId: 1 });
  await new Promise(resolve =>
    setTimeout(() => {
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith({
        clientId: 1,
        rpcId: "a",
        type: "rpc_response",
        result: RPC_RESULT
      });
      resolve();
    }, 10)
  );
});

test("test RPC execution that throws", async () => {
  const runtime = new DatasoleServerRuntime();

  const mockRpcFn = () => {
    throw new Error("expected");
  };
  runtime.registerRpcHandler("myHandler", mockRpcFn);

  const rpcRequest = makeRpcRequest("myHandler", "a");
  runtime.onRecvFromParent({
    message: rpcRequest,
    meta: { clientId: 1 }
  });

  await new Promise(resolve =>
    setTimeout(() => {
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith({
        clientId: 1,
        rpcId: "a",
        type: "rpc_response",
        error: 'Error executing RPC function "myHandler": Error: expected',
        fnName: "myHandler"
      });
      resolve();
    }, 0)
  );
});

test("test RPC execution for nonexistent function", () => {
  const runtime = new DatasoleServerRuntime();
  const rpcRequest = makeRpcRequest("nonExistentHandler", "a");
  runtime.onRecvFromParent({
    message: rpcRequest,
    meta: { clientId: 4 }
  });
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend).toHaveBeenCalledWith({
    clientId: 4,
    error: 'Cannot find RPC function "nonExistentHandler".',
    rpcId: "a",
    type: "rpc_response"
  });
});

test("API function returns HTTP 500 without a registered API handler", () => {
  const runtime = new DatasoleServerRuntime();
  const apiRequest = makeApiRequest(1234, "get", "/api");
  runtime.onRecvFromParent({
    message: apiRequest,
    meta: {}
  });

  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend).toHaveBeenCalledWith({
    type: "api_response",
    body: '{"error":"No server-side API handler registered."}',
    reqId: 1234,
    statusCode: 500,
    headers: {
      "Content-Length": 50,
      "Content-Type": "application/json"
    }
  });
});

test("API function returns HTTP 500 if the handler throws an exception", async () => {
  const runtime = new DatasoleServerRuntime();
  const mockHandler = async () => {
    throw new Error("Exception unexpected");
  };
  runtime.setApiHandler(mockHandler);

  const apiRequest = makeApiRequest(1234, "get", "/api");
  runtime.onRecvFromParent({
    message: apiRequest,
    meta: {}
  });

  await new Promise(resolve =>
    setTimeout(() => {
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith({
        type: "api_response",
        body:
          '{"error":"Server-side API handler threw an error: Error: Exception unexpected."}',
        reqId: 1234,
        statusCode: 500,
        headers: {
          "Content-Length": 80,
          "Content-Type": "application/json"
        }
      });
      resolve();
    }, 10)
  );
});

test("API function returns HTTP 200 and content if the handler returns a result", async () => {
  const runtime = new DatasoleServerRuntime();
  const mockHandler = async () =>
    makeApiResponseJson(938, 204, { restaurant: "thonglor" });
  runtime.setApiHandler(mockHandler);

  const apiRequest = makeApiRequest(938, "get", "/api");
  runtime.onRecvFromParent({
    message: apiRequest,
    meta: {}
  });

  await new Promise(resolve =>
    setTimeout(() => {
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith({
        type: "api_response",
        body: '{"restaurant":"thonglor"}',
        reqId: 938,
        statusCode: 204,
        headers: {
          "Content-Length": 25,
          "Content-Type": "application/json"
        }
      });
      resolve();
    }, 10)
  );
});
