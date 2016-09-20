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

        function (firebaseObject, $hybridsearchResultsObject, $hybridsearchFilterObject) {


            /**
             * HybridsearchObject.
             * @param $hybridsearch hybridsearch object
             * @returns {HybridsearchObject}
             * @constructor
             */
            function HybridsearchObject(hybridsearch) {


                var results, filter, watchers, index, lunrSearch, nodes;


                results = new $hybridsearchResultsObject();
                filter = new $hybridsearchFilterObject();
                nodes = {};
                index = {};
                watchers = {};
                watchers.index = {};
                watchers.keywords = {};
                lunrSearch = elasticlunr(function () {
                    this.setRef('id');
                });


                if (!(this instanceof HybridsearchObject)) {
                    return new HybridsearchObject();
                }


                this.$$app = {
                    getResults: function () {
                        return results;
                    },
                    getFilter: function () {
                        return filter;
                    },
                    /**
                     * @returns mixed
                     */
                    search: function () {

                        var fields = {}, items = {}, self = this, finalitems = [];

                        angular.forEach(lunrSearch.getFields(), function (v, k) {
                            fields[v] = {boost: 1}
                        });


                        angular.forEach(lunrSearch.search(self.getFilter().getQueryString(), {
                            fields: fields,
                            bool: "OR"
                        }), function (item) {

                            var nodeId = item.ref.substring(item.ref.indexOf("://") + 3);


                            if (items[nodeId] === undefined) {
                                items[nodeId] = {
                                    score: 0,
                                    nodeType: nodes[nodeId].nodeType,
                                    properties: nodes[nodeId].properties
                                };
                            }

                            items[nodeId].score = items[nodeId].score + item.score;


                        });

                        // make propre array
                        angular.forEach(items, function (val, key) {
                            finalitems.push(val);
                        });


                        results.setResults(finalitems);

                    },

                    /**
                     * @returns mixed
                     */
                    setSearchIndex: function () {


                        var self = this;
                        nodes = {};

                        // unbind all previous defined keywords watchers
                        angular.forEach(watchers.keywords, function (unbind, key) {
                            unbind();
                            delete watchers.keywords[key];
                        });
                        // unbind all previous defined index watchers
                        angular.forEach(watchers.index, function (unbind, key) {
                            unbind();
                            delete watchers.index[key];
                        });

                        angular.forEach(this.getFilter().getQueryKeywords(), function (value, keyword) {
                            watchers.keywords[keyword] = self.getKeyword(keyword).$watch(function () {

                                self.getKeyword(keyword).$loaded(function (data) {
                                    if (data.$value) {

                                        // keyword was found
                                        watchers.index[keyword] = self.getIndex(keyword).$watch(function (obj) {
                                            self.getIndex(keyword).$loaded(function (data) {

                                                self.updateLocalIndex(keyword, data);

                                            });
                                        });

                                    }
                                });


                            });
                        });


                        this.cleanLocalIndex(watchers.keywords);


                    },
                    /**
                     * @param string querysegment
                     * @returns {firebaseObject}
                     */
                    getKeyword: function (querysegment) {

                        var ref = hybridsearch.$firebase().database().ref().child("keywords/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.dimension + "/" + querysegment);
                        return firebaseObject(ref);

                        // to take an action after the data loads, use the $loaded() promise
                        // var unwatch = obj.$watch(function () {
                        //
                        //     // To iterate the key/value pairs of the object, use angular.forEach()
                        //     angular.forEach(obj, function (value, key) {
                        //         console.log(key, value);
                        //     });
                        // });

                    },
                    /**
                     * @param string keyword
                     * @returns {firebaseObject}
                     */
                    getIndex: function (keyword) {

                        var ref = hybridsearch.$firebase().database().ref().child("index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.dimension);
                        var query = false;


                        if (query === false && keyword.length > 1 && this.getFilter().getNodeType()) {
                            query = ref.orderByChild(keyword).startAt(this.getFilter().getNodeType()).endAt(this.getFilter().getNodeType());
                        }

                        if (query === false && keyword.length > 1) {
                            query = ref.orderByChild(keyword);
                        }


                        if (query) {
                            return firebaseObject(query);
                        }

                        return firebaseObject(ref);
                    },
                    /**
                     * @param array
                     * @returns void
                     */
                    cleanLocalIndex: function (existingkeywords) {

                        var self = this;

                        angular.forEach(index, function (value, key) {
                            if (existingkeywords[value] === undefined) {
                                self.removeLocalIndex(value);
                            }
                        });

                    },
                    /**
                     * @param string keyword
                     * @param object data
                     * @returns void
                     */
                    updateLocalIndex: function (keyword, data) {
                        this.removeLocalIndex(keyword);
                        this.addLocalIndex(keyword, data);
                        this.search();

                    },
                    /**
                     * @param string keyword
                     * @returns mixed
                     */
                    removeLocalIndex: function (values) {

                        var keyword = false;
                        angular.forEach(values, function (key, doc) {

                            if (lunrSearch.documentStore.hasDoc(doc)) {
                                lunrSearch.documentStore.removeDoc(doc);
                            }
                            keyword = key;
                        });


                        try {
                            delete index[keyword];
                        } catch (e) {
                        }


                    },
                    /**
                     * @param string keyword
                     * @param object data
                     * @returns mixed
                     */
                    addLocalIndex: function (keyword, data) {

                        if (index[keyword] === undefined) {
                            index[keyword] = {};
                        }

                        angular.forEach(data, function (value, key) {


                            nodes[value['__node']['identifier']] = value['__node'];

                            if (value.__node != undefined && value.__node.properties != undefined) {

                                var doc = value.__node.properties;

                                angular.forEach(value.__node.properties, function (val, key) {
                                    if (lunrSearch.getFields().indexOf(key) < 0) {
                                        lunrSearch.addField(key);
                                    }
                                });

                                doc.id = keyword + "://" + value.__node.identifier;
                                lunrSearch.addDoc(doc);
                                index[keyword][doc.id] = keyword;

                            }


                        });


                    }

                };


                // this bit of magic makes $$conf non-enumerable and non-configurable
                // and non-writable (its properties are still writable but the ref cannot be replaced)
                // we redundantly assign it above so the IDE can relax
                Object.defineProperty(this, '$$conf', {
                    value: this.$$conf
                });
                Object.defineProperty(this, '$$app', {
                    value: this.$$app
                });


                //console.log(this.$$app.getIndex());

                // /**
                //  * @returns {HybridsearchObject}
                //  */
                // function getFirebaseIndex() {
                //
                //     if (unwatch !== undefined) {
                //         unwatch();
                //     }
                //
                //     console.log(this.$$app);
                //
                //     var ref = hybridsearch.$firebase().database().ref().child("index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.dimension);
                //     var query = ref.orderByChild("egli").startAt("phlu-corporate-contact").endAt("phlu-corporate-contact");
                //     var obj = firebaseObject(query);
                //
                //     // to take an action after the data loads, use the $loaded() promise
                //     var unwatch = obj.$watch(function () {
                //
                //         // To iterate the key/value pairs of the object, use angular.forEach()
                //         angular.forEach(obj, function (value, key) {
                //             console.log(key, value);
                //         });
                //     });
                //
                //
                // }
                //
                //
                // getFirebaseIndex();


            }


            HybridsearchObject.prototype = {

                /**
                 * @returns a promise which will resolve after the save is completed.
                 */
                $watch: function (callback) {
                    this.$$app.getResults().setCallbackMethod(callback);
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
                            if (searchInput !== undefined) {

                                self.$$app.setSearchIndex();
                            }
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

                var results = {};


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
                 * @param object
                 * @returns void
                 */
                setResults: function (results) {

                    this.$$data.results = results;
                    this.executeCallbackMethod();


                },

                /**
                 * @returns {HybridsearchResultsObject}
                 */
                setCallbackMethod: function (callback) {

                    this.$$data.callbackMethod = callback;

                    return this;

                },

                /**
                 * @returns mixed
                 */
                executeCallbackMethod: function () {

                    this.$$data.callbackMethod(this.$$data.results);
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


            var filterReg = /[^0-9a-zA-ZöäüÖÄÜ]/g;

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
                this.$$data = {};

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
                    return this.$$data.nodeType === undefined ? '' : this.$$data.nodeType;
                },

                /**
                 * @returns string
                 */
                getQuery: function () {
                    return this.$$data.query === undefined ? '' : this.$$data.query.toLowerCase();
                },

                /**
                 * @returns string
                 */
                getQueryString: function () {

                    var s = '';

                    angular.forEach(this.getQueryKeywords(), function (key, term) {
                        s += term + " ";
                    });

                    return s;
                },

                /**
                 * @returns object
                 */
                getQueryKeywords: function () {

                    var keywords = {};

                    if (this.$$data.query === undefined) {
                        return keywords;
                    }


                    var s = this.$$data.query.replace(filterReg, " ");
                    var t = s.replace(/([0-9])( )/i, '$1').replace(/([0-9]{2})/gi, '$1 ');
                    s = s + " " + t;

                    angular.forEach(s.split(" "), function (term) {
                        term = term.replace(filterReg, "");
                        if (term.length > 0) keywords[term] = true;
                    });

                    return keywords;

                }


            };


            return HybridsearchFilterObject;
        }
    ]);


})();