const webpack = require("webpack");
const { generateWpConfig } = require("./generateWpConfig");

function wpBuild(config) {
  return new Promise((resolve, reject) => {
    const wpConfig = generateWpConfig(config, {
      clean: true
    });
    webpack(wpConfig, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

module.exports = { wpBuild };
