const { promisify } = require("util");
const webpack = require("webpack");

const { writeToTempSync } = require("../util/fs-util");

function wpBuild(wpConfig) {
  const log = require("../logging").getLogger();

  const wpConfigOutPath = writeToTempSync(
    "webpack.config.json",
    JSON.stringify(wpConfig, null, 2)
  );
  log.debug(`Webpack configuration written to "${wpConfigOutPath}"`);
  return promisify(webpack)(wpConfig);
}

module.exports = { wpBuild };
