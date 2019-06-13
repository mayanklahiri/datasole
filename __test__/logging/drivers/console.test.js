const ConsoleDriver = require("../../../lib/logging/drivers/console");
const LoggingDefaults = require("../../../lib/logging/defaults");
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
