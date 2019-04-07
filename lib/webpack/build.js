const os = require("os");
const path = require("path");
const fs = require("fs");

const webpack = require("webpack");
const { generateWpConfig } = require("./generateWpConfig");
const log = require("../util/logger").getLogger();

function wpBuild(config) {
  const wpConfig = generateWpConfig(config, {
    clean: true
  });
  const wpConfigOutPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "datasole-build-")),
    "webpack.config.json"
  );
  fs.writeFileSync(wpConfigOutPath, JSON.stringify(wpConfig, null, 2), "utf-8");
  log.info(`Webpack configuration written to ${wpConfigOutPath}`);

  return new Promise((resolve, reject) => {
    webpack(wpConfig, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

module.exports = { wpBuild };
