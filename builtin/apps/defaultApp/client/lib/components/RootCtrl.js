const { LiveModelClient } = require("live-model/client");
const { throttle } = require("lodash");

const liveModel = new LiveModelClient(CONFIG);

module.exports = [
  "$rootScope",
  "$routeParams",
  "$route",
  ($rootScope, $routeParams, $route) => {
    $rootScope.$route = $route;
    $rootScope.$model = liveModel.getModel();
    $rootScope.$modelStatus = liveModel.getModelStatus();
    $rootScope.$routeParams = $routeParams;
    liveModel.on(
      "update",
      throttle(() => {
        $rootScope.$apply(() => {});
      }, 100)
    );
  }
];
