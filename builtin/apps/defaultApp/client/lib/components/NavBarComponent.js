const templateHtml = require("pug-loader!./NavBarTempl")({ CONFIG });
const compCtrl = require("./NavBarCtrl");

function registerComponent(angularApp) {
  angularApp.component("navBar", {
    template: templateHtml,
    controller: compCtrl,
    scope: false,
    bindings: {
      $route: "=",
      $model: "=",
      $modelStatus: "="
    }
  });
}

module.exports = registerComponent;
