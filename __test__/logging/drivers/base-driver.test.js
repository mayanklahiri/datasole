const BaseDriver = require("../../../lib/logging/drivers/base-driver");

test("Exceptions thrown on missing derived methods", () => {
  class BadClass1 extends BaseDriver {}
  expect(() => new BadClass1()).toThrow(/writeBatch/);
});
