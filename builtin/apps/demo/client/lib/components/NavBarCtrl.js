module.exports = ($rootScope, $scope) => {
  const {
    $route: {
      current: { name: routeName }
    }
  } = $rootScope;

  $scope.nav = {
    routeName,
    modelStatus: $rootScope.$modelStatus
  };
};
