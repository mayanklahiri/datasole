const mutations = require("../../lib/live-model/mutations");
const LiveModelRuntime = require("../../lib/live-model/runtime");
const {
  makeReadyOperation,
  makeRpcResponse,
  makeRpcRequest
} = require("../../lib/live-model/protocol");

let mockSend, mockOn;

beforeEach(() => {
  mockOn = process.on = jest.fn();
  mockSend = process.send = jest.fn();
});

test("construction register process message handler", () => {
  new LiveModelRuntime();
  expect(mockOn).toHaveBeenCalledTimes(1);
});

test("test signalReady()", () => {
  const runtime = new LiveModelRuntime();
  runtime.signalReady();
  runtime.signalReady();
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend).toHaveBeenCalledWith(makeReadyOperation());
});

test("sendRaw() sends unmodified object to parent process", () => {
  const runtime = new LiveModelRuntime();
  runtime.sendRaw({ foo: 123 });
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend).toHaveBeenCalledWith({ foo: 123 });
  expect(() => runtime.sendRaw("a", "b")).toThrow(/1 argument/);
});

test("sendMutations() sends an apply operations", () => {
  const runtime = new LiveModelRuntime();
  const opList = [
    mutations.setKeyPath("foo", 123),
    mutations.setKeyPath("bar", 456)
  ];
  runtime.sendMutations(opList);
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend).toHaveBeenCalledWith({ type: "apply", ops: opList });
});

test("test successful RPC execution", () => {
  const runtime = new LiveModelRuntime();
  const mockRpcFn = jest.fn();
  runtime.registerRpcHandler("myHandler", mockRpcFn);
  const rpcRequest = makeRpcRequest("myHandler", "a");
  runtime.onRecvFromParent({
    message: rpcRequest,
    meta: { clientId: 1 }
  });
  expect(mockRpcFn).toHaveBeenCalledTimes(1);
  expect(mockRpcFn).toHaveBeenCalledWith(rpcRequest, { clientId: 1 });
});

test("test RPC execution that throws", () => {
  const runtime = new LiveModelRuntime();
  const mockRpcFn = () => {
    throw new Error("expected");
  };
  runtime.registerRpcHandler("myHandler", mockRpcFn);
  const rpcRequest = makeRpcRequest("myHandler", "a");
  runtime.onRecvFromParent({
    message: rpcRequest,
    meta: { clientId: 1 }
  });
  expect(mockSend).toHaveBeenCalledTimes(1);
});
