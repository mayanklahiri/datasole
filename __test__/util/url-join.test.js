const _harness = require("./_harness");
const { urlJoin } = _harness.requireLib("util/url-join");

test("Always returns at least /", () => {
  expect(urlJoin()).toBe("/");
});

test("Identity join", () => {
  expect(urlJoin("foo")).toBe("/foo");
});

test("Relative paths get converted to absolute", () => {
  expect(urlJoin("relpath/123")).toBe("/relpath/123");
});

test("Slash stripping", () => {
  expect(urlJoin("/relpath")).toBe("/relpath");
  expect(urlJoin("123/", "/relpath")).toBe("/123/relpath");
  expect(urlJoin("//relpath")).toBe("/relpath");
});

test("Multipart paths", () => {
  expect(urlJoin("relpath", "static/", "/mypart/")).toBe(
    "/relpath/static/mypart"
  );
});
