const { dirExists } = require("../../util/fs-util");

module.exports = function checkAppPathExists(config) {
  let { app } = config;

  if (!app) {
    app = config.app = process.cwd();
  }

  if (!dirExists(app)) {
    throw new Error(`Application directory "${app}" does not exist.`);
  }
};
