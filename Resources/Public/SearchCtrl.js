// PHLU.Corporate:Page.View.Default filter tag navigation


PHLUCorporateApp.directive('search', function () {


    var template = '/_Resources/Static/Packages/PHLU.Corporate/JavaScript/angularjs/PHLU/Corporate/Templates/Search/';

    return {
        template: '<ng-include src="getTemplateUrl()"/>',
        //templateUrl: unfortunately has no access to $scope.user.type
        scope: {
            node: '=data'
        },
        restrict: 'E',
        controller: function ($scope) {

            $scope.getTemplateUrl = function () {
                switch ($scope.node.nodeType) {

                    case 'phlu-qmpilot-nodetypes-file':
                        return template + 'phlu-qmpilot-nodetypes-file.html';

                    case 'phlu-corporate-text':
                        return template + 'phlu-qmpilot-nodetypes-text.html';

                    case 'phlu-corporate-contact':
                        return template + 'phlu-corporate-contact.html';

                    default:
                        return template + 'default.html';

                }


            };

        }
    };


});

PHLUCorporateApp.controller('SearchCtrl', ['$scope', '$hybridsearch', '$hybridsearchObject', function ($scope, $hybridsearch, $hybridsearchObject) {

    var hybridsearch = new $hybridsearch(
        'https://phlu-f98dd.firebaseio.com',
        'live',
        'fb11fdde869d0a8fcfe00a2fd35c031d'
    );

    $scope.results = [];
    $scope.liste = [];

    var search = new $hybridsearchObject(hybridsearch);

    // search.setQuery('zutavern').$watch(function (i) {
    //    $scope.results = i;
    // });

    // search.setQuery('siteSearch', $scope).$watch(function (i) {
    //    $scope.results = i;
    // });

      // search.setNodeType('phlu-corporate-contact').$watch(function (i) {
      //      $scope.results = i;
      // });
      //
      // search.setQuery('nachrichten').$watch(function (i) {
      //
      //     console.log(i);
      //
      // });

    search.setQuery('siteSearch', $scope).$watch(function (i) {

        $scope.results = i;


    });


}]);

