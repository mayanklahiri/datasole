const Model = require("../../lib/live-model/model");
const mutations = require("../../lib/live-model/mutations");

test("default constructor", () => {
  const model = new Model();
  expect(model.getMetrics()).toStrictEqual({ modelSizeChars: 2 });
});

test("getModelSafe() behavior", () => {
  const model = new Model();
  const modelRef = model.getModelSafe();
  modelRef.foo = 123;
  expect(model.getModelUnsafe()).toStrictEqual({});
  expect(model.getModelSafe()).toStrictEqual({});
});

test("getModelUnsafe() behavior", () => {
  const model = new Model();
  const modelRef = model.getModelUnsafe();
  modelRef.foo = 123;
  expect(model.getModelUnsafe()).toStrictEqual({ foo: 123 });
  expect(model.getModelSafe()).toStrictEqual({ foo: 123 });
});

test("mutate() emits 'mutations' event", async () => {
  const model = new Model();
  const emitMock = (model.emit = jest.fn());
  const ops = [mutations.setKeyPath("foo.bar", 123)];
  model.mutate(ops);
  expect(emitMock).toHaveBeenCalledTimes(1);
  expect(emitMock).toHaveBeenCalledWith("mutations", ops);
});
