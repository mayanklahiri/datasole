const mutations = require("../../lib/live-model/mutations");
const { applyOperations } = require("../../lib/live-model/operations");

test("$clearAll", () => {
  const pre = {
    test: 123
  };
  applyOperations(pre, [mutations.clearAll()]);
  expect(pre).toEqual({});
});

test("$set basic with key path", () => {
  const pre = {
    test: 123
  };
  applyOperations(pre, [mutations.setKeyPath("topLevel", 123)]);
  expect(pre).toEqual({ topLevel: 123, test: 123 });
});

test("$set nested with key path", () => {
  const pre = {};
  applyOperations(pre, [
    mutations.setKeyPath("topLevel.inner.nested", { test: 123 })
  ]);
  expect(pre).toEqual({ topLevel: { inner: { nested: { test: 123 } } } });
});

test("$set without key path", () => {
  const pre = {};
  expect(() => applyOperations(pre, [mutations.setKeyPath(null, 123)])).toThrow(
    /must specify a key path for \$set/
  );
});

test("$merge basic at top-level", () => {
  const pre = { topLevel: { nested: 456 } };
  applyOperations(pre, [mutations.mergeKeyPath("topLevel", { nested: 123 })]);
  expect(pre).toEqual({
    topLevel: { nested: 123 }
  });
});

test("$merge nested", () => {
  const pre = {
    topLevel: {
      inner: {
        nested: 123,
        other: 456
      }
    }
  };
  applyOperations(pre, [
    mutations.mergeKeyPath("topLevel.inner", { nested: 789 })
  ]);
  expect(pre).toEqual({
    topLevel: { inner: { nested: 789, other: 456 } }
  });
});

test("$shallowAssign without key path", () => {
  const pre = {
    topLevel: {
      inner: {
        nested: 123,
        other: 456
      }
    }
  };
  applyOperations(pre, [
    mutations.shallowAssignKeyPath(null, { topLevel: 789 })
  ]);
  expect(pre).toEqual({
    topLevel: 789
  });
});

test("$shallowAssign with non-object value", () => {
  const pre = {
    topLevel: {
      inner: {
        nested: 123,
        other: 456
      }
    }
  };
  expect(() =>
    applyOperations(pre, [
      mutations.shallowAssignKeyPath("topLevel.inner", 456)
    ])
  ).toThrow(/must specify an object value for \$shallowAssign/);
});

test("$shallowAssign with key path", () => {
  const pre = {
    topLevel: {
      inner: {
        nested: 123
      },
      other: 456
    }
  };
  applyOperations(pre, [
    mutations.shallowAssignKeyPath("topLevel", { inner: null })
  ]);
  expect(pre).toEqual({
    topLevel: { inner: null, other: 456 }
  });
});

test("$circularAppend with nested key path", () => {
  const pre = {
    circle: []
  };
  for (let i = 0; i < 10; i++) {
    applyOperations(pre, [
      mutations.circularAppendKeyPath("circle", `line:${i}`, 5)
    ]);
  }
  expect(pre).toEqual({
    circle: ["line:5", "line:6", "line:7", "line:8", "line:9"]
  });
});

test("$circularAppend reduces existing oversized array", () => {
  const pre = {
    circle: [
      "line:1",
      "line:2",
      "line:3",
      "line:4",
      "line:5",
      "line:6",
      "line:7"
    ]
  };

  applyOperations(pre, [
    mutations.circularAppendKeyPath("circle", `line:8`, 3)
  ]);

  expect(pre).toEqual({
    circle: ["line:6", "line:7", "line:8"]
  });
});

test("$circularAppend appends arrays", () => {
  const pre = {
    circle: ["line:1", "line:2", "line:3"]
  };

  applyOperations(pre, [
    mutations.circularAppendKeyPath("circle", ["line:4", "line:5"], 3)
  ]);

  expect(pre).toEqual({
    circle: ["line:3", "line:4", "line:5"]
  });
});

test("$deleteKeys basic at top-level null path", () => {
  const pre = {
    a: 1,
    b: 2,
    c: 3
  };
  applyOperations(pre, [mutations.deleteKeys(null, ["b", "c"])]);
  expect(pre).toEqual({ a: 1 });
});

test("$deleteKeys basic at top-level nested path", () => {
  const pre = {
    nested: {
      a: 1,
      b: 2
    },
    other: 123
  };
  applyOperations(pre, [mutations.deleteKeys("nested", ["a"])]);
  expect(pre).toEqual({ nested: { b: 2 }, other: 123 });
});

test("$deleteKeys is a no-op on non-object nested paths", () => {
  const pre = {
    nested: 3,
    other: 123
  };
  applyOperations(pre, [mutations.deleteKeys("nested", ["a"])]);
  expect(pre).toEqual({ nested: 3, other: 123 });
});

test("unknown operation throws", () => {
  expect(() => applyOperations({}, [{ type: "$junk" }])).toThrow(
    /unsupported operation/
  );
});

test("sequential application of operations", () => {
  const pre = {};
  applyOperations(pre, [
    mutations.setKeyPath("nested.deep", 123),
    mutations.setKeyPath("nested.deep", 345),
    mutations.setKeyPath("nested.avis", { sandwich: 911 })
  ]);
  expect(pre).toEqual({
    nested: {
      deep: 345,
      avis: {
        sandwich: 911
      }
    }
  });
});
