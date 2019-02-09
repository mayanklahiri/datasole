app.controller("MainCtrl", [
  "$scope",
  "$location",
  "ws",
  ($scope, $location, ws) => {
    $scope.$location = $location;
    $scope.$ws = ws;
  }
]);

app.controller("HomeController", [
  "$scope",
  "$location",
  "ws",
  ($scope, $location, ws) => {
    $scope.state = JSON.stringify($state, null, 2);
    $scope.now = new Date().toISOString();
    $scope.$location = $location;
    setInterval(() => {
      $scope.$apply(() => {
        $scope.now = new Date().toISOString();
      });
    }, 675);
  }
]);
