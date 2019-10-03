const fs = require("fs").promises;
const fse = require("fs-extra");
const path = require("path");
const os = require("os");
const col = require("colors");
const { filter } = require("lodash");

const _harness = require("./_harness");
const LoggingService = _harness.requireLib("logging/LoggingService");
const Config = _harness.requireLib("config/Config");

let TEST_TEMP, LOGGING;

beforeEach(() => {
  LOGGING = null;
  TEST_TEMP = null;
});

afterEach(async () => {
  if (LOGGING) {
    await LOGGING.close();
  }
  if (TEST_TEMP) {
    await fse.remove(TEST_TEMP);
  }
});

async function createTempDir() {
  TEST_TEMP = await fs.mkdtemp(path.join(os.tmpdir(), "_datasole"));
  return TEST_TEMP;
}

function createServiceWithConfig(overrides) {
  return (LOGGING = new LoggingService(new Config(overrides)));
}

test("Sane defaults", () => {
  createServiceWithConfig();
});

test("Throws on invalid log stream", () => {
  const logging = createServiceWithConfig();
  expect(() => logging.getLogger("sys")).not.toThrow();
  expect(() => logging.getLogger("app")).not.toThrow();
  expect(() => logging.getLogger("gork")).toThrow(/unable to find logger/i);
});

test("Writes JSON logs to output file", async () => {
  const outDir = await createTempDir();
  const outPath = path.join(outDir, "test.log");
  const logging = createServiceWithConfig({
    logOutputPath: outPath,
    logFormat: "json",
    logDisableConsole: "true"
  });

  const drivers = logging.getTransport().getDrivers();
  expect(drivers.length).toBe(1);
  expect(drivers[0].constructor.name).toBe("FileDriver");

  // Log some lines.
  const log = logging.getLogger();
  log.info("Test-info");
  log.error(col.green("Test-error"));
  log.warn(col.bold(col.green("Test-warn")));

  // Flush and close.
  await logging.close();

  // Read log file.

  const logFileContents = await fs.readFile(outPath, "utf-8");
  const logLines = filter(logFileContents.split("\n")).map(JSON.parse);

  // Drop dynamic fields.
  logLines.forEach(logLine => {
    delete logLine.caller;
    delete logLine.ts;
    delete logLine.pid;
  });

  expect(logLines).toEqual([
    {
      level: "info",
      msg: "Test-info",
      loggerName: "sys"
    },
    {
      level: "error",
      msg: "Test-error",
      loggerName: "sys"
    },
    { level: "warn", msg: "Test-warn", loggerName: "sys" }
  ]);
});

test("Writes text logs to output file and console", async () => {
  const outDir = await createTempDir();
  const outPath = path.join(outDir, "test.log");
  const logging = createServiceWithConfig({
    logOutputPath: outPath,
    logFormat: "text",
    logDisableConsole: "true"
  });

  const drivers = logging.getTransport().getDrivers();
  expect(drivers.length).toBe(1);
  expect(drivers[0].constructor.name).toBe("FileDriver");

  // Log some lines.
  const log = logging.getLogger();
  log.info("Test-info");
  log.error(col.green("Test-error"));
  log.warn(col.bold(col.green("Test-warn")));

  // Flush and close.
  await logging.close();

  // Read log file.
  const logFileContents = await fs.readFile(outPath, "utf-8");
  const logLines = filter(logFileContents.split("\n"));

  logLines.forEach(logLine => expect(() => JSON.parse(logLine)).toThrow());
  expect(logLines.length).toBe(3);
});

test("Pushes logs to parent in passthrough mode", async () => {
  const logging = createServiceWithConfig({
    logPassthrough: "true"
  });
  const mockProcessSend = (process.send = jest.fn());

  const drivers = logging.getTransport().getDrivers();
  expect(drivers.length).toBe(1);
  expect(drivers[0].constructor.name).toBe("PassthroughDriver");

  // Log some lines.
  const log = logging.getLogger();
  log.info("Test-info");
  log.error(col.green("Test-error"));
  log.warn(col.bold(col.green("Test-warn")));

  // Flush and close.
  await logging.close();

  expect(mockProcessSend).toHaveBeenCalled();
});

test("Interval flusher terminates on close()", async () => {
  const logging = createServiceWithConfig();
  logging.getTransport().startFlusher();
  return new Promise(resolve => {
    logging.once("close", resolve);
    logging.close();
  });
});
