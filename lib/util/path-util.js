/**
 * Path naming conventions based on a common root path.
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
// Own source tree path resolvers.
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

function pkgJson() {
  return require(pkgJsonPath());
}

function projectTemplate(...a) {
  return path.resolve(__dirname, "../../templates", ...a);
}

//
// User app path conventions around a common root path.
//

function appRoot(appRoot, ...a) {
  return path.resolve(appRoot, ...a);
}

/**
 * node_modules for a top-level user porject.
 */
function appNodeModules(root) {
  return appRoot(root, "node_modules");
}

/**
 * Root of the common-modules project source tree.
 */

function appCommonRoot(root, ...a) {
  return appRoot(root, "lib", "common", ...a);
}

/**
 * Root of the server-side project source tree.
 */

function appServerRoot(root, ...a) {
  return appRoot(root, "lib", "server", ...a);
}

/**
 * Root of the client-side project source tree.
 */
function appClientRoot(root, ...a) {
  return appRoot(root, "lib", "client", ...a);
}

function appClientDistPath(root) {
  return appRoot(root, "dist");
}

/**
 * Path to client-side entry point file for bundler.
 */
function appClientEntryPointPath(appRoot) {
  return appClientRoot(appRoot, "app.js");
}

function appClientSrcPath(appRoot, ...a) {
  return appClientRoot(appRoot, ...a);
}

function appClientIndexTemplate(appRoot) {
  return appClientRoot(appRoot, "template", "index.pug");
}

function appClientTemplatePath(appRoot, ...suffix) {
  return appClientRoot(appRoot, "template", ...suffix);
}

function appClientAssetsPath(appRoot, ...suffix) {
  return appClientRoot(appRoot, "assets", ...suffix);
}

function appClientStylesPath(appRoot, ...suffix) {
  return appClientRoot(appRoot, "styles", ...suffix);
}

function appServerEntryPoint(appRoot) {
  return appServerRoot(appRoot, "server.js");
}

module.exports = {
  pkgRoot,
  pkgJsonPath,
  pkgJson,
  nodeModulesPath,
  libRoot,
  appRoot,
  appNodeModules,
  appClientRoot,
  appClientSrcPath,
  appClientEntryPointPath,
  appClientIndexTemplate,
  appClientDistPath,
  appClientTemplatePath,
  appClientAssetsPath,
  appServerRoot,
  appServerEntryPoint,
  projectTemplate,
  appCommonRoot,
  appClientStylesPath
};
