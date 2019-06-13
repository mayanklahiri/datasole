const fs = require("fs").promises;
const fse = require("fs-extra");
const path = require("path");
const os = require("os");
const col = require("colors");
const { filter } = require("lodash");
const LoggingSubsystem = require("../../lib/logging/subsystem");
const Config = require("../../lib/config");

let TEST_TEMP, LOGGING;

async function createTempDir() {
  TEST_TEMP = await fs.mkdtemp(path.join(os.tmpdir(), "_datasole"));
  return TEST_TEMP;
}

function createSubsystem(env) {
  return (LOGGING = new LoggingSubsystem().init(new Config(env)));
}

beforeEach(() => {
  LOGGING = null;
});

afterEach(async () => {
  if (LOGGING) {
    await LOGGING.close();
  }
  if (TEST_TEMP) {
    await fse.remove(TEST_TEMP);
  }
});

test("Sane defaults", () => {
  createSubsystem();
});

test("Throws on invalid log stream", () => {
  const logging = createSubsystem();
  expect(() => logging.getLogger("sys")).not.toThrow();
  expect(() => logging.getLogger("app")).not.toThrow();
  expect(() => logging.getLogger("gork")).toThrow(/unable to find logger/i);
});

test("Writes JSON logs to output file", async () => {
  const outDir = await createTempDir();
  const outPath = path.join(outDir, "test.log");
  const logging = createSubsystem({
    DATASOLE_LOG_OUTPUT_PATH: outPath,
    DATASOLE_LOG_FORMAT: "json",
    DATASOLE_LOG_DISABLE_CONSOLE: "true"
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
      message: "Test-info",
      loggerName: "sys"
    },
    {
      level: "error",
      message: "Test-error",
      loggerName: "sys"
    },
    { level: "warn", message: "Test-warn", loggerName: "sys" }
  ]);
});

test("Writes text logs to output file and console", async () => {
  const outDir = await createTempDir();
  const outPath = path.join(outDir, "test.log");
  const logging = createSubsystem({
    DATASOLE_LOG_OUTPUT_PATH: outPath,
    DATASOLE_LOG_FORMAT: "text",
    DATASOLE_LOG_DISABLE_CONSOLE: "true"
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
  const logging = createSubsystem({
    DATASOLE_LOG_PASSTHROUGH: "true"
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
