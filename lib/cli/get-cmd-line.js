// Third-party modules
const commander = require("commander");

const { pkgJsonPath } = require("../util/path-util");

/**
 * Parse command-line arguments from process.argv.
 * @returns {object} Command-line options as a key/value map.
 */
function getCommandLine() {
  const pkgJson = require(pkgJsonPath());
  commander
    .version(pkgJson.version)
    .description(pkgJson.description)
    .parse(process.argv);
}

module.exports = { getCommandLine };
