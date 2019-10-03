const EnvMapper = require("../../lib/config/EnvMapper");

test("Correctly maps environment variables to config options", () => {
  // Basic option parsing.
  expect(
    new EnvMapper({
      DATASOLE_LOG_LEVEL_SYS: "debug",
      DATASOLE_OTHER_OPTION: "foo",
      NON_DATASOLE_OPTION: "a"
    }).getConfig()
  ).toEqual({ logLevelSys: "debug", otherOption: "foo" });

  // Type casting for known strings.
  expect(
    new EnvMapper({
      DATASOLE_LOG_PASSTHROUGH: "true"
    }).getConfig()
  ).toEqual({ logPassthrough: true });
  expect(
    new EnvMapper({
      DATASOLE_LOG_PASSTHROUGH: "false"
    }).getConfig()
  ).toEqual({ logPassthrough: false });

  // Type casting for null.
  expect(
    new EnvMapper({
      DATASOLE_LOG_PASSTHROUGH: "null"
    }).getConfig()
  ).toEqual({ logPassthrough: null });

  // Type casting for integer values.
  expect(
    new EnvMapper({
      DATASOLE_INT_OPTION: "3"
    }).getConfig()
  ).toEqual({ intOption: 3 });
  expect(
    new EnvMapper({
      DATASOLE_INT_OPTION: "3a"
    }).getConfig()
  ).toEqual({ intOption: "3a" });
  expect(
    new EnvMapper({
      DATASOLE_INT_OPTION: "0"
    }).getConfig()
  ).toEqual({ intOption: 0 });

  // Multiple options
  expect(
    new EnvMapper({
      DATASOLE_LOG_FORMAT: "json",
      DATASOLE_LOG_PASSTHROUGH: "true"
    }).getConfig()
  ).toEqual({ logPassthrough: true, logFormat: "json" });
});

test("Correctly returns ANSI colors options", () => {
  expect(new EnvMapper({}).areAnsiColorsDisabled()).toBe(false);
  expect(
    new EnvMapper({
      DISABLE_COLORS: "1"
    }).areAnsiColorsDisabled()
  ).toBe(true);
  expect(
    new EnvMapper({
      NO_COLOR: 1
    }).areAnsiColorsDisabled()
  ).toBe(true);
  expect(
    new EnvMapper({
      NO_COLORS: 2
    }).areAnsiColorsDisabled()
  ).toBe(true);
});

test("Test defaults", () => {
  expect(new EnvMapper({}, { def1: "abc" }).getConfig()).toStrictEqual({
    def1: "abc"
  });
  expect(
    new EnvMapper({ DATASOLE_DEF1: "def" }, { def1: "abc" }).getConfig()
  ).toStrictEqual({
    def1: "def"
  });
  expect(
    new EnvMapper(
      { DATASOLE_DEF1: "def" },
      { def1: "abc", def2: 123 }
    ).getConfig()
  ).toStrictEqual({
    def1: "def",
    def2: 123
  });
});

test("Test overrides", () => {
  expect(
    new EnvMapper({ def1: "def" }, { def1: "abc" }, { def1: "ghi" }).getConfig()
  ).toStrictEqual({
    def1: "ghi"
  });
});
