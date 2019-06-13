#!/usr/bin/env node
const fs = require("fs");
const spawnSync = require("child_process").spawnSync;
const path = require("path");

const col = require("colors");
const semver = require("semver");
const { prettyJson } = require("../lib/util");

function main() {
  const pkgRoot = path.resolve(__dirname, "..");

  // Run 'npm test'
  spawnSync("npm test", {
    shell: true,
    stdio: "inherit",
    cwd: pkgRoot
  });

  // Bump patch version in package.json.
  const pkgJsonPath = path.join(pkgRoot, "package.json");
  const pkgJson = require(pkgJsonPath);
  const curVer = pkgJson.version;
  const nextVer = semver.inc(curVer, "patch");
  pkgJson.version = nextVer;
  fs.writeFileSync(pkgJsonPath, prettyJson(pkgJson), "utf-8");
  console.log(`Updating version from ${curVer} to ${col.green(nextVer)}`);

  // Run 'sloc' script
  spawnSync("npm run sloc", {
    shell: true,
    stdio: "inherit",
    cwd: pkgRoot
  });

  // Run 'badges' script
  spawnSync("npm run jest-coverage-badges", {
    shell: true,
    stdio: "inherit",
    cwd: pkgRoot
  });

  console.log(`

${col.yellow("Ready to run:")}

  ${col.bold(`git commit -a -m 'Version update to ${nextVer}'`)}
  ${col.bold(`git push`)}
  ${col.bold(`npm publish`)}

`);
}

main();
