/**
 * @license Neoslive.Hybridsearch Copyright (c) 2016, Michael Egli All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: https://github.com/miegli/Neoslive.Hybridsearch for details
 *
 * Hybridsearch
 * Version 1.0.0
 * Copyright 2016 Michael Egli
 * All Rights Reserved.
 * Use, reproduction, distribution, and modification of this code is subject to the terms and
 * conditions of the MIT license, available at http://www.opensource.org/licenses/mit-license.php
 *
 * Author: Michael Egli
 * Project: https://github.com/miegli/Neoslive.Hybridsearch
 *
 *
 * @private
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
     * @private
     * @module Angular main module
     * @returns {hybridsearch}
     */
    angular.module('hybridsearch').factory('$hybridsearch', ['$hybridsearchObject',

        function () {

            /**
             * @class Hybridsearch
             * @param databaseURL {string} databaseURL, google firebase realtime database endpoint
             * @param workspace {string} workspace, identifier of the workspace to use from indexed datebase
             * @param dimension {string} dimension, hash of the dimension configuration to use form indexed database
             * @example
             * var hybridSearch = new $hybridsearchObject(
             *  'https://<DATABASE_NAME>.firebaseio.com',
             *  'live',
             *  'fb11fdde869d0a8fcfe00a2fd35c031d'
             * ));
             * @returns {Hybridsearch} used for HybridsearchObject constructor.
             */
            function Hybridsearch(databaseURL, workspace, dimension) {


                if (!(this instanceof Hybridsearch)) {
                    return new Hybridsearch();
                }


                // Initialize the Firebase SDK
                var firebaseconfig = {
                    databaseURL: databaseURL
                };
                try {
                    firebase.initializeApp(firebaseconfig);
                } catch (e) {
                    // firebase was initizalized before
                }


                this.$$conf = {
                    firebase: firebaseconfig,
                    workspace: workspace,
                    dimension: dimension
                };
                Object.defineProperty(this, '$$conf', {
                    value: this.$$conf
                });


            }

            Hybridsearch.prototype = {

                /**
                 * @private
                 * @returns Firebase App
                 */
                $firebase: function () {
                    return firebase;
                }


            };


            return Hybridsearch;
        }
    ]);


})();


(function () {
    'use strict';
    /**
     * @private
     * @module Angular main module
     * @returns {hybridsearch}
     */
    angular.module('hybridsearch.common').factory('$hybridsearchObject', ['$firebaseObject', '$hybridsearchResultsObject', '$hybridsearchFilterObject',

        /**
         * @private
         * @param firebaseObject
         * @param $hybridsearchResultsObject
         * @param $hybridsearchFilterObject
         * @returns {HybridsearchObject}
         */
            function (firebaseObject, $hybridsearchResultsObject, $hybridsearchFilterObject) {

            /**
             * @example
             * var hybridSearch = new HybridsearchObject(
             *  'https://<DATABASE_NAME>.firebaseio.com',
             *  'live',
             *  'fb11fdde869d0a8fcfe00a2fd35c031d'
             * ));
             * var mySearch = new HybridsearchObject(hybridSearch);
             *      mySearch.setQuery("Foo").addPropertyFilter('title', 'Foo').setNodeType('bar').$watch(function (data) {
             *        console.log(data);
             *      });
             * @param {Hybridsearch} Hybridsearch see Hybridsearch constructor
             * @constructor HybridsearchObject
             */
            var HybridsearchObject = function (hybridsearch) {

                var results, filter, index, lunrSearch, nodes, nodeTypeLabels, lastFilterHash, propertiesBoost, isRunning, searchTimer, searchTimerTimestamp;

                isRunning = false;
                searchTimerTimestamp = Date.now();
                results = new $hybridsearchResultsObject();
                filter = new $hybridsearchFilterObject();
                nodeTypeLabels = {};
                nodes = {};
                index = {};
                lunrSearch = elasticlunr(function () {
                    this.setRef('id');
                });


                /**
                 * init ga data
                 */
                if (filter.getGa() === undefined) {
                    hybridsearch.$firebase().database().ref().child("ga").orderByChild("url").equalTo(location.href).limitToFirst(1).once('value', function (data) {
                        angular.forEach(data.val(), function (val) {
                            filter.setGa(val);
                        });
                    });
                }


                /**
                 *
                 * @param nodeData {object|array} Nodes properties.
                 * @param score {float} computed Relevance score.
                 * @constructor
                 */
                var HybridsearchResultsNode = function (nodeData, score) {

                    var self = this;

                    angular.forEach(nodeData, function (val, key) {
                        self[key] = val;
                    });
                    self.score = score;

                };

                HybridsearchResultsNode.prototype = {

                    /**
                     * NodeType.
                     * @returns {string} nodeType
                     */
                    getNodeType: function () {
                        return this.nodeType !== undefined ? this.nodeType : '';
                    },

                    /**
                     * Properties.
                     * @returns {object}
                     */
                    getProperties: function () {
                        return this.properties;
                    },

                    /**
                     * Relevance score of search result.
                     * @returns {float}
                     */
                    getScore: function () {
                        return this.score !== undefined ? this.score : 0;
                    },

                    /**
                     * @private
                     * @returns float
                     */
                    addScore: function (score) {
                        this.score = this.score + score;
                    },

                    /**
                     * Is result a turbo node or not.
                     * @returns {boolean}
                     */
                    isTurboNode: function () {
                        return this.turbonode === undefined ? false : this.turbonode;
                    },

                    /**
                     * Get property.
                     * @param {string} property Get single property from node data.
                     * @returns {mixed}
                     */
                    getProperty: function (property) {

                        var value = '';

                        if (this.properties[property] !== undefined) {
                            return this.properties[property];
                        }

                        angular.forEach(this.properties, function (val, key) {
                            if (value === '' && key.substr(key.length - property.length, property.length) === property) {
                                value = val !== undefined ? val : '';
                            }
                        });

                        return value;

                    },

                    /**
                     * Url if its a document node.
                     * @returns {string}
                     */
                    getUrl: function () {
                        return this.url === undefined ? '' : this.url;
                    },

                    /**
                     * Breadcrumb if its a document node.
                     * @returns {string}
                     */
                    getBreadcrumb: function () {
                        return this.breadcrumb === undefined ? '' : this.breadcrumb;
                    },

                    /**
                     * Preview html content of node.
                     * @returns {string}
                     */
                    getPreview: function () {
                        return this.properties.rawcontent === undefined ? '' : this.properties.rawcontent;
                    },

                    /**
                     * Parent node.
                     * @returns {HybridsearchResultsNode}
                     */
                    getParent: function () {
                        return this.parentNode ? new HybridsearchResultsNode(this.parentNode) : false;
                    },

                    /**
                     * Nearest Document node.
                     * @returns {HybridsearchResultsNode}
                     */
                    getDocumentNode: function () {
                        return this.grandParentNode ? new HybridsearchResultsNode(this.grandParentNode) : false;
                    }

                };


                this.$$app = {

                    /**
                     * @private
                     */
                    searchTimerInterval: false,

                    /**
                     * @private
                     */
                    setIsRunning: function () {
                        isRunning = true;
                    },
                    /**
                     * @private
                     * @returns {boolean}
                     */
                    isRunning: function () {
                        return isRunning;
                    },
                    /**
                     * @private
                     * @returns {{}|*}
                     */
                    getNodeTypeLabels: function () {
                        return nodeTypeLabels;
                    },
                    /**
                     * @private
                     * @param nodeType
                     * @returns {*}
                     */
                    getNodeTypeLabel: function (nodeType) {
                        return nodeTypeLabels[nodeType] !== undefined ? nodeTypeLabels[nodeType] : nodeType;
                    },
                    /**
                     * @private
                     * @returns {*}
                     */
                    getPropertiesBoost: function () {
                        return propertiesBoost;
                    },
                    /**
                     * @private
                     * @param property
                     * @returns {number}
                     */
                    getBoost: function (property) {
                        return propertiesBoost[property] ? propertiesBoost[property] : 10;
                    },
                    /**
                     * @private
                     * @param labels
                     */
                    setNodeTypeLabels: function (labels) {
                        results.$$app.setNodeTypeLabels(labels);
                        nodeTypeLabels = labels;
                    },
                    /**
                     * @private
                     * @param boost
                     */
                    setPropertiesBoost: function (boost) {
                        propertiesBoost = boost;
                    },
                    /**
                     * @private
                     * @returns {hybridsearchResultsObject}
                     */
                    getResults: function () {
                        return results;
                    },
                    /**
                     * @private
                     * @returns {hybridsearchFilterObject}
                     */
                    getFilter: function () {
                        return filter;
                    },
                    /**
                     * @private
                     * @returns mixed
                     */
                    search: function () {


                        var fields = {}, items = {}, self = this, nodesFound = {};

                        items['_nodes'] = {};
                        items['_nodesTurbo'] = {};
                        items['_nodesByType'] = {};


                        if (!self.getFilter().getFullSearchQuery()) {
                            // return all nodes bco no query set
                            angular.forEach(nodes, function (node) {
                                if (self.isFiltered(node) === false) {
                                    self.addNodeToSearchResult(node.identifier, 1, nodesFound, items);
                                }

                            });


                        } else {


                            // execute query search
                            angular.forEach(lunrSearch.getFields(), function (v, k) {
                                fields[v] = {boost: self.getBoost(v)}
                            });


                            console.log(self.getFilter().getFullSearchQuery());

                            angular.forEach(lunrSearch.search(self.getFilter().getFullSearchQuery(), {
                                    fields: fields,
                                    bool: "OR"
                                }), function (item) {

                                    if (nodes[item.ref] !== undefined) {
                                        if (nodes[item.ref] !== undefined) {
                                            self.addNodeToSearchResult(item.ref, item.score, nodesFound, items);
                                        }
                                    }
                                }
                            );

                        }


                        results.getApp().setResults(items);

                    },


                    /**
                     * @private
                     * @param integer nodeId
                     * @param float score relevance
                     * @param array nodesFound list
                     * @param array items list
                     * @returns boolean
                     */
                    addNodeToSearchResult: function (nodeId, score, nodesFound, items) {

                        var skip = false;
                        var hash = nodes[nodeId].hash;
                        var nodeTypeLabel = nodeTypeLabels[nodes[nodeId].nodeType] !== undefined ? nodeTypeLabels[nodes[nodeId].nodeType] : nodes[nodeId].nodeType;

                        // filter out minimal scored nodes
                        if (this.getFilter().getFullSearchQuery() && score < 1) {
                            return false;
                        }


                        if (items['_nodesByType'][nodeTypeLabel] === undefined) {
                            items['_nodesByType'][nodeTypeLabel] = {};
                        }

                        if (nodesFound[hash] !== undefined) {

                            if (items['_nodesTurbo'][hash] !== undefined) {
                                items['_nodesTurbo'][hash].addScore(score);
                            }
                            if (items['_nodes'][hash] !== undefined) {
                                items['_nodes'][hash].addScore(score);
                            }
                            if (items['_nodesByType'][nodeTypeLabel][hash] !== undefined) {
                                items['_nodesByType'][nodeTypeLabel][hash].addScore(score);
                            }

                            skip = true;
                        }


                        if (skip === false) {

                            if (nodes[nodeId]['turbonode'] === true) {
                                items['_nodesTurbo'][hash] = new HybridsearchResultsNode(nodes[nodeId], score);
                            } else {
                                items['_nodes'][hash] = new HybridsearchResultsNode(nodes[nodeId], score);
                            }


                            items['_nodesByType'][nodeTypeLabel][hash] = new HybridsearchResultsNode(nodes[nodeId], score);
                        }

                        nodesFound[hash] = true;
                    },


                    /**
                     * @private
                     * @returns boolean
                     */
                    isFiltered: function (node) {

                        if (this.getFilter().getNodePath().length > 0 && node.uri.path.substr(0, this.getFilter().getNodePath().length) != this.getFilter().getNodePath()) {
                            return true;
                        }

                        var propertyFiltered = Object.keys(this.getFilter().getPropertyFilters()).length > 0 ? true : false;

                        if (propertyFiltered) {
                            var propertyNotFound = false;
                            angular.forEach(this.getFilter().getPropertyFilters(), function (value, property) {

                                if (propertyNotFound === false && node.properties[property] !== undefined) {
                                    if (node.properties[property] === value) {
                                        propertyFiltered = false;
                                    } else {
                                        propertyNotFound = true;
                                    }
                                }
                            });
                        }

                        if (propertyFiltered === false && this.getFilter().getAgeFilter() != '') {
                            if (this.getFilter().getPropertyFilters() != node.__userAgeBracket) {
                                return false;
                            }
                        }

                        if (propertyFiltered === false && this.getFilter().getGenderFilter() != '') {
                            if (this.getFilter().getGenderFilter() != node.__userGender) {
                                return false;
                            }
                        }


                        return propertyFiltered;

                    },

                    /**
                     * @private
                     * @returns mixed
                     */
                    setSearchIndex: function () {


                        var searchTimerDelta = Date.now() - searchTimerTimestamp;

                        if (searchTimerDelta > 1000) {
                            searchTimerDelta = 10;
                        }


                        if (searchTimer) {
                            clearTimeout(searchTimer);
                        }

                        var self = this;

                        searchTimer = setTimeout(function () {

                            // if (self.getFilter().getNodeType()) {

                            // if (lastFilterHash != filter.getHash()) {

                            // nodes = {};
                            // get all nodes by types without keyword
                            // don't process nodes over lunr search in this case
                            //  self.getIndex().on("value", function (data) {
                            //      updates[self.getFilter().getNodeType()] = data.val();
                            //     self.updateLocalIndex(updates);

                            // });

                            // } else {

                            // }

                            // } else {


                            if (self.isRunning() && filter.hasFilters()) {

                                nodes = {};


                                results.$$app.clearResults();
                                filter.setAutocompletedKeywords('');
                                self.cleanLocalIndex();

                                // unbind index watcher
                                angular.forEach(index, function (unbind) {
                                    unbind.off();
                                });
                                index = {};

                                var isMatchExact = {};


                                angular.forEach(self.getFilter().getQueryKeywords(), function (keyword) {

                                        isMatchExact[keyword] = false;

                                        if (keyword.length > 2 || (keyword.length === 2 && isNaN(keyword) === false)) {


                                            self.getKeywords(keyword).once("value", function (data) {


                                                angular.forEach(data.val(), function (val, keywordsegment) {

                                                    if (!isMatchExact[keyword]) {

                                                        // keyword was found
                                                        if (

                                                            filter.$$data.magickeywords.search(" " + keywordsegment + "") >= 0
                                                            ||
                                                            keyword == keywordsegment
                                                            ||
                                                            filter.$$data.magickeywords.search(" " + keywordsegment.substr(0, 6) + "") >= 0

                                                        ) {


                                                            filter.addAutocompletedKeywords(keywordsegment);
                                                            if (index[keywordsegment] === undefined) {
                                                                self.getIndex(keywordsegment).on("value", function (data) {
                                                                    if (data !== undefined) {
                                                                        self.updateLocalIndex(data.val());
                                                                    }
                                                                });
                                                            }

                                                        }


                                                    }


                                                    if (keywordsegment == keyword) {
                                                        isMatchExact[keyword] = true;
                                                    }


                                                });


                                            });


                                        }

                                    }
                                );


                            }
                            //  }


                            // lastFilterHash = filter.getHash();


                        }, searchTimerDelta);


                        searchTimerTimestamp = Date.now();


                    },
                    /**
                     * @private
                     * @param string querysegment
                     * @returns {firebaseObject}
                     */
                    getKeyword: function (querysegment) {

                        return hybridsearch.$firebase().database().ref().child("keywords/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.dimension + "/" + querysegment);
                    }
                    ,
                    /**
                     * @private
                     * @param string querysegment
                     * @returns {firebaseObject}
                     */
                    getKeywords: function (querysegment) {

                        if (querysegment.length >= 8) {
                            var substr = querysegment.substring(0, querysegment.length - 3);
                        } else {
                            var substr = querysegment;
                        }

                        return hybridsearch.$firebase().database().ref().child("keywords/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.dimension + "/").orderByKey().startAt(substr.toLowerCase()).limitToFirst(10);
                    }
                    ,
                    /**
                     * @private
                     * @param string keyword
                     * @returns {firebaseObject}
                     */
                    getIndex: function (keyword) {


                        if (keyword === undefined) {
                            keyword = this.getFilter().getQuery() ? this.getFilter().getQuery() : '';
                        }

                        var ref = hybridsearch.$firebase().database().ref().child("index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.dimension);
                        var query = false;

                        if (query === false && this.getFilter().getNodeType()) {
                            if (keyword === "") {
                                query = ref.orderByChild("_nodetype").equalTo(this.getFilter().getNodeType());
                                keyword = this.getFilter().getNodeType();
                            } else {
                                query = ref.orderByChild("_nodetype" + keyword).equalTo(this.getFilter().getNodeType()).limitToFirst(250);
                            }

                        }


                        if (query === false) {
                            query = ref.orderByChild(keyword).equalTo(1).limitToFirst(100);
                        }

                        index[keyword] = query;

                        return query;

                    }
                    ,
                    /**
                     * @private
                     * @param array
                     * @returns void
                     */
                    cleanLocalIndex: function () {


                        nodes = {};

                        lunrSearch = elasticlunr(function () {
                            this.setRef('id');
                        });

                    }
                    ,
                    /**
                     * @private
                     * @param object data
                     * @returns void
                     */
                    updateLocalIndex: function (data) {


                        var self = this;


                        if (self.getFilter().getFullSearchQuery()) {


                            // add to lunr search index
                            //self.cleanLocalIndex();
                            self.addLocalIndex(data);

                            // angular.forEach(data, function (val, keyword) {
                            //     //self.removeLocalIndex(keyword);
                            //     self.addLocalIndex(keyword, val);
                            // });


                        } else {

                            // add to local index
                            angular.forEach(data, function (value) {
                                nodes[value['_node']['identifier']] = value['_node'];
                            });


                        }

                        self.search();


                    }
                    ,
                    /**
                     * @private
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


                    }
                    ,
                    /**
                     * @private
                     * @param string keyword
                     * @param object data
                     * @returns mixed
                     */
                    addLocalIndex: function (data) {

                        var self = this;


                        angular.forEach(data, function (value, key) {


                            if (self.isFiltered(value['_node']) === false) {

                                nodes[value['_node']['identifier']] = value['_node'];

                                if (value._node != undefined && value._node.properties != undefined) {

                                    var doc = value._node.properties;

                                    angular.forEach(value._node.properties, function (val, key) {
                                        if (lunrSearch.getFields().indexOf(key) < 0) {
                                            lunrSearch.addField(key);
                                        }
                                    });

                                    doc.id = value._node.identifier;
                                    lunrSearch.addDoc(doc);
                                }

                            }


                        });


                    }

                };


                Object.defineProperty(this, '$$conf', {
                    value: this.$$conf
                });
                Object.defineProperty(this, '$$app', {
                    value: this.$$app
                });


            };


            HybridsearchObject.prototype = {

                /**
                 * @param {function} callback method called whenever results are loaded
                 * @example
                 *   .$watch(function (data) {
                 *           $scope.result = data;
                 *           setTimeout(function () {
                 *               $scope.$digest();
                 *           }, 10);
                 *   });
                 *
                 * @returns {HybridsearchObject}
                 */
                $watch: function (callback) {

                    this.$$app.getResults().getApp().setCallbackMethod(callback);
                    this.run();
                    return this;
                },

                /**
                 * @private
                 * run search and perform queries
                 * @returns  {HybridsearchObject}
                 */
                run: function () {

                    this.$$app.setIsRunning();
                    this.$$app.setSearchIndex();

                },


                /**
                 * @param {string} nodeType to search only for
                 * @param {scope} scope false if is simple string otherwise angular scope required for binding data
                 * @returns {HybridsearchObject}
                 */
                setNodeType: function (nodeType, scope=null) {

                    var self = this;

                    if (scope) {
                        scope.$watch(nodeType, function (filterNodeInput) {
                            self.$$app.getFilter().setNodeType(filterNodeInput);
                            self.$$app.setSearchIndex();
                        });

                    } else {
                        self.$$app.getFilter().setNodeType(nodeType);
                        self.$$app.setSearchIndex();
                    }

                    return this;

                },

                /**
                 * Adds a property filter to the query.
                 * @param {string} property to search only for
                 * @param {string} value that property must match
                 * @param {scope} scope false if is simple string otherwise angular scope required for binding data
                 * @returns {HybridsearchObject}
                 */
                addPropertyFilter: function (property, value, scope=null) {

                    var self = this;

                    if (scope) {
                        scope.$watch(value, function (v) {
                            self.$$app.getFilter().addPropertyFilter(property, v);
                            self.$$app.setSearchIndex();
                        });

                    } else {
                        self.$$app.getFilter().addPropertyFilter(property, value);
                        self.$$app.setSearchIndex();
                    }

                    return this;

                },

                /**
                 * Adds a gender filter to the query. Show only nodes, that are visited mostly by given gender
                 * @param {string} gender male|female
                 * @param {scope} scope false if is simple string otherwise angular scope required for binding data
                 * @returns {HybridsearchObject}
                 */
                setGenderFilter: function (gender, scope=null) {

                    var self = this;

                    if (scope) {
                        scope.$watch(gender, function (v) {
                            self.$$app.getFilter().setGenderFilter(v);
                            self.$$app.setSearchIndex();
                        });

                    } else {
                        self.$$app.getFilter().setGenderFilter(gender);
                        self.$$app.setSearchIndex();
                    }

                    return this;

                },

                /**
                 * Adds an ange filter to the query. Show only nodes, that are visited mostly by given age bracket
                 * @param {string} age [18-24,25-34,35-44,45-54,55-64,65+]
                 * @param {scope} scope false if is simple string otherwise angular scope required for binding data
                 * @returns {HybridsearchObject}
                 */
                setAgeFilter: function (age, scope=null) {

                    var self = this;

                    if (scope) {
                        scope.$watch(age, function (v) {
                            self.$$app.getFilter().setAgeFilter(v);
                            self.$$app.setSearchIndex();
                        });

                    } else {
                        self.$$app.getFilter().setAgeFilter(age);
                        self.$$app.setSearchIndex();
                    }

                    return this;

                },

                /**
                 * Sets a node path filter.
                 * @param {string} nodePath to search only for
                 * @param {scope} scope false if is simple string otherwise angular scope required for binding data
                 * @returns {HybridsearchObject}
                 */
                setNodePath: function (nodePath, scope=null) {

                    var self = this;

                    if (scope) {

                        scope.$watch(nodePath, function (filterNodeInput) {
                            self.$$app.getFilter().setNodePath(filterNodeInput);
                            self.$$app.setSearchIndex();
                        });

                    } else {
                        self.$$app.getFilter().setNodePath(nodePath);
                        self.$$app.setSearchIndex();

                    }

                    return this;

                },


                /**
                 * Sets a search string to the query.
                 * @param {string} search string
                 * @param {scope} scope false if is simple string otherwise angular scope required for binding data
                 * @returns {HybridsearchObject}
                 */
                setQuery: function (input, scope=null) {

                    var self = this, lastinterval = 0;

                    if (scope) {


                        scope.$watch(input, function (searchInput) {
                            self.$$app.getFilter().setQuery(scope[input]);
                            if (searchInput !== undefined) {
                                self.$$app.setSearchIndex();
                            }
                        });

                    } else {
                        self.$$app.getFilter().setQuery(input);
                        self.$$app.setSearchIndex();
                    }

                    return this;

                },

                /**
                 * Sets node type labels.
                 * @param {object} nodetypelabels
                 * @example var nodetypelabels = {
                 *        'nodeType': 'Label',
                 *        'corporate-contact': 'Contacts',
                 *        'corporate-headline': 'Pages',
                 *        'corporate-onepage': 'Pages',
                 *        'corporate-table': 'Pages',
                 *        'corporate-file': 'Files'
                 *    }
                 * @returns {$hybridsearchResultsObject|*}
                 */
                setNodeTypeLabels: function (nodetypelabels) {
                    var self = this;
                    self.$$app.setNodeTypeLabels(nodetypelabels);
                    return this;
                },

                /**
                 * Sets property boost.
                 * @param {object} propertiesboost
                 * @example var propertiesboost = {
                 *        'nodeType-propertyname': 1,
                 *        'corporate-contact-lastname': 10,
                 *        'corporate-contact-firstname': 10,
                 *        'corporate-contact-email': 50,
                 *        'corporate-headline-text': 60,
                 *        'corporate-onepage-text': 1,
                 *        'corporate-table-text': 1,
                 *        'corporate-file-title': 3'
                 *    }
                 * @returns {$hybridsearchResultsObject|*}
                 */
                setPropertiesBoost: function (propertiesboost) {
                    var self = this;
                    self.$$app.setPropertiesBoost(propertiesboost);
                    return this;
                },

                /**
                 * @param {string} add hidden keyword uses in search query.
                 * @param {scope} scope false if is simple string otherwise angular scope required for binding data
                 * @returns {HybridsearchObject}
                 */
                addAdditionalKeywords: function (input, scope=null) {

                    var self = this;

                    if (scope) {
                        scope.$watch(input, function (searchInput) {
                            self.$$app.getFilter().setAdditionalKeywords(searchInput);
                        });

                    } else {
                        self.$$app.getFilter().addAdditionalKeywords(input);
                    }

                    return this;

                }

            };


            return HybridsearchObject;
        }
    ]);


})
();


(function () {
    'use strict';
    /**
     * @private
     * @module Angular results module
     * @returns {HybridsearchResultsObject}
     */
    angular.module('hybridsearch.results').factory('$hybridsearchResultsObject', [

        function () {

            /**
             * HybridsearchResultsDataObject
             * @constructor
             */
            var HybridsearchResultsDataObject = function () {

            };

            HybridsearchResultsDataObject.prototype = {

                /**
                 * Get number of search results in this group.
                 * @returns {integer} Search results length.
                 */
                count: function () {
                    return !this._nodes ? 0 : Object.keys(this._nodes).length;
                },

                /**
                 * Get groups label.
                 * @returns {string} Group label
                 */
                getLabel: function () {
                    return this.label !== undefined ? this.label : '';
                },


                /**
                 * Get all nodes for this group from current search result.
                 * @returns {array} collection of {HybridsearchResultsNode}
                 */
                getNodes: function () {
                    return this._nodes !== undefined ? this._nodes : [];
                }

            };

            /**
             * HybridsearchResultsGroupObject
             * @constructor
             */
            var HybridsearchResultsGroupObject = function () {

                this.items = [];


            };

            HybridsearchResultsGroupObject.prototype = {

                /**
                 * Get number of search results.
                 * @returns {integer} Search results length.
                 */
                count: function () {
                    return !this.items ? 0 : Object.keys(this.items).length;
                },

                /**
                 * Get group collection.
                 * @returns {array} collection of {HybridsearchResultsDataObject}
                 */
                getItems: function () {
                    return !this.items ? {} : this.items;
                },

                /**
                 * @private
                 * @returns {{HybridsearchResultsGroupObject}}
                 */
                addItem: function (label, value) {
                    var item = new HybridsearchResultsDataObject();
                    item.label = label;

                    var sorteable = [];

                    angular.forEach(value, function (v, k) {
                        if (k !== 'group') {
                            sorteable.push(v);
                        }
                    });

                    item._nodes = sorteable;

                    this.items.push(item);
                    return this;
                }

            };

            /**
             * Return the search results as {HybridsearchResultsObject}.
             * @returns {HybridsearchResultsObject}
             * @constructor
             */
            function HybridsearchResultsObject() {

                var nodeTypeLabels = {};

                /**
                 * HybridsearchResultsDataObject
                 * @constructor
                 */
                var HybridsearchResultsDataObject = function () {

                };


                if (!(this instanceof HybridsearchResultsObject)) {
                    return new HybridsearchResultsObject();
                }


                var self = this;


                this.$$data = {
                    results: new HybridsearchResultsDataObject(),
                    groups: new HybridsearchResultsGroupObject()
                };

                this.$$app = {

                    /**
                     * @private
                     * @param results
                     */
                    setResults: function (results) {

                        this.clearResults();


                        angular.forEach(results, function (val, key) {

                            var sorteable = [];

                            angular.forEach(val, function (v, k) {

                                if (key === '_nodesByType') {
                                    v.group = k;
                                    sorteable.push(v);
                                } else {
                                    sorteable.push(v);
                                }


                            });

                            self.$$data.results[key] = sorteable;


                        });


                        this.executeCallbackMethod(self);

                        return self;

                    },
                    /**
                     * @private
                     */
                    clearResults: function () {
                        self.$$data.results = new HybridsearchResultsDataObject();
                        self.$$data.groups = new HybridsearchResultsGroupObject();
                    },
                    /**
                     * @private
                     * @returns {HybridsearchResultsDataObject|*}
                     */
                    getResultsData: function () {
                        return self.$$data.results;
                    },

                    /**
                     * @private
                     * @returns {null}
                     */
                    callbackMethod: function () {
                        return null;
                    },

                    /**
                     * @private
                     * @returns {HybridsearchResultsObject}
                     */
                    setCallbackMethod: function (callback) {
                        this.callbackMethod = callback;
                        return this;

                    },

                    /**
                     * @private
                     * @returns mixed
                     */
                    executeCallbackMethod: function (self) {

                        this.callbackMethod(self);

                    },

                    getNodeTypeLabels: function () {
                        return nodeTypeLabels;
                    },

                    getNodeTypeLabel: function (nodeType) {
                        return nodeTypeLabels[nodeType] !== undefined ? nodeTypeLabels[nodeType] : nodeType;
                    },

                    setNodeTypeLabels: function (labels) {
                        nodeTypeLabels = labels;
                    }

                };


                Object.defineProperty(this, '$$app', {
                    value: this.$$app
                });
                Object.defineProperty(this, '$$data', {
                    value: this.$$data
                });


                return this;

            }


            HybridsearchResultsObject.prototype = {


                /**
                 * @private
                 * @returns $$app
                 */
                getApp: function () {
                    return this.$$app;
                },

                /**
                 * @private
                 * @returns {{DataObject}}
                 */
                getData: function () {
                    return this.$$app.getResultsData();
                },
                /**
                 *
                 * Get hash of results
                 * @returns {string} Search results hash
                 */
                getHash: function () {
                    return Sha1.hash(JSON.stringify(this.$$data));
                },
                /**
                 * Get number of search results.
                 * @returns {integer} Search results length.
                 */
                count: function () {
                    return !this.getNodes() ? 0 : Object.keys(this.$$app.getResultsData()._nodes).length;
                },
                /**
                 *
                 * Get number of search results by given node type..
                 * @param {string} nodeType
                 * @returns {integer} Search results length.
                 */
                countByNodeType: function (nodeType) {
                    return !this.getNodesByNodeType(nodeType) ? 0 : Object.keys(this.getNodesByNodeType(nodeType)).length;
                },
                /**
                 *
                 * Get number of search results by given node type label.
                 * @param {string} nodeTypeLabel
                 * @returns {integer} Search results length.
                 */
                countByNodeTypeLabel: function (nodeTypeLabel) {
                    return !this.getNodesByNodeTypeLabel(nodeTypeLabel) ? 0 : Object.keys(this.getNodesByNodeTypeLabel(nodeTypeLabel)).length;
                },

                /**
                 * Get all turbonodes from current search result.
                 * @returns {array} collection of {HybridsearchResultsNode}
                 */
                getTurboNodes: function () {
                    return this.getData()._nodesTurbo === undefined ? null : this.getData()._nodesTurbo;
                },

                /**
                 * Get all nodes from current search result.
                 * @returns {array} collection of {HybridsearchResultsNode}
                 */
                getNodes: function () {
                    return this.getData()._nodes === undefined ? null : this.getData()._nodes;
                },

                /**
                 * Get all nodes by given nodeType from current search result.
                 * @param {string} nodeType
                 * @returns {array} collection of {HybridsearchResultsNode}
                 */
                getNodesByNodeType: function (nodeType) {
                    return this.getData()._nodesByType[this.$$app.getNodeTypeLabel(nodeType)] === undefined ? null : this.getData()._nodesByType[this.$$app.getNodeTypeLabel(nodeType)];
                },

                /**
                 * Get all nodes by given nodeTypeLabel from current search result.
                 * @param {string} nodeTypeLabel
                 * @returns {array} collection of {HybridsearchResultsNode}
                 */
                getNodesByNodeTypeLabel: function (nodeTypeLabel) {
                    return this.getData()._nodesByType[nodeTypeLabel] === undefined ? null : this.getData()._nodesByType[nodeTypeLabel];
                },

                /**
                 * Get alle nodes from current search result a grouped object.
                 * @returns {HybridsearchResultsGroupObject}
                 */
                getGrouped: function () {

                    var self = this;

                    if (self.$$data.groups.count() > 0) {
                        return self.$$data.groups;
                    }

                    angular.forEach(this.getData()._nodesByType, function (result, key) {
                        self.$$data.groups.addItem(result.group, result);
                    });

                    return self.$$data.groups;
                },


            };


            return HybridsearchResultsObject;
        }
    ]);


})();

(function () {
    'use strict';
    /**
     * @private
     */
    angular.module('hybridsearch.filter').factory('$hybridsearchFilterObject', [

        function () {


            var filterReg = /[^0-9a-zA-ZöäüÖÄÜ]/g;

            /**
             * HybridsearchFilterObject.
             * @private
             * @returns {HybridsearchFilterObject}
             * @constructor
             */
            function HybridsearchFilterObject() {


                if (!(this instanceof HybridsearchFilterObject)) {
                    return new HybridsearchFilterObject();
                }


                this.$$data = {};

                Object.defineProperty(this, '$$data', {
                    value: this.$$data
                });


                return this;

            }


            HybridsearchFilterObject.prototype = {


                /**
                 * @returns string
                 */
                getHash: function () {

                    var hash = [];

                    hash.push(this.$$data.query);
                    hash.push(this.$$data.nodeType);

                    return Sha1.hash(JSON.stringify(hash));
                },

                /**
                 * @returns string
                 */
                hasFilters: function () {

                    if (this.getQuery() != '') {
                        return true;
                    }

                    if (this.getNodeType() != '') {
                        return true;
                    }

                    return false;

                },

                /**
                 * @param string nodeType to search only for
                 * @returns HybridsearchObject
                 */
                setNodeType: function (nodeType) {
                    this.$$data.nodeType = nodeType;
                    return this;
                },

                /**
                 * @param string nodePath to search only for
                 * @returns HybridsearchObject
                 */
                setNodePath: function (nodePath) {
                    this.$$data.nodePath = nodePath;
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
                 * @param string autocompletedKeywords to search
                 */
                setAutocompletedKeywords: function (autocompletedKeywords) {
                    this.$$data.autocompletedKeywords = autocompletedKeywords;
                    return this;
                },

                /**
                 * @param string autocompletedKeyword to search
                 */
                addAutocompletedKeywords: function (autocompletedKeyword) {
                    this.$$data.autocompletedKeywords = this.$$data.autocompletedKeywords + " " + autocompletedKeyword;
                    return this;
                },

                /**
                 * @param string property
                 * @param string value
                 * @returns HybridsearchObject
                 */
                addPropertyFilter: function (property, value) {
                    if (this.$$data.propertyFilter == undefined) {
                        this.$$data.propertyFilter = {};
                    }
                    this.$$data.propertyFilter[property] = value;
                    return this;
                },

                /**
                 * @param string value
                 * @returns HybridsearchObject
                 */
                setAgeFilter: function (value) {
                    if (this.$$data.ageFilter == undefined) {
                        this.$$data.ageFilter = {};
                    }
                    this.$$data.ageFilter = value;
                    return this;
                },

                /**
                 * @param string value
                 * @returns HybridsearchObject
                 */
                setGenderFilter: function (value) {
                    if (this.$$data.genderFilter == undefined) {
                        this.$$data.genderFilter = {};
                    }
                    this.$$data.genderFilter = value;
                    return this;
                },


                /**
                 * * @returns HybridsearchObject
                 */
                clearPropertyFilter: function () {
                    this.$$data.propertyFilter = {};
                    return this;
                },

                /**
                 * * @returns HybridsearchObject
                 */
                getPropertyFilters: function () {
                    return this.$$data.propertyFilter === undefined ? {} : this.$$data.propertyFilter;
                },

                /**
                 * * @returns HybridsearchObject
                 */
                getGenderFilter: function () {
                    return this.$$data.genderFilter === undefined ? '' : this.$$data.genderFilter;
                },

                /**
                 * * @returns HybridsearchObject
                 */
                getAgeFilter: function () {
                    return this.$$data.ageFilter === undefined ? '' : this.$$data.ageFilter;
                },

                /**
                 * @param string additionalKeyword to search
                 */
                addAdditionalKeywords: function (additionalKeyword) {
                    if (this.$$data.additionalKeywords == undefined) {
                        this.$$data.additionalKeywords = '';
                    }
                    this.$$data.additionalKeywords += " " + additionalKeyword;
                    return this;
                },

                /**
                 * @param string additionalKeywords to search
                 */
                setAdditionalKeywords: function (additionalKeywords) {
                    this.$$data.additionalKeywords = additionalKeywords;
                    return this;
                },

                /**
                 * @returns string
                 */
                getAdditionalKeywords: function () {

                    if (this.$$data.additionalKeywords === undefined) {
                        return '';
                    }

                    var terms = {};
                    var termsstring = '';

                    var s = this.$$data.additionalKeywords.replace(filterReg, " ");

                    angular.forEach(s.split(" "), function (term) {
                        term = term.replace(filterReg, "");
                        if (term !== undefined && term.length > 0) terms[term] = term;
                    });
                    angular.forEach(terms, function (a, t) {
                        termsstring = termsstring + " " + t;
                    });

                    return termsstring;


                },

                /**
                 * @returns string
                 */
                getAutocompletedKeywords: function () {
                    return this.$$data.autocompletedKeywords;

                },

                /**
                 * @param string property
                 * @returns mixed
                 */
                getGa: function (property=false) {
                    if (property === false) {
                        return this.$$data.ga;
                    } else {
                        if (this.$$data.ga === undefined || this.$$data.ga[property] === undefined) {
                            return null;
                        } else {
                            return this.$$data.ga[property];
                        }
                    }


                },

                /**
                 * sets ga data
                 * @returns mixed
                 */
                setGa: function (ga) {
                    this.$$data.ga = ga;
                },

                /**
                 * @returns string
                 */
                getFullSearchQuery: function () {
                    if (this.getAutocompletedKeywords() === undefined) {
                        return false;
                    }
                    if (this.getAdditionalKeywords() === undefined) {
                        return false;
                    }

                    var d = new Date();

                    var q = this.$$data.magickeywords + " " + this.getAutocompletedKeywords() + " " + this.getAdditionalKeywords() + " " + " trendingHour" + d.getHours() + " " + (this.getGa('userGender') ? this.getGa('userGender') : '') + " " + (this.getGa('userGender') ? this.getGa('userAgeBracket') : '');


                    return q.length > 1 ? q : false;

                },

                /**
                 * @returns string
                 */
                getNodeType: function () {
                    return this.$$data.nodeType === undefined ? false : this.$$data.nodeType;
                },

                /**
                 * @returns string
                 */
                getNodePath: function () {
                    return this.$$data.nodePath === undefined ? false : this.$$data.nodePath;
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
                    s = s.toLowerCase();

                    angular.forEach(s.split(" "), function (term) {
                        term = term.replace(filterReg, "");
                        if (term.length > 0) keywords[term] = true;
                    });


                    return this.getMagicQuery(keywords);

                },

                /**
                 * @param object keywords
                 * @returns object
                 */
                getMagicQuery: function (keywords) {

                    var magickeywords = [];
                    var self = this;

                    angular.forEach(keywords, function (k, term) {

                        magickeywords[term] = true;
                        angular.forEach(self.getMagicReplacements(term), function (a, t) {
                            magickeywords.push(t);
                        });


                    });

                    self.$$data.magickeywords = ' ';
                    angular.forEach(magickeywords, function (term) {
                        self.$$data.magickeywords += term + ' ';
                    });
                    self.$$data.magickeywords += ' ';


                    return magickeywords.sort();

                },

                /**
                 * @param string
                 * @returns object
                 */
                getMagicReplacements: function (string) {

                    var magicreplacements = {};

                    // keep original term
                    magicreplacements[string] = true;

                    // get shorter term
                    magicreplacements[string.substr(0, string.length - 1)] = true;

                    // double consonants
                    var d = string.replace(/([bcdfghjklmnpqrstvwxyz])\1+/, "$1");
                    magicreplacements[d] = true;
                    magicreplacements[d.replace(/(.*)([bcdfghjklmnpqrstvwxyz])([^bcdfghjklmnpqrstvwxyz]*)/, "$1$2$2$3").replace(/([bcdfghjklmnpqrstvwxyz])\3+/, "$1$1")] = true;
                    magicreplacements[d.replace(/(.*)([bcdfghjklmnpqrstvwxyz])([^bcdfghjklmnpqrstvwxyz]*)([bcdfghjklmnpqrstvwxyz])([^bcdfghjklmnpqrstvwxyz]*)/, "$1$2$2$3$4$4$5").replace(/([bcdfghjklmnpqrstvwxyz])\3+/, "$1$1")] = true;

                    // common typo errors
                    magicreplacements[d.replace(/th/, "t")] = true;
                    magicreplacements[d.replace(/t/, "th")] = true;
                    magicreplacements[d.replace(/(.*)ph(.*)/, "$1f$2")] = true;
                    magicreplacements[d.replace(/(.*)f(.*)/, "$1ph$2")] = true;
                    magicreplacements[d.replace(/(.*)tz(.*)/, "$1t$2")] = true;
                    magicreplacements[d.replace(/(.*)t(.*)/, "$1tz$2")] = true;
                    magicreplacements[d.replace(/(.*)rm(.*)/, "$1m$2")] = true;
                    magicreplacements[d.replace(/(.*)m(.*)/, "$1rm$2")] = true;
                    magicreplacements[d.replace(/(.*)th(.*)/, "$1t$2")] = true;
                    magicreplacements[d.replace(/(.*)t(.*)/, "$1th$2")] = true;
                    magicreplacements[d.replace(/(.*)a(.*)/, "$1ia$2")] = true;
                    magicreplacements[d.replace(/(.*)ai(.*)/, "$1a$2")] = true;
                    magicreplacements[d.replace(/(.*)rd(.*)/, "$1d$2")] = true;
                    magicreplacements[d.replace(/(.*)d(.*)/, "$1rd$2")] = true;
                    magicreplacements[d.replace(/(.*)t(.*)/, "$1d$2")] = true;
                    magicreplacements[d.replace(/(.*)d(.*)/, "$1t$2")] = true;
                    magicreplacements[d.replace(/(.*)k(.*)/, "$1x$2")] = true;
                    magicreplacements[d.replace(/(.*)x(.*)/, "$1k$2")] = true;
                    magicreplacements[d.replace(/(.*)k(.*)/, "$1c$2")] = true;
                    magicreplacements[d.replace(/(.*)c(.*)/, "$1k$2")] = true;
                    magicreplacements[d.replace(/(.*)ck(.*)/, "$1k$2")] = true;
                    magicreplacements[d.replace(/(.*)ck(.*)/, "$1ch$2")] = true;
                    magicreplacements[d.replace(/(.*)ch(.*)/, "$1ck$2")] = true;
                    magicreplacements[d.replace(/(.*)ie(.*)/, "$1i$2")] = true;
                    magicreplacements[d.replace(/(.*)i(.*)/, "$1ie$2")] = true;


                    return magicreplacements;

                }


            };


            return HybridsearchFilterObject;
        }
    ]);


})();


/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/*  SHA-1 implementation in JavaScript                  (c) Chris Veness 2002-2014 / MIT Licence  */
/*                                                                                                */
/*  - see http://csrc.nist.gov/groups/ST/toolkit/secure_hashing.html                              */
/*        http://csrc.nist.gov/groups/ST/toolkit/examples.html                                    */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

'use strict';


/**
 * SHA-1 hash function reference implementation.
 *
 * @namespace
 */
var Sha1 = {};


/**
 * Generates SHA-1 hash of string.
 *
 * @param   {string} msg - (Unicode) string to be hashed.
 * @returns {string} Hash of msg as hex character string.
 */
Sha1.hash = function (msg) {
    // convert string to UTF-8, as SHA only deals with byte-streams
    msg = msg.utf8Encode();

    // constants [§4.2.1]
    var K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];

    // PREPROCESSING

    msg += String.fromCharCode(0x80);  // add trailing '1' bit (+ 0's padding) to string [§5.1.1]

    // convert string msg into 512-bit/16-integer blocks arrays of ints [§5.2.1]
    var l = msg.length / 4 + 2; // length (in 32-bit integers) of msg + ‘1’ + appended length
    var N = Math.ceil(l / 16);  // number of 16-integer-blocks required to hold 'l' ints
    var M = new Array(N);

    for (var i = 0; i < N; i++) {
        M[i] = new Array(16);
        for (var j = 0; j < 16; j++) {  // encode 4 chars per integer, big-endian encoding
            M[i][j] = (msg.charCodeAt(i * 64 + j * 4) << 24) | (msg.charCodeAt(i * 64 + j * 4 + 1) << 16) |
                (msg.charCodeAt(i * 64 + j * 4 + 2) << 8) | (msg.charCodeAt(i * 64 + j * 4 + 3));
        } // note running off the end of msg is ok 'cos bitwise ops on NaN return 0
    }
    // add length (in bits) into final pair of 32-bit integers (big-endian) [§5.1.1]
    // note: most significant word would be (len-1)*8 >>> 32, but since JS converts
    // bitwise-op args to 32 bits, we need to simulate this by arithmetic operators
    M[N - 1][14] = ((msg.length - 1) * 8) / Math.pow(2, 32);
    M[N - 1][14] = Math.floor(M[N - 1][14]);
    M[N - 1][15] = ((msg.length - 1) * 8) & 0xffffffff;

    // set initial hash value [§5.3.1]
    var H0 = 0x67452301;
    var H1 = 0xefcdab89;
    var H2 = 0x98badcfe;
    var H3 = 0x10325476;
    var H4 = 0xc3d2e1f0;

    // HASH COMPUTATION [§6.1.2]

    var W = new Array(80);
    var a, b, c, d, e;
    for (var i = 0; i < N; i++) {

        // 1 - prepare message schedule 'W'
        for (var t = 0; t < 16; t++) W[t] = M[i][t];
        for (var t = 16; t < 80; t++) W[t] = Sha1.ROTL(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);

        // 2 - initialise five working variables a, b, c, d, e with previous hash value
        a = H0;
        b = H1;
        c = H2;
        d = H3;
        e = H4;

        // 3 - main loop
        for (var t = 0; t < 80; t++) {
            var s = Math.floor(t / 20); // seq for blocks of 'f' functions and 'K' constants
            var T = (Sha1.ROTL(a, 5) + Sha1.f(s, b, c, d) + e + K[s] + W[t]) & 0xffffffff;
            e = d;
            d = c;
            c = Sha1.ROTL(b, 30);
            b = a;
            a = T;
        }

        // 4 - compute the new intermediate hash value (note 'addition modulo 2^32')
        H0 = (H0 + a) & 0xffffffff;
        H1 = (H1 + b) & 0xffffffff;
        H2 = (H2 + c) & 0xffffffff;
        H3 = (H3 + d) & 0xffffffff;
        H4 = (H4 + e) & 0xffffffff;
    }

    return Sha1.toHexStr(H0) + Sha1.toHexStr(H1) + Sha1.toHexStr(H2) +
        Sha1.toHexStr(H3) + Sha1.toHexStr(H4);
};


/**
 * Function 'f' [§4.1.1].
 * @private
 */
Sha1.f = function (s, x, y, z) {
    switch (s) {
        case 0:
            return (x & y) ^ (~x & z);           // Ch()
        case 1:
            return x ^ y ^ z;                 // Parity()
        case 2:
            return (x & y) ^ (x & z) ^ (y & z);  // Maj()
        case 3:
            return x ^ y ^ z;                 // Parity()
    }
};

/**
 * Rotates left (circular left shift) value x by n positions [§3.2.5].
 * @private
 */
Sha1.ROTL = function (x, n) {
    return (x << n) | (x >>> (32 - n));
};


/**
 * Hexadecimal representation of a number.
 * @private
 */
Sha1.toHexStr = function (n) {
    // note can't use toString(16) as it is implementation-dependant,
    // and in IE returns signed numbers when used on full words
    var s = '', v;
    for (var i = 7; i >= 0; i--) {
        v = (n >>> (i * 4)) & 0xf;
        s += v.toString(16);
    }
    return s;
};


/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */


/** Extend String object with method to encode multi-byte string to utf8
 *  - monsur.hossa.in/2012/07/20/utf-8-in-javascript.html */
if (typeof String.prototype.utf8Encode == 'undefined') {
    String.prototype.utf8Encode = function () {
        return unescape(encodeURIComponent(this));
    };
}

/** Extend String object with method to decode utf8 string to multi-byte */
if (typeof String.prototype.utf8Decode == 'undefined') {
    String.prototype.utf8Decode = function () {
        try {
            return decodeURIComponent(escape(this));
        } catch (e) {
            return this; // invalid UTF-8? return as-is
        }
    };
}


/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
if (typeof module != 'undefined' && module.exports) module.exports = Sha1; // CommonJs export