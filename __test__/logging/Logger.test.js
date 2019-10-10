const _harness = require("./_harness");
const Logger = _harness.requireLib("logging/Logger");

let LOGGER, TRANSPORT;

beforeEach(() => {
  TRANSPORT = _harness.mockFactory.Transport();
  LOGGER = new Logger("test", { logLevel: "trace" }, TRANSPORT);
  expect(LOGGER.getTransport());
});

test("Bad log levels throw", () => {
  expect(() => LOGGER.setLogLevel("foo")).toThrow();
});

test("Basic construction and logging.", () => {
  LOGGER.info("test-info");
  LOGGER.warn("test-warn");
  expect(TRANSPORT.pushLine).toHaveBeenCalledTimes(2);
});

test("Do not log above configured level - 1", () => {
  // Debug or higher (no trace)
  LOGGER = new Logger("test", { logLevel: "debug" }, TRANSPORT);
  LOGGER.trace("test");
  expect(TRANSPORT.pushLine).not.toHaveBeenCalled();
  LOGGER.debug("test");
  expect(TRANSPORT.pushLine).toHaveBeenCalledTimes(1);
  LOGGER.info("test");
  expect(TRANSPORT.pushLine).toHaveBeenCalledTimes(2);
});

test("Do not log above configured level - 2", () => {
  // Error or higher
  LOGGER = new Logger("test", { logLevel: "error" }, TRANSPORT);
  LOGGER.trace("test");
  LOGGER.debug("test");
  LOGGER.info("test");
  LOGGER.warn("test");
  expect(TRANSPORT.pushLine).not.toHaveBeenCalled();
  LOGGER.error("test");
  expect(TRANSPORT.pushLine).toHaveBeenCalledTimes(1);
});

test("Log a string", () => {
  LOGGER.info("a-string");
  const logLine = TRANSPORT.pushLine.mock.calls[0][0];
  expect(logLine.ts);
  expect(logLine.caller);
  expect(!logLine.stackTraces);

  delete logLine.ts;
  delete logLine.caller;
  delete logLine.pid;
  expect(logLine).toMatchObject({
    loggerName: "test",
    msg: "a-string",
    level: "info"
  });
});

test("Log a sprintf-style string", () => {
  LOGGER.info("first:[%s] second:[%d]", "cat", 42);
  const logLine = TRANSPORT.pushLine.mock.calls[0][0];
  expect(logLine.ts);
  expect(logLine.caller);
  expect(!logLine.stackTraces);

  delete logLine.ts;
  delete logLine.caller;
  delete logLine.pid;
  expect(logLine).toMatchObject({
    loggerName: "test",
    msg: "first:[cat] second:[42]",
    level: "info"
  });
});

test("Log an Error object", () => {
  LOGGER.error(new Error("errstr_123"));
  const logLine = TRANSPORT.pushLine.mock.calls[0][0];
  expect(logLine.ts);
  expect(logLine.caller);
  expect(logLine.stackTraces);

  delete logLine.ts;
  delete logLine.caller;
  delete logLine.pid;
  delete logLine.stackTraces;
  expect(logLine).toMatchObject({
    loggerName: "test",
    msg: "errstr_123",
    level: "error"
  });
});

test("Log raw objects as JSON", () => {
  LOGGER.warn({ rawObject: 42 });
  const logLine = TRANSPORT.pushLine.mock.calls[0][0];
  expect(logLine.ts);
  expect(logLine.caller);
  expect(logLine.stackTraces);

  delete logLine.ts;
  delete logLine.caller;
  delete logLine.pid;
  delete logLine.stackTraces;
  expect(logLine).toMatchObject({
    loggerName: "test",
    msg: '{\n  "rawObject": 42\n}',
    level: "warn"
  });
});
