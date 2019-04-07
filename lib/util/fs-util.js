const os = require("os");
const fs = require("fs");
const path = require("path");

const fse = require("fs-extra");

function dirExists(dirname) {
  if (fs.existsSync(dirname) && fs.statSync(dirname).isDirectory()) {
    return dirname;
  }
}

function writeToTempSync(relPath, data) {
  const outPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), `tmp-`)),
    relPath
  );
  fse.ensureDirSync(path.dirname(outPath));
  fs.writeFileSync(outPath, data, "utf-8");
  return outPath;
}

module.exports = { dirExists, writeToTempSync };
