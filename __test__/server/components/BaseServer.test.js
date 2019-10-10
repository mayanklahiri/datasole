const _harness = require("./_harness");
const BaseServer = _harness.requireLib("server/components/BaseServer");
const logging = _harness.requireLib("logging");

afterEach(() => {
  logging.unmute();
});

test("Default constructor fails at start()", async () => {
  const bs = new BaseServer();
  logging.mute();
  await expect(bs.start()).rejects.toThrow(/must override run/);
});

test("BaseServer must never export dependencies", () => {
  const bs = new BaseServer();
  expect(bs.getDependencies()).toEqual([]);
});

test("BaseServer must export metrics", () => {
  const bs = new BaseServer();
  expect(bs.getMetrics()).toEqual({});
});
