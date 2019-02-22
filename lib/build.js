#!/usr/bin/env node
const path = require("path");
const wpConfig = require(path.join(__dirname, "../webpack.config.js"));
require("webpack")(wpConfig, err => {
  if (err) {
    console.error(err);
    return process.exit(1);
  }
});
