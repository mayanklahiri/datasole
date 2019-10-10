const _harness = require("../_harness");
const ConsoleDriver = _harness.requireLib("logging/drivers/ConsoleDriver");
const LoggingDefaults = _harness.requireLib("logging/defaults");
const { BATCH_ONE, BATCH_MANY } = require("./resources");

const mockWrite = (process.stdout.write = jest.fn());

test("Console driver writes to process.stdout.write", () => {
  const driver = new ConsoleDriver(LoggingDefaults);
  driver.writeBatch(BATCH_ONE);
  expect(mockWrite).toHaveBeenCalledTimes(1);
  mockWrite.mockClear();
  driver.writeBatch(BATCH_MANY);
  expect(mockWrite).toHaveBeenCalledTimes(3); // once per log line
});
