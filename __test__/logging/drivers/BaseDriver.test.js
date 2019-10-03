const _harness = require("../_harness");
const BaseDriver = _harness.requireLib("logging/drivers/BaseDriver");

test("Exceptions thrown on missing derived methods", () => {
  class BadClass1 extends BaseDriver {}
  expect(() => new BadClass1()).toThrow(/writeBatch/);
});
