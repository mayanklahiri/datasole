const templateHtml = require("./HomeTempl.pug")({ CONFIG });
const routeCtrl = require("./HomeCtrl");
require("./HomeStyle.scss");

function registerRoute(angularApp) {
  angularApp.config($routeProvider => {
    $routeProvider.when("/home", {
      template: templateHtml,
      controller: routeCtrl,
      name: "home"
    });

    $routeProvider.when("/", {
      redirectTo: "/home"
    });
  });
}

module.exports = registerRoute;
