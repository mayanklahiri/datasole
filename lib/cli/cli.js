#!/usr/bin/env node
const commander = require("commander");

const pathUtil = require("../util/path-util");

/**
 * CLI entry point.
 */
function main(argv) {
  const pkgJson = require(pathUtil.pkgJsonPath());
  commander
    .version(pkgJson.version)
    .description(pkgJson.description)
    .command(
      "init",
      "initialize a new skeleton application in the current directory."
    )
    .command(
      "dev",
      "serve a development version of the application on localhost."
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

if (require.main === module) {
  const argv = [...process.argv];
  argv[1] = __filename;
  main(argv);
} else {
  module.exports = main;
}
