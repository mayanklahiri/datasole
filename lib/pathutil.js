const path = require("path");

const PKG_ROOT = path.resolve(__dirname, "..");

module.exports = Object.assign({}, path, {
  builtInAppsPath: appName =>
    path.resolve(PKG_ROOT, "builtin", "apps", appName),
  pkgRoot: (...a) => path.resolve(PKG_ROOT, ...a),
  pkgJsonPath: () => path.join(PKG_ROOT, "package.json"),
  libRoot: (...a) => path.resolve(PKG_ROOT, "lib", ...a)
});
