/**
 * Convenience path-construction functions.
 */
const path = require("path");

/**
 * Root of the package, two levels up from this file.
 */
const PKG_ROOT = path.resolve(__dirname, "..", "..");

/**
 * Use require.resolve() on this installed node_modules package to find our own node_modules.
 * `require.resolve("lodash")` maps to `<abs path>/node_modules/lodash/lodash.js`.
 */
// prettier-ignore
const NODE_MODULES = path.resolve(path.dirname(require.resolve("lodash")), "..");

// prettier-ignore
module.exports = {  
  pkgRoot: PKG_ROOT,
  nodeModulesPath: NODE_MODULES,
  builtInAppsPath: appName => path.resolve(PKG_ROOT, "builtin", "apps", appName),
  pkgJsonPath: () => path.join(PKG_ROOT, "package.json"),
  libRoot: (...a) => path.resolve(PKG_ROOT, "lib", ...a),  
  appClientRoot: appRoot => path.resolve(appRoot, "client"),
  appClientEntryPointPath: appRoot => path.resolve(appRoot, "client", "lib", "client.js"),
  appClientSrcPath: appRoot => path.resolve(appRoot, "client", "lib"),
  appNodeModules: appRoot => path.resolve(appRoot, "node_modules"),
  appClientOutputPath: appRoot => path.resolve(appRoot, "client", "dist"),
  appClientTemplatePath: (appRoot, ...a) => path.resolve(appRoot, "client", "template", ...a),
  appClientAssetsPath: appRoot => path.resolve(appRoot, "client", "assets"),
  appServerEntryPoint: appRoot => path.resolve(appRoot, "server", "lib", "main")
};
