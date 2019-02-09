app.controller("HomeController", [
  "$scope",
  "$rootScope",
  "ws",
  ($scope, $rootScope, ws) => {
    $scope.state = JSON.stringify($state, null, 2);
    $scope.now = new Date().toISOString();
    setInterval(() => {
      $scope.$apply(() => {
        $scope.now = new Date().toISOString();
      });
    }, 675);
  }
]);
