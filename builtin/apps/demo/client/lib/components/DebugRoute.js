const templateHtml = require("./DebugTempl.pug")({ CONFIG });
const routeCtrl = require("./DebugCtrl");

function registerRoute(angularApp) {
  angularApp.config($routeProvider => {
    $routeProvider.when("/debug", {
      name: "debug",
      template: templateHtml,
      controller: routeCtrl
    });
  });
}

module.exports = registerRoute;
