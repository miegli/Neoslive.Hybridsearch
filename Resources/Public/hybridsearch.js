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
                try {
                    firebase.initializeApp(firebaseconfig);
                } catch (e) {

                }


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


                var results, filter, watchers, references, index, lunrSearch, nodes, nodeTypeLabels, lastFilterHash, propertiesBoost;


                results = new $hybridsearchResultsObject();
                filter = new $hybridsearchFilterObject();
                lastFilterHash = '';
                nodeTypeLabels = {};
                nodes = {};
                index = {};
                watchers = {};
                references = {};
                watchers.index = {};
                watchers.keywords = {};
                lunrSearch = elasticlunr(function () {
                    this.setRef('id');
                });


                if (!(this instanceof HybridsearchObject)) {
                    return new HybridsearchObject();
                }


                this.$$app = {


                    getNodeTypeLabels: function () {
                        return nodeTypeLabels;
                    },
                    getPropertiesBoost: function () {
                        return propertiesBoost;
                    },
                    getBoost: function (property) {
                        return propertiesBoost[property] ? propertiesBoost[property] : 10;
                    },
                    setNodeTypeLabels: function (labels) {
                        nodeTypeLabels = labels;
                    },
                    setPropertiesBoost: function (boost) {
                        propertiesBoost = boost;
                    },

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

                        var fields = {}, items = {}, self = this, finalitems = [], turbonodes = {};


                        finalitems['all'] = [];
                        finalitems['nodetypes'] = {};
                        finalitems['turbonodes'] = [];


                        angular.forEach(lunrSearch.getFields(), function (v, k) {
                            fields[v] = {boost: self.getBoost(v)}
                        });


                        angular.forEach(lunrSearch.search(self.getFilter().getFullSearchQuery(), {
                            fields: fields,
                            bool: "OR"
                        }), function (item) {


                            var nodeId = item.ref.substring(item.ref.indexOf("://") + 3);

                            if (nodes[nodeId] !== undefined && nodes[nodeId]['turbonode'] !== true) {

                                var nodeTypeLabel = nodeTypeLabels[nodes[nodeId].nodeType] !== undefined ? nodeTypeLabels[nodes[nodeId].nodeType] : nodes[nodeId].nodeType;

                                var hash = nodes[nodeId].hash;

                                if (items[nodeTypeLabel] === undefined) {
                                    items[nodeTypeLabel] = {};
                                }


                                if (items[nodeTypeLabel][hash] === undefined) {
                                    items[nodeTypeLabel][hash] = {
                                        score: nodes[nodeId]['turbonode'] ? 1000 : item.score,
                                        nodeType: nodes[nodeId].nodeType,
                                        nodes: {},
                                        node: nodes[nodeId]
                                    };
                                }
                                items[nodeTypeLabel][hash].nodes[nodeId] = nodes[nodeId];


                            }

                            if (nodes[nodeId] !== undefined && nodes[nodeId]['turbonode'] && turbonodes[nodes[nodeId].hash] === undefined) {
                                finalitems['turbonodes'].push({
                                    score: item.score,
                                    nodeType: nodes[nodeId].nodeType,
                                    nodes: {},
                                    node: nodes[nodeId]
                                });
                                turbonodes[nodes[nodeId].hash] = 1;
                            }


                        });


                        // make propre array


                        angular.forEach(items, function (val, key) {

                            finalitems['nodetypes'][key] = [];

                            angular.forEach(val, function (v, k) {
                                finalitems['nodetypes'][key].push(v);
                                finalitems['all'].push(v);
                            });

                        });


                        results.setResults(finalitems);

                    },

                    /**
                     * @returns boolean
                     */
                    isFiltered: function (node) {

                        if (node.properties.rawcontent.length < 2) {
                            return true;
                        }

                        if (this.getFilter().getNodePath().length > 0 && node.uri.path.substr(0, this.getFilter().getNodePath().length) != this.getFilter().getNodePath()) {
                            return true;
                        }


                        return false;
                    },

                    /**
                     * @returns mixed
                     */
                    setSearchIndex: function () {


                        if (lastFilterHash != filter.getHash()) {


                            var self = this, counter = 0;
                            nodes = {};
                            results.setResults([]);
                            filter.setAutocompletedKeywords('');

                            // unbind all previous defined keywords watchers
                            angular.forEach(watchers.keywords, function (unbind, key) {
                                unbind();
                                delete watchers.keywords[key];
                                if (references.keywords !== undefined && references.keywords[key] !== undefined) {
                                    delete references.keywords[key];
                                }
                            });
                            // unbind all previous defined index watchers
                            angular.forEach(watchers.index, function (unbind, key) {
                                unbind();
                                delete watchers.index[key];
                            });


                            angular.forEach(this.getFilter().getQueryKeywords(), function (value, keyword) {

                                if (keyword.length > 2 || (keyword.length === 2 && isNaN(keyword) === false)) {

                                    counter++;
                                    watchers.keywords[keyword] = self.getKeywords(keyword).$watch(function (d, a) {

                                        references[keyword].on("value", function (data) {

                                            angular.forEach(data.val(), function (val, keywordsegment) {

                                                if (references.keywords !== undefined && references.keywords[keywordsegment] !== undefined) {
                                                    delete references.keywords[keywordsegment];
                                                }
                                                // keyword was found
                                                if (
                                                    (keyword.length < 8 &&
                                                        keywordsegment.substr(0, keyword.length) === keyword.substr(0, keyword.length)
                                                    )
                                                    ||
                                                    (keyword.length >= 8 &&
                                                        keywordsegment.substr(0, keyword.length - 4) === keyword.substr(0, keyword.length - 4)
                                                    )

                                                ) {
                                                    filter.addAutocompletedKeywords(keywordsegment);
                                                    watchers.index[keywordsegment] = self.getIndex(keywordsegment).$watch(function (obj, o) {

                                                        references[keywordsegment].on("value", function (data) {
                                                            self.updateLocalIndex(keywordsegment, data.val());
                                                        });


                                                    });
                                                }


                                            });


                                        });


                                    });

                                }

                            });


                            if (counter == 0) {
                                // get all nodes by types without keyword
                                // don't process nodes over lunr search in this case
                                if (self.getFilter().getNodeType()) {
                                    watchers.index["_"] = self.getIndex().$watch(function (obj) {
                                        self.getIndex().$loaded(function (data) {

                                            var finalitems = [];
                                            var items = {};
                                            angular.forEach(data, function (val, key) {
                                                var hash = val['_node']['hash'];
                                                if (items[val['_nodetype']] === undefined) {
                                                    items[val['_nodetype']] = {};
                                                }
                                                if (items[hash] === undefined) {
                                                    items[val['_nodetype']][hash] = {
                                                        score: val['_node']['turbonode'] ? 999999999999999 : 0,
                                                        nodeType: val['_nodetype'],
                                                        nodes: {},
                                                        node: val['_node']
                                                    };
                                                }
                                                items[val['_nodetype']][hash].nodes[val['_node']['identifier']] = val['_node'];


                                            });
                                            angular.forEach(items, function (val, key) {
                                                finalitems.push(val);
                                            });
                                            results.setResults(finalitems);
                                        });
                                    });

                                }
                            }


                            this.cleanLocalIndex(watchers.keywords);
                            lastFilterHash = filter.getHash();
                        }


                    },
                    /**
                     * @param string querysegment
                     * @returns {firebaseObject}
                     */
                    getKeyword: function (querysegment) {

                        var ref = hybridsearch.$firebase().database().ref().child("keywords/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.dimension + "/" + querysegment);
                        return firebaseObject(ref);
                    },
                    /**
                     * @param string querysegment
                     * @returns {firebaseObject}
                     */
                    getKeywords: function (querysegment) {


                        if (querysegment.length >= 8) {
                            var substr = querysegment.substring(0, querysegment.length - 3);
                        } else {
                            var substr = querysegment;
                        }


                        var ref = hybridsearch.$firebase().database().ref().child("keywords/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.dimension + "/").orderByKey().startAt(substr.toLowerCase()).limitToFirst(10);

                        var fbobject = firebaseObject(ref);
                        references[querysegment] = fbobject.$ref();
                        return fbobject;


                    },
                    /**
                     * @param string keyword
                     * @returns {firebaseObject}
                     */
                    getIndex: function (keyword) {

                        var fbobject = {};

                        if (keyword === undefined) {
                            keyword = "";
                        }

                        var ref = hybridsearch.$firebase().database().ref().child("index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.dimension);
                        var query = false;

                        if (query === false && this.getFilter().getNodeType()) {
                            if (keyword === "") {
                                query = ref.orderByChild("_nodetype").equalTo(this.getFilter().getNodeType());
                            } else {
                                query = ref.orderByChild("_nodetype" + keyword).equalTo(this.getFilter().getNodeType()).limitToFirst(250);
                            }

                        }


                        if (query === false) {
                            query = ref.orderByChild(keyword).equalTo(1).limitToFirst(100);
                        }


                        if (query) {
                            fbobject = firebaseObject(query);
                            references[keyword] = fbobject.$ref();
                            return fbobject;
                        }

                        return null;

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

                        var self = this;

                        if (index[keyword] === undefined) {
                            index[keyword] = {};
                        }


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

                                    doc.id = keyword + "://" + value._node.identifier;
                                    lunrSearch.addDoc(doc);
                                    index[keyword][doc.id] = keyword;

                                }

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
                 * @param string nodePath to search only for
                 * @param boolean scopevar false if is simple string  otherwise scope required for binding data
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
                 * @param string input to search
                 * @param mixed scope null if is simple string otherwise scope required for binding data
                 * @returns {HybridsearchObject}
                 */
                setQuery: function (input, scope=null) {

                    var self = this, lastinterval = 0;

                    if (scope) {


                        scope.$watch(input, function (searchInput) {

                            if (lastinterval) {
                                clearTimeout(lastinterval);
                            }

                            lastinterval = setTimeout(function () {
                                self.$$app.getFilter().setQuery(scope[input]);
                                if (searchInput !== undefined) {
                                    self.$$app.setSearchIndex();
                                }
                            }, 500);


                        });

                    } else {
                        self.$$app.getFilter().setQuery(input);
                        self.$$app.setSearchIndex();
                    }

                    return this;

                },

                /**
                 * @param nodetypelabels
                 * @returns {$hybridsearchResultsObject|*}
                 */
                setNodeTypeLabels: function (nodetypelabels) {
                    var self = this;
                    self.$$app.setNodeTypeLabels(nodetypelabels);
                    return this;
                },

                /**
                 * @param propertiesboost
                 * @returns {$hybridsearchResultsObject|*}
                 */
                setPropertiesBoost: function (propertiesboost) {
                    var self = this;
                    self.$$app.setPropertiesBoost(propertiesboost);
                    return this;
                },

                /**
                 * @param string input as an additional query to search
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

                    this.$$data.results = this.getResultsPostFiltered(results);
                    this.executeCallbackMethod();


                },

                /**
                 *
                 * post processor filter out results with score lower than half of other similar nodes
                 *
                 * @param object
                 * @returns void
                 */
                getResultsPostFiltered: function (results) {


                    var scoreCounter = {};
                    var filterNodesByScore = {};


                    angular.forEach(results.nodetypes, function (result, key) {


                        var maxnodesbyscore = result.length / 3 * 2;

                        if (maxnodesbyscore > 1) {
                            angular.forEach(result, function (item) {
                                if (scoreCounter[item.nodeType] === undefined) {
                                    scoreCounter[item.nodeType] = {};
                                }
                                scoreCounter[item.nodeType][item.score] = (scoreCounter[item.nodeType][item.score] == undefined ? 0 : scoreCounter[item.nodeType][item.score]) + 1;
                                if (scoreCounter[item.nodeType][item.score] >= maxnodesbyscore) {
                                    filterNodesByScore[item.nodeType] = item.score;
                                }
                            });
                        }


                    });


                    // filter nodes outside score range
                    angular.forEach(filterNodesByScore, function (score, nodeType) {


                        angular.forEach(results.all, function (item, key) {
                            if (item.score < 100 && nodeType === item.nodeType && item.score !== score) {
                                results.all.splice(key, 1);
                            }

                        });

                        angular.forEach(results.nodetypes, function (result, key) {
                            angular.forEach(result, function (item, k) {

                                if (item.score < 100 && filterNodesByScore[item.nodeType] !== undefined && item.score !== filterNodesByScore[item.nodeType]) {
                                    results.nodetypes[key].splice(k, 1);
                                }
                            });
                        });


                    });


                    return results;


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
                 * @returns string
                 */
                getHash: function () {

                    return JSON.stringify(this.$$data);

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
                getAutocompletedKeywords: function () {
                    return this.$$data.autocompletedKeywords;

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
                getFullSearchQuery: function () {
                    console.log(this.getAutocompletedKeywords() + " " + this.getAdditionalKeywords());
                    return this.getAutocompletedKeywords() + " " + this.getAdditionalKeywords()
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

                    return keywords;

                }


            };


            return HybridsearchFilterObject;
        }
    ]);


})();