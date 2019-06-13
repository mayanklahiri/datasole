const util = require("../../lib/util");

test("snakeToCamel()", () => {
  const { snakeToCamel } = util;
  expect(snakeToCamel("basic")).toBe("basic");
  expect(snakeToCamel("BASIC_WITH_BREAK")).toBe("basicWithBreak");
  expect(snakeToCamel("MIXED_case_InPuT")).toBe("mixedCaseInput");
});

test("removeUndefinedValues()", () => {
  const { removeUndefinedValues } = util;
  expect(removeUndefinedValues({ k: 1, v: undefined })).toStrictEqual({ k: 1 });
});

test("jittered()", () => {
  const { jittered } = util;
  for (let i = 0; i < 100; i++) {
    const variate = jittered(100, 0.2);
    expect(variate).toBeLessThan(120);
    expect(variate).toBeGreaterThan(80);
  }
});

test("json() and prettyJson()", () => {
  const { json, prettyJson } = util;
  expect(json({ k: 1 })).toBe('{"k":1}');
  expect(prettyJson({ k: 1 })).toBe('{\n  "k": 1\n}');
});
