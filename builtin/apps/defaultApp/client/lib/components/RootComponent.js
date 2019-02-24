const ctrl = require("./RootCtrl");

function registerComponent(angularApp) {
  angularApp.controller("RootCtrl", ctrl);
}

module.exports = registerComponent;
