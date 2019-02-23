const templateHtml = require("pug-loader!./ErrorTempl.pug")({ CONFIG });

function registerRoute(angularApp) {
  angularApp.config($routeProvider => {
    $routeProvider.when("/error/:statusCode", {
      name: "error",
      template: templateHtml
    });
    $routeProvider.otherwise("/error/404");
  });
}

module.exports = registerRoute;
