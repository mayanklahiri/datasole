const { promisify } = require("util");
const webpack = require("webpack");

const log = require("../logging").getLogger();
const { writeToTempSync } = require("../util/fs-util");

function wpBuild(wpConfig) {
  const wpConfigOutPath = writeToTempSync(
    "webpack.config.json",
    JSON.stringify(wpConfig, null, 2)
  );
  log.debug(`Webpack configuration written to "${wpConfigOutPath}"`);
  return promisify(webpack)(wpConfig);
}

module.exports = { wpBuild };
