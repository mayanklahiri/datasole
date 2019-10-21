const { filter, map } = require("lodash");

exports.urlJoin = function urlJoin(...parts) {
  if (!parts.length) return "/";
  if (parts[0] === "/") {
    parts.splice(0, 1);
  }
  return (
    "/" +
    filter(
      map(parts, part => (part ? part.replace(/^\/+|\/+$/g, "") : part))
    ).join("/")
  );
};
