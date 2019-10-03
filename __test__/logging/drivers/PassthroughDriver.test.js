const _harness = require("../_harness");
const PassthroughDriver = _harness.requireLib(
  "logging/drivers/PassthroughDriver"
);
const { BATCH_ONE, BATCH_MANY } = require("./resources");

const mockSend = (process.send = jest.fn());

beforeEach(() => {
  mockSend.mockClear();
});

test("Passthrough driver calls process.send() with expected object", () => {
  const driver = new PassthroughDriver();
  driver.writeBatch(BATCH_ONE);
  expect(mockSend).toHaveBeenCalledWith({
    type: "log",
    payload: BATCH_ONE
  });
  mockSend.mockClear();
  driver.writeBatch(BATCH_MANY);
  expect(mockSend).toHaveBeenCalledWith({
    type: "log",
    payload: BATCH_MANY
  });
});
