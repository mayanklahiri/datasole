const webpack = require("webpack");
const { generateWpConfig } = require("./generateWpConfig");
const { prettyJson } = require("../util");

function wpBuild(config) {
  const log = require("../logger").getLogger();
  return new Promise((resolve, reject) => {
    const wpConfig = generateWpConfig(config, {
      clean: true
    });
    webpack(wpConfig, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

module.exports = { wpBuild };
