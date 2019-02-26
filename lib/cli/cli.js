#!/usr/bin/env node
/**
 * Command Line Interface entry point.
 *
 * This file intentionally has some require() expressions inside the body of functions.
 * This is prevent large modules like Webpack from being require()'d unless they are needed.
 *
 */
// Stdlib modules
const os = require("os");
const path = require("path");

// Third-party modules
const commander = require("commander");

// Package modules
const { pkgJsonPath, builtInAppsPath } = require("../util/path-util");

// Same-directory includes
const { getCommandLine } = require("./get-cmd-line");

// Run main() in imperative mode, or export public interface.
if (require.main === module) {
  main();
} else {
  module.exports = {
    getCommandLine,
    getConfig,
    main,
    run
  };
}

/**
 * CLI entry point.
 */
function main() {
  const pkgJson = require(pkgJsonPath());
  commander
    .version(pkgJson.version)
    .description(pkgJson.description)
    .command("init", "initialize a new application in the current directory.")
    .command(
      "dev",
      "serve a development version of the application on localhost.",
      { isDefault: true }
    )
    .command(
      "build",
      "build a production-ready web distribution of the application."
    )
    .command(
      "app",
      "serve the production-ready distribution and the application backend."
    )
    .parse(process.argv);
}
