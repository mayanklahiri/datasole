const { set } = require("lodash");

module.exports = [
  "$rootScope",
  "$routeParams",
  "$route",
  ($rootScope, $routeParams, $route) => {
    const { MODEL: liveModel } = global;
    $rootScope.$route = $route;
    $rootScope.$model = liveModel.getModel();
    $rootScope.$modelStatus = liveModel.getModelStatus();
    $rootScope.$routeParams = $routeParams;

    liveModel.on("update", () => {
      $rootScope.$apply(() => {});
    });
  }
];
