const angular = require("angular");

console.log(CONFIG);

angular.module("defaultApp", []).controller("MainCtrl", [
  "$scope",
  $scope => {
    $scope.CONFIG = JSON.stringify(CONFIG, null, 2);
  }
]);

// Enable HMR in development mode.
if (module.hot) {
  module.hot.accept();
}
