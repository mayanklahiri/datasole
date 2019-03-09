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
const NODE_MODULES_PATH = path.resolve(path.dirname(require.resolve("lodash")), "..");

//
// Self source tree path resolvers.
//
function pkgRoot(...a) {
  return path.resolve(PKG_ROOT, ...a);
}

function libRoot(...a) {
  return pkgRoot("lib", ...a);
}

function nodeModulesPath(...a) {
  return path.resolve(NODE_MODULES_PATH, ...a);
}

function pkgJsonPath() {
  return pkgRoot("package.json");
}

//
// User app path conventions.
//
function appNodeModules(appRoot) {
  return path.resolve(appRoot, "node_modules");
}

// User app path conventions: client.
function appClientRoot(appRoot, ...a) {
  return path.resolve(appRoot, "lib", "client", ...a);
}

function appClientSrcPath(appRoot, ...a) {
  return appClientRoot(appRoot, "app");
}

function appClientEntryPointPath(appRoot) {
  return appClientSrcPath(appRoot, "app.js");
}

function appClientDistPath(appRoot) {
  return appClientRoot(appRoot, "dist");
}

function appClientTemplatePath(appRoot) {
  return appClientRoot(appRoot, "template");
}

function appClientAssetsPath(appRoot) {
  return appClientRoot(appRoot, "assets");
}

// User server app path conventions.
function appServerRoot(appRoot, ...a) {
  return path.resolve(appRoot, "lib", "server", ...a);
}

function appServerSrcRoot(appRoot, ...a) {
  return appServerRoot(appRoot, ...a);
}

function appServerEntryPoint(appRoot) {
  return appServerSrcRoot(appRoot, "server.js");
}

module.exports = {
  pkgRoot,
  pkgJsonPath,
  nodeModulesPath,
  libRoot,
  appNodeModules,
  appClientRoot,
  appClientSrcPath,
  appClientEntryPointPath,
  appClientDistPath,
  appClientTemplatePath,
  appClientAssetsPath,
  appServerRoot,
  appServerSrcRoot,
  appServerEntryPoint
};
