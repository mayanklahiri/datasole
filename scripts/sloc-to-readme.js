#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const spawnSync = require("child_process").spawnSync;

const slocOutput = spawnSync("npm -s run _sloc -- -f json", {
  cwd: path.resolve(__dirname, ".."),
  stdio: "pipe",
  shell: true
});

let nodeModulesSize;
try {
  nodeModulesSize = spawnSync("du -hs node_modules", {
    shell: true,
    stdio: "pipe",
    cwd: path.resolve(__dirname, "..")
  })
    .stdout.toString("utf-8")
    .split(/\s/)[0];
} catch (e) {
  console.error("Cannot get node_modules size, skipping");
}

const summary = JSON.parse(slocOutput.stdout.toString("utf-8")).summary;
const srcPcnt = (summary.source / summary.total) * 100;
const table = `
| Statistic | Value |
| --- | --- |
| Total lines of code | ${summary.total} |
| Source lines | ${summary.source} (${Math.round(srcPcnt)}%) |
| Comment lines | ${summary.comment} |
| Installed node_modules size | ${nodeModulesSize} |`;

const readmePath = path.resolve(__dirname, "../README.md");
let readme = fs.readFileSync(readmePath, "utf-8");

const trailer = "### Source Statistics";
const lines = readme.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i] === trailer) {
    lines.splice(i, lines.length - i);
    break;
  }
}
readme = lines.join("\n");

readme += `
${trailer}
${table}
---
`;

fs.writeFileSync(readmePath, readme, "utf-8");
