const path = require("path");

const PKG_ROOT = path.resolve(__dirname, "..");

module.exports = Object.assign({}, path, {
  builtInAppsPath: appName =>
    path.resolve(PKG_ROOT, "builtin", "apps", appName),
  pkgRoot: (...a) => path.resolve(PKG_ROOT, ...a),
  pkgJsonPath: () => path.join(PKG_ROOT, "package.json"),
  libRoot: (...a) => path.resolve(PKG_ROOT, "lib", ...a),
  nodeModulesPath: () =>
    path.resolve(path.dirname(require.resolve("lodash")), ".."), // require resolves to node_modules/lodash/lodash.js
  appClientRoot: appRoot => path.resolve(appRoot, "client"),
  appClientEntryPointPath: appRoot =>
    path.resolve(appRoot, "client", "lib", "client.js"),
  appClientSrcPath: appRoot => path.resolve(appRoot, "client", "lib"),
  appNodeModules: appRoot => path.resolve(appRoot, "node_modules"),
  appClientOutputPath: appRoot => path.resolve(appRoot, "client", "dist"),
  appClientTemplatePath: (appRoot, ...a) =>
    path.resolve(appRoot, "client", "template", ...a),
  appClientAssetsPath: appRoot => path.resolve(appRoot, "client", "assets"),
  appServerEntryPoint: appRoot => path.resolve(appRoot, "server", "lib", "main")
});
