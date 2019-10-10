const { requireLib } = require("../_harness");
const LiveModelServer = requireLib("server/components/model/LiveModelServer");
const mutations = requireLib("live-model/mutations");

test("default constructor", () => {
  const model = new LiveModelServer();
});

test("getModelSafe() behavior", () => {
  const liveModel = new LiveModelServer();
  const modelRef = liveModel.getModelSafe();
  modelRef.foo = 123;
  expect(liveModel.getModelUnsafe()).toStrictEqual({});
  expect(liveModel.getModelSafe()).toStrictEqual({});
});

test("getModelUnsafe() behavior", () => {
  const model = new LiveModelServer();
  const modelRef = model.getModelUnsafe();
  modelRef.foo = 123;
  expect(model.getModelUnsafe()).toStrictEqual({ foo: 123 });
  expect(model.getModelSafe()).toStrictEqual({ foo: 123 });
});

test("mutate() emits 'mutations' event", async () => {
  const model = new LiveModelServer();
  const emitMock = (model.emit = jest.fn());
  const ops = [mutations.setKeyPath("foo.bar", 123)];
  model.mutate(ops);
  expect(emitMock).toHaveBeenCalledTimes(1);
  expect(emitMock).toHaveBeenCalledWith("mutations", ops);
});
