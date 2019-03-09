#!/usr/bin/env node
/**
 * Command Line Interface entry point.
 *
 * This file intentionally has some require() expressions inside the body of functions.
 * This is prevent large modules like Webpack from being require()'d unless they are needed.
 *
 */
// Third-party modules
const commander = require("commander");

// Package modules
const pathUtil = require("../util/path-util");

/**
 * CLI entry point.
 */
function main(argv) {
  const pkgJson = require(pathUtil.pkgJsonPath());
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
      "run",
      "serve the production-ready distribution of the application (requires build first)."
    )
    .parse(argv);
}

// Run main() in imperative mode, or export public interface.
if (require.main === module) {
  process.argv[1] = __filename;
  main(process.argv);
} else {
  module.exports = main;
}
