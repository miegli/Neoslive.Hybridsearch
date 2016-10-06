

NeosliveHybridsearch.controller('SearchCtrl', ['$scope', '$hybridsearch', '$hybridsearchObject', '$hybridsearchResultsObject', function ($scope, $hybridsearch, $hybridsearchObject, $hybridsearchResultsObject) {

    var hybridsearch = new $hybridsearch(
        'https://neos-live.firebaseio.com',
        'live',
        '4f534b1eb0c1a785da31e681fb5e91ff'
    );


    $scope.result = new $hybridsearchResultsObject();

    $scope.search = '';


    var search = new $hybridsearchObject(hybridsearch);
    var labels = {

        'phlu-corporate-contact': 'Kontakte',
        'phlu-corporate-headline': 'Seiten',
        'phlu-corporate-page-overview-onepage': 'Seiten',
        'phlu-neos-nodetypes-contentcollection-table-body': 'Seiten',
        'phlu-corporate-table': 'Seiten',
        'phlu-corporate-content-page-headerdefault': 'Seiten',
        'phlu-qmpilot-nodetypes-file': 'Dateien'

    };

    var boost = {

        'phlu-corporate-content-page-headerdefault-grandparent': 50,
        'phlu-corporate-contact-grandparent': 10,
        'phlu-corporate-contact-firstname': 10,
        'phlu-corporate-contact-lastname': 10,
        'phlu-corporate-contact-phone': 10,
        'phlu-corporate-contact-email': 10,
        'phlu-corporate-headline-title': 10,
        'phlu-corporate-content-page-headerdefault-parent': 5,
        'parent': 15,
        'grandparent': 10,
        'rawcontent': 1

    };



    search.setPropertiesBoost(boost).setNodePath("search", $scope).$watch(function (data) {


        $scope.result = data;
        console.log(data);

        setTimeout(function () {
            $scope.$digest();
        }, 10);


    });



}]);

