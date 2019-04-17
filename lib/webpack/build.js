const os = require("os");
const path = require("path");
const fs = require("fs");

const webpack = require("webpack");
const { generateWpConfig } = require("./generateWpConfig");
const log = require("../logging").getLogger();
const { writeToTempSync } = require("../util/fs-util");

function wpBuild(config) {
  const wpConfig = generateWpConfig(config, {
    clean: true
  });

  const wpConfigOutPath = writeToTempSync(
    "webpack.config.json",
    JSON.stringify(wpConfig, null, 2)
  );
  log.info(`Webpack configuration written to ${wpConfigOutPath}`);

  return new Promise((resolve, reject) => {
    webpack(wpConfig, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

module.exports = { wpBuild };
