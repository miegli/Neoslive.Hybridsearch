/*!
 * Neoslive hybridsaearch.
 *
 */
(function (exports) {
    "use strict";

    angular.module("hybridsearch.common", ['firebase']);
    angular.module("hybridsearch.results", ['firebase']);
    angular.module("hybridsearch.filter", ['firebase']);
    angular.module("hybridsearch", ['firebase']);

    // Define the `hybridsearch` module under which all hybridsearch
    // services will live.
    angular.module("hybridsearch", ['hybridsearch.common', 'hybridsearch.results', 'hybridsearch.filter'])
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
    angular.module('hybridsearch.common').factory('$hybridsearchObject', ['$firebaseObject', '$hybridsearchResultsObject', '$hybridsearchFilterObject',

        function ($firebaseObject, $hybridsearchResultsObject, $hybridsearchFilterObject) {


            /**
             * HybridsearchObject.
             * @param $hybridsearch hybridsearch object
             * @returns {HybridsearchObject}
             * @constructor
             */
            function HybridsearchObject(hybridsearch) {


                var results, filter;

                results = new $hybridsearchResultsObject();
                filter = new $hybridsearchFilterObject();


                if (!(this instanceof HybridsearchObject)) {
                    return new HybridsearchObject();
                }
                // These are private config props and functions used internally
                // they are collected here to reduce clutter in console.log and forEach
                this.$$conf = {
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
                    },
                    getResults: function () {
                        return results;
                    },
                    getFilter: function () {
                        return filter;
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
                Object.defineProperty(this, '$$app', {
                    value: this.$$app
                });

                //
                // scope.$watch('hybridsearchData[' + instance + ']', function (data) {
                //
                //     //scope.hybridsearchResult[instance] = data.filter.query;
                //
                // }, true);

            }

            HybridsearchObject.prototype = {

                /**
                 * @returns a promise which will resolve after the save is completed.
                 */
                $watch: function (callback) {
                    console.log(this.$$app.getResults().setCallbackMethod(callback));

                },

                /**
                 * @param string nodeType to search only for
                 * @param boolean scopevar false if is simple string  otherwise scope required for binding data
                 * @returns {HybridsearchObject}
                 */
                setNodeType: function (nodeType, scope=null) {

                    var self = this;

                    if (scope) {
                        self.$$conf.scope.$watch(nodeType, function (filterNodeInput) {
                            self.$$app.getFilter().setNodeType(searchInput);
                        });

                    } else {
                        self.$$app.getFilter().setNodeType(nodeType);
                    }

                    return this;

                },

                /**
                 * @param string input to search
                 * @param mixed scope null if is simple string otherwise scope required for binding data
                 * @returns {HybridsearchObject}
                 */
                setQuery: function (input, scope=null) {

                    var self = this;

                    if (scope) {
                        scope.$watch(input, function (searchInput) {
                            self.$$app.getFilter().setQuery(searchInput);
                        });

                    } else {
                        self.$app.getFilter().setQuery(input);
                    }

                    return this;

                }

            }


            return HybridsearchObject;
        }
    ]);


})();


(function () {
    'use strict';
    /**
     *
     */
    angular.module('hybridsearch.results').factory('$hybridsearchResultsObject', [

        function () {

            /**
             * HybridsearchResultsObject.
             * @returns {HybridsearchResultsObject}
             * @constructor
             */
            function HybridsearchResultsObject() {




                if (!(this instanceof HybridsearchResultsObject)) {
                    return new HybridsearchResultsObject();
                }

                this.$$data = {
                    callbackMethod: function () {
                        return null;
                    }
                };

                // this bit of magic makes $$data non-enumerable and non-configurable
                // and non-writable (its properties are still writable but the ref cannot be replaced)
                // we redundantly assign it above so the IDE can relax
                Object.defineProperty(this, '$$data', {
                    value: this.$$data
                });


                return this;

            }


            HybridsearchResultsObject.prototype = {

                /**
                 * @returns {HybridsearchResultsObject}
                 */
                setCallbackMethod: function (callback) {

                    this.$$data.callbackMethod = callback;

                    return this;

                }

            };


            return HybridsearchResultsObject;
        }
    ]);


})();

(function () {
    'use strict';
    /**
     *
     */
    angular.module('hybridsearch.filter').factory('$hybridsearchFilterObject', [

        function () {

            /**
             * HybridsearchFilterObject.
             * @returns {HybridsearchFilterObject}
             * @constructor
             */
            function HybridsearchFilterObject() {


                if (!(this instanceof HybridsearchFilterObject)) {
                    return new HybridsearchFilterObject();
                }


                // These are private config props and functions used internally
                // they are collected here to reduce clutter in console.log and forEach
                this.$$data = {
                    query: '',
                    filter: ''
                };

                // this bit of magic makes $$conf non-enumerable and non-configurable
                // and non-writable (its properties are still writable but the ref cannot be replaced)
                // we redundantly assign it above so the IDE can relax
                Object.defineProperty(this, '$$data', {
                    value: this.$$data
                });


                return this;

            }


            HybridsearchFilterObject.prototype = {


                /**
                 * @param string nodeType to search only for
                 * @returns HybridsearchObject
                 */
                setNodeType: function (nodeType) {
                    this.$$data.nodeType = nodeType;
                    return this;
                },

                /**
                 * @param string input to search
                 * @returns HybridsearchObject
                 */
                setQuery: function (query) {
                    this.$$data.query = query;
                    return this;
                },

                /**
                 * @returns string
                 */
                getNodeType: function () {
                    return this.$$data.nodeType;
                },

                /**
                 * @returns string
                 */
                getQuery: function () {
                    return this.$$data.query;
                }


            };


            return HybridsearchFilterObject;
        }
    ]);


})();