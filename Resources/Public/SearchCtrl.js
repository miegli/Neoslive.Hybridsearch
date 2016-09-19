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

PHLUCorporateApp.controller('SearchCtrl', ['$scope', '$hybridsearch', '$hybridsearchObject', function ($scope, $hybridsearch,$hybridsearchObject) {

    var hybridsearch = new $hybridsearch(
        'https://phlu-f98dd.firebaseio.com',
        'live',
        'fb11fdde869d0a8fcfe00a2fd35c031d'
    );


    var hybridsearchObject = new $hybridsearchObject(hybridsearch,$scope);

    hybridsearchObject.search('siteSearch',true).nodeTypeFilter('siteSearchFilter').$watch(function(i) {
        $scope.results = i;
    });



}]);


//
// PHLUCorporateApp.controller('SearchCtrl', ['$scope', '$timeout', '$cookies', function ($scope) {
//
//     var config, getData, getSearchTerms, resetData, getSpecialTerm, applyData, searchData, database, lunrSearch;
//     var filterReg = /[^0-9a-zA-ZöäüÖÄÜ]/g;
//
//
//     // Initialize Firebase
//     config = {
//         databaseURL: "https://phlu-f98dd.firebaseio.com",
//         storageBucket: "phlu-f98dd.appspot.com",
//         workspace: "live",
//         dimension: "fb11fdde869d0a8fcfe00a2fd35c031d",
//         magicSplit: 4,
//         boost: {
//             'phlu-corporate-contact-firstname': 100,
//             'phlu-corporate-contact-lastname': 300,
//             firstname: 100,
//             lastname: 100,
//             uriPathSegment: 150,
//             phone: 35,
//             street: 20,
//             email: 10,
//             title: 40,
//             text: 1
//         }
//     };
//
//     $scope.siteSearch = '';
//     $scope.siteSearchAutocomplete = '';
//     $scope.terms = {};
//     $scope.searchResult = [];
//     $scope.nodes = {};
//
//     // initialize firebase database
//     firebase.initializeApp(config);
//     database = firebase.database();
//
//     // initialize lunr search engine
//     lunrSearch = elasticlunr(function () {
//         this.setRef('id');
//     });
//
//     var refKeywords = {};
//     var refIndex = {};
//     var refAutocomplete = {};
//
//
//     // Get a reference to the database service
//
//     getData = function (term) {
//
//
//         var subterm = term.substr(0, config.magicSplit * 2);
//         var hasdeletion = false;
//         var searchString = " " + $scope.siteSearch.toLowerCase() + " " + $scope.siteSearchAutocomplete.toLowerCase();
//
//         angular.forEach($scope.terms, function (val, key) {
//             if (searchString.indexOf(" " + key + " ") < 0) {
//
//                 if ($scope.terms[subterm] !== undefined) {
//                     delete $scope.terms[subterm];
//                 }
//
//                 if ($scope.terms[key] !== undefined) {
//                     delete $scope.terms[key];
//                 }
//
//                 if (refKeywords[subterm] !== undefined) {
//                     refKeywords[key].off();
//                 }
//
//                 if (refIndex[key] !== undefined) {
//                     refIndex[key].off();
//                 }
//
//                 hasdeletion = true;
//             }
//
//         });
//
//         if (hasdeletion) {
//             applyData();
//         }
//
//
//         $scope.terms[subterm] = {term: subterm, results: {}};
//         refKeywords[subterm] = firebase.database().ref("keywords/" + config.workspace + "/" + config.dimension);
//
//         refKeywords[subterm].orderByKey().equalTo(subterm).on("value", function (dataSnapshot) {
//
//             if (dataSnapshot.val()) {
//
//
//                 refIndex[subterm] = firebase.database().ref("index/" + config.workspace + "/" + config.dimension);
//                 refIndex[subterm].orderByChild(subterm).startAt(term).limitToFirst(100).on("value", function (snapshot) {
//                     $scope.terms[subterm] = {term: subterm, results: {}};
//                     snapshot.forEach(function (data) {
//                         $scope.terms[subterm].results[data.key] = data.val();
//                     });
//                     applyData();
//                 });
//
//
//             }
//
//
//         });
//
//
//     };
//
//
//     applyData = function () {
//
//
//         angular.forEach($scope.terms, function (val, key) {
//
//             var sresult = " " + $scope.siteSearch.toLowerCase() + " ";
//
//
//             angular.forEach(val.results, function (node) {
//
//
//                 if (node.__node != undefined && node.__node.properties != undefined) {
//
//                     var doc = node.__node.properties;
//
//                     angular.forEach(node.__node.properties, function (val, key) {
//                         if (lunrSearch.getFields().indexOf(key) < 0) {
//                             lunrSearch.addField(key);
//                         }
//                     });
//
//
//                     doc.id = node.__node.identifier;
//                     $scope.nodes[doc.id] = node.__node;
//                     lunrSearch.addDoc(doc);
//
//
//
//                 }
//
//             });
//
//
//         });
//
//
//         $scope.terms = {};
//         searchData($scope.siteSearch);
//
//
//     };
//
//
//     searchData = function (term) {
//
//
//         var fields = {};
//
//
//         angular.forEach(lunrSearch.getFields(), function (v, k) {
//             fields[v] = {boost: config.boost[v] === undefined ? 1 : config.boost[v]}
//         });
//
//         console.log(getSpecialTerm(term) + " " + $scope.siteSearchAutocomplete);
//         var results = lunrSearch.search(getSpecialTerm(term) + " " + $scope.siteSearchAutocomplete, {
//             fields: fields,
//             bool: "OR"
//         });
//
//         $scope.searchResult = [];
//
//         angular.forEach(results, function (input, key) {
//
//             if ($scope.nodes[input.ref] !== undefined) {
//                 $scope.searchResult.push({
//                     score: input.score,
//                     properties: $scope.nodes[input.ref].properties,
//                     grandParentNode: $scope.nodes[input.ref].grandParentNode,
//                     nodeType: $scope.nodes[input.ref].nodeType
//                 });
//             }
//
//         });
//
//
//         setTimeout(function () {
//             $scope.$apply(); //this triggers a $digest
//         }, 10);
//
//
//     };
//
//
//     // Get a reference to the database service
//
//     getSpecialTerm = function (term) {
//
//         // help to find phone numbers
//         t = term.replace(/([0-9])( )/i, '$1');
//         t = t.replace(/([0-9]{2})/gi, '$1 ');
//
//         return term + " " + t;
//
//     };
//
//
//     getSearchTerms = function () {
//
//
//         $scope.siteSearchAutocomplete = '';
//         $scope.nodes = {};
//
//         var terms = [];
//         var s = $scope.siteSearch.toLowerCase().replace(filterReg, " ");
//         s = getSpecialTerm(s);
//
//         angular.forEach(s.split(" "), function (term, k) {
//             term = term.replace(filterReg, "");
//             if (term.length > 0) {
//                 terms.push(term);
//             }
//         });
//
//
//         angular.forEach(refAutocomplete, function (a, k) {
//             a.off();
//             if ($scope.terms[k] === undefined) {
//                 delete $scope.terms[k];
//             }
//         });
//
//
//         angular.forEach(terms, function (v) {
//
//
//             refAutocomplete[v.substr(0, config.magicSplit)] = firebase.database().ref("keywords/" + config.workspace + "/" + config.dimension);
//             refAutocomplete[v.substr(0, config.magicSplit)].orderByKey().startAt(v.substr(0, config.magicSplit)).limitToFirst(config.magicSplit * 2).once("value", function (dataSnapshot) {
//
//                 angular.forEach(dataSnapshot.val(), function (a, t) {
//                     if (t != v) {
//                         $scope.siteSearchAutocomplete = $scope.siteSearchAutocomplete + " " + t;
//                         getData(t);
//                     }
//                 });
//
//
//             });
//
//             if (v.length > config.magicSplit) {
//                 refAutocomplete[v] = firebase.database().ref("keywords/" + config.workspace + "/" + config.dimension + "/" + v);
//                 refAutocomplete[v].once("value", function (dataSnapshot) {
//                     if (dataSnapshot.val()) {
//                         $scope.siteSearchAutocomplete = '';
//                         angular.forEach(refAutocomplete, function (a, k) {
//                             a.off();
//                         });
//                         getData(v);
//
//
//                     }
//                 });
//             }
//
//
//         });
//
//
//         return terms;
//
//
//     };
//
//
//     $scope.$watch('siteSearch', function (prop) {
//
//         if (prop == '') {
//             $scope.terms = {};
//             $scope.nodes = {};
//
//             $scope.siteSearchAutocomplete = '';
//             angular.forEach(refAutocomplete, function (a, k) {
//                 a.off();
//             });
//
//             angular.forEach(refIndex, function (a, k) {
//                 a.off();
//             });
//
//             angular.forEach(refKeywords, function (a, k) {
//                 a.off();
//             });
//
//             applyData();
//
//         } else {
//
//             angular.forEach(getSearchTerms(), function (v) {
//                 if ($scope.terms[v] === undefined) {
//                     getData(v);
//                 }
//             });
//
//         }
//
//
//     });
//
//
// }
// ]);
//
//
//
