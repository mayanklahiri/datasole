#!/usr/bin/env node
/**
 * CLI entry point.
 */
const commander = require("commander");

const { pkgJson } = require("../util/path-util");

function main(argv) {
  // Work around a commander limitation where the path prefix of subcommands cannot
  // be explicitly specified. Explicit set the CLI entry point for commander to point
  // to this file, and look for subcommands in files like "cli-init.js" and "cli-build.js"
  // rather than "datasole-init.js" and "datasole-build.js".
  const [nodeExecPath, _, ...args] = argv;
  argv = [nodeExecPath, __filename, ...args];

  commander
    .version(pkgJson().version)
    .description(pkgJson().description)
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
  main(process.argv);
} else {
  module.exports = main;
}
