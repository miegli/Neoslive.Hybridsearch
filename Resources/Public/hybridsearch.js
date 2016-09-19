/*!
 * Neoslive hybridsaearch.
 *
 */
(function (exports) {
    "use strict";

    angular.module("hybridsearch.common", ['firebase']);
    angular.module("hybridsearch", ['firebase']);

    // Define the `hybridsearch` module under which all hybridsearch
    // services will live.
    angular.module("hybridsearch", ['hybridsearch.common'])
        .value("hybridsearch", exports.hybridsearch)
        .value("Hybridsearch", exports.hybridsearch);
})(window);


(function () {
    'use strict';
    /**
     *
     */
    angular.module('hybridsearch').factory('$hybridsearch', ['$hybridsearchObject',

        function ($hybridsearchObject) {


            /**
             * Hybridsearch.
             * @param string databaseUrl
             * @param string workspace
             * @param string dimension
             * @returns {HybridsearchObject}
             * @constructor
             */
            function Hybridsearch(databaseUrl, workspace, dimension) {


                if (!(this instanceof Hybridsearch)) {
                    return new Hybridsearch();
                }


                // Initialize the Firebase SDK
                var firebaseconfig = {
                    databaseURL: databaseUrl
                };
                firebase.initializeApp(firebaseconfig);


                // These are private config props and functions used internally
                // they are collected here to reduce clutter in console.log and forEach
                this.$$conf = {
                    firebase: firebaseconfig,
                    workspace: workspace,
                    dimension: dimension
                };

                // this bit of magic makes $$conf non-enumerable and non-configurable
                // and non-writable (its properties are still writable but the ref cannot be replaced)
                // we redundantly assign it above so the IDE can relax
                Object.defineProperty(this, '$$conf', {
                    value: this.$$conf
                });


            }

            Hybridsearch.prototype = {

                /**
                 * @returns a promise which will resolve after the save is completed.
                 */
                $firebase: function () {
                    var self = this;

                    return firebase;
                }

            }


            return Hybridsearch;
        }
    ]);


})();


(function () {
    'use strict';
    /**
     *
     */
    angular.module('hybridsearch.common').factory('$hybridsearchObject', ['$firebaseObject',

        function ($firebaseObject) {

            var instance = 0;


            /**
             * HybridsearchObject.
             * @param $hybridsearch hybridsearch object
             * @returns {HybridsearchObject}
             * @constructor
             */
            function HybridsearchObject(hybridsearch, scope) {


                instance++;


                if (scope.hybridsearchData === undefined) {
                    scope.hybridsearchData = {};
                }

                if (scope.hybridsearchData[instance] === undefined) {
                    scope.hybridsearchData[instance] = {};
                }

                if (scope.hybridsearchResult === undefined) {
                    scope.hybridsearchResult = {};
                }

                if (scope.hybridsearchResult[instance] === undefined) {
                    scope.hybridsearchResult[instance] = {};
                }

                scope.hybridsearchData[instance].filter = {
                    'nodeType': '',
                    'query': ''
                };

                scope.hybridsearchResult[instance] = 2;

                //
                // var ref = firebase.database().ref().child("index");
                //
                // // download the data into a local object
                // var test = $firebaseObject(ref);
                // // putting a console.log here won't work, see below
                //
                // test.$loaded()
                //     .then(function (data) {
                //             console.log(data);
                //         }
                //     );

                //  console.log(hybridsearch.$$conf.workspace);
                // console.log(hybridsearch.$firebase());


                if (!(this instanceof HybridsearchObject)) {
                    return new HybridsearchObject();
                }
                // These are private config props and functions used internally
                // they are collected here to reduce clutter in console.log and forEach
                this.$$conf = {
                    scope: scope,
                    boost: {
                        'phlu-corporate-contact-firstname': 100,
                        'phlu-corporate-contact-lastname': 300,
                        firstname: 100,
                        lastname: 100,
                        uriPathSegment: 150,
                        phone: 35,
                        street: 20,
                        email: 10,
                        title: 40,
                        text: 1
                    }
                };


                this.$$app = {
                    search: function (input) {
                        return input;
                    }
                };

                // this bit of magic makes $$conf non-enumerable and non-configurable
                // and non-writable (its properties are still writable but the ref cannot be replaced)
                // we redundantly assign it above so the IDE can relax
                Object.defineProperty(this, '$$conf', {
                    value: this.$$conf
                });

                // this bit of magic makes $$conf non-enumerable and non-configurable
                // and non-writable (its properties are still writable but the ref cannot be replaced)
                // we redundantly assign it above so the IDE can relax
                Object.defineProperty(this, '$$search', {
                    value: this.$$search
                });


                scope.$watch('hybridsearchData['+instance+']', function (data) {

                    scope.hybridsearchResult[instance] = data.filter.query;

                }, true);

            }

            HybridsearchObject.prototype = {

                /**
                 * @returns a promise which will resolve after the save is completed.
                 */
                $watch: function (callback) {

                    var self = this;

                    return this.$$conf.scope.$watch('hybridsearchResult['+instance+']', function (obj) {
                        callback(obj);
                    });

                },

                /**
                 * @param string nodeType to search only for
                 * @param boolean scopevar false if is simple string, true if is binded scope variable
                 * @returns HybridsearchObject
                 */
                nodeTypeFilter: function (nodeType, scopevar=false) {

                    var self = this;

                    if (scopevar) {
                        self.$$conf.scope.$watch(nodeType, function (filterNodeInput) {
                            self.$$conf.scope.hybridsearchData[instance].filter.nodeType = filterNodeInput;
                        });

                    } else {
                        self.$$conf.scope.hybridsearchData[instance].filter.nodeType = nodeType;
                    }

                    return this;

                },

                /**
                 * @param string input to search
                 * @param boolean scopevar false if is simple string, true if is binded scope variable
                 * @returns HybridsearchObject
                 */
                query: function (input, scopevar=false) {

                    var self = this;

                    if (scopevar) {
                        self.$$conf.scope.$watch(input, function (searchInput) {
                            self.$$conf.scope.hybridsearchData[instance].filter.query = searchInput;
                        });

                    } else {
                        self.$$conf.scope.hybridsearchData[instance].filter.query = input;
                    }


                    self.$$conf.scope.hybridsearchResult[instance] = 1;

                    return this;

                }

            }


            return HybridsearchObject;
        }
    ]);


})();
