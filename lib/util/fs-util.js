const fs = require("fs");

function dirExists(dirname) {
  if (fs.existsSync(dirname) && fs.statSync(dirname).isDirectory()) {
    return dirname;
  }
}

module.exports = { dirExists };
