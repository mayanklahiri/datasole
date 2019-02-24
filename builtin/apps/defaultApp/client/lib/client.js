const angular = require("angular");
require("angular-route");
import "bootstrap";
import "./components/RootStyle.scss";

// Create AngularJS app.
const angularApp = angular.module("defaultApp", ["ngRoute"]);
["DebugRoute", "HomeRoute", "ErrorRoute", "NavBarComponent"].forEach(
  routeName => {
    const registerFn = require(`./components/${routeName}.js`);
    registerFn(angularApp);
  }
);
angularApp.controller("RootCtrl", require("./components/RootCtrl"));

// Set router to HTML5 mode.
angularApp.config($locationProvider => {
  $locationProvider.html5Mode(false);
});

// Enable HMR in development mode.
if (module.hot) {
  module.hot.accept();
}
