const path = require("path");

const PKG_ROOT = path.resolve(__dirname, "..");

module.exports = Object.assign({}, path, {
  builtInAppsPath: appName =>
    path.resolve(PKG_ROOT, "builtin", "apps", appName),
  pkgRoot: (...a) => path.resolve(PKG_ROOT, ...a),
  pkgJsonPath: () => path.join(PKG_ROOT, "package.json"),
  libRoot: (...a) => path.resolve(PKG_ROOT, "lib", ...a),

  clientAppRoot: appRoot => path.resolve(appRoot, "client"),
  clientAppEntryPointPath: appRoot =>
    path.resolve(appRoot, "client", "lib", "app.js"),
  clientAppSrcPath: appRoot => path.resolve(appRoot, "client", "lib"),
  clientAppOutputPath: appRoot => path.resolve(appRoot, "client", "dist"),
  clientAppTemplatePath: (appRoot, ...a) =>
    path.resolve(appRoot, "client", "template", ...a),
  clientAppStaticPath: appRoot => path.resolve(appRoot, "client", "static")
});
