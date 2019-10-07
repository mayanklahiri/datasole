const LiveModel = require("../../lib/live-model/LiveModel");
const mutations = require("../../lib/live-model/mutations");

test("default constructor", () => {
  const model = new LiveModel();
  expect(model.getMetrics()).toStrictEqual({ modelSizeChars: 2 });
});

test("getModelSafe() behavior", () => {
  const model = new LiveModel();
  const modelRef = model.getModelSafe();
  modelRef.foo = 123;
  expect(model.getModelUnsafe()).toStrictEqual({});
  expect(model.getModelSafe()).toStrictEqual({});
});

test("getModelUnsafe() behavior", () => {
  const model = new LiveModel();
  const modelRef = model.getModelUnsafe();
  modelRef.foo = 123;
  expect(model.getModelUnsafe()).toStrictEqual({ foo: 123 });
  expect(model.getModelSafe()).toStrictEqual({ foo: 123 });
});

test("mutate() emits 'mutations' event", async () => {
  const model = new LiveModel();
  const emitMock = (model.emit = jest.fn());
  const ops = [mutations.setKeyPath("foo.bar", 123)];
  model.mutate(ops);
  expect(emitMock).toHaveBeenCalledTimes(1);
  expect(emitMock).toHaveBeenCalledWith("mutations", ops);
});
