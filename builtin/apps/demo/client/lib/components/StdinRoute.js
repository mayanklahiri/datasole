const templateHtml = require("./StdinTempl")({ CONFIG });

function registerRoute(angularApp) {
  angularApp.config($routeProvider => {
    $routeProvider.when("/stdin", {
      template: templateHtml,
      name: "stdin"
    });
  });
}

module.exports = registerRoute;
