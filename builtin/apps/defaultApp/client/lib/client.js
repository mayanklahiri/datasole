/**
 * Client-side (i.e., browser) application transpiled with Webpack.
 */
const angular = require("angular");
require("angular-route");
import "bootstrap";
import "./components/RootStyle.scss";

const IS_PROD = CONFIG.mode === "production"; // CONFIG is injected by Webpack at build time

function main() {
  // Create AngularJS app.
  const angularApp = angular.module("defaultApp", ["ngRoute"]);
  [
    // Routes
    IS_PROD ? null : "DebugRoute",
    "HomeRoute",
    "ErrorRoute",

    // Components
    "RootComponent",
    "NavBarComponent"
  ]
    .filter(x => x)
    .forEach(registerable =>
      require(`./components/${registerable}`)(angularApp)
    );

  // Set router to HTML5 mode.
  angularApp.config($locationProvider => {
    $locationProvider.html5Mode(false);
  });
}

// Enable Webpack HMR in development mode.
if (module.hot) {
  module.hot.accept();
}

main();
