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


                var results, filter, watchers, references, index, lunrSearch, nodes, nodeTypeLabels, lastFilterHash, propertiesBoost, isRunning;

                isRunning = false;
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


                var HybridsearchResultsNode = function (nodeData, score) {

                    var self = this;

                    angular.forEach(nodeData, function (val, key) {
                        self[key] = val;
                    });
                    self.score = score;

                };

                HybridsearchResultsNode.prototype = {

                    /**
                     * @returns string
                     */
                    getNodeType: function () {
                        return this.nodeType !== undefined ? this.nodeType : '';
                    },

                    /**
                     * @returns object
                     */
                    getProperties: function () {
                        return this.properties;
                    },

                    /**
                     * @returns float
                     */
                    getScore: function () {
                        return this.score !== undefined ? this.score : 0;
                    },

                    /**
                     * @returns float
                     */
                    addScore: function (score) {
                        this.score = this.score + score;
                    },

                    /**
                     * @returns boolean
                     */
                    isTurboNode: function () {
                        return this.turbonode === undefined ? false : this.turbonode;
                    },

                    /**
                     * @returns string
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
                     * @returns string
                     */
                    getUrl: function () {
                        return this.url === undefined ? '' : this.url;
                    },

                    /**
                     * @returns string
                     */
                    getBreadcrumb: function () {
                        return this.breadcrumb === undefined ? '' : this.breadcrumb;
                    },

                    /**
                     * @returns string
                     */
                    getPreview: function () {
                        return this.properties.rawcontent === undefined ? '' : this.properties.rawcontent;
                    },

                    /**
                     * @returns {{HybridsearchResultsNode}}
                     */
                    getParent: function () {
                        return this.parentNode ? new HybridsearchResultsNode(this.parentNode) : false;
                    },

                    /**
                     * @returns {{HybridsearchResultsNode}}
                     */
                    getDocumentNode: function () {
                        return this.grandParentNode ? new HybridsearchResultsNode(this.grandParentNode) : false;
                    }

                };


                this.$$app = {

                    setIsRunning: function () {
                        isRunning = true;
                    },
                    isRunning: function () {
                        return isRunning;
                    },
                    getNodeTypeLabels: function () {
                        return nodeTypeLabels;
                    },
                    getNodeTypeLabel: function (nodeType) {
                        return nodeTypeLabels[nodeType] !== undefined ? nodeTypeLabels[nodeType] : nodeType;
                    },
                    getPropertiesBoost: function () {
                        return propertiesBoost;
                    },
                    getBoost: function (property) {
                        return propertiesBoost[property] ? propertiesBoost[property] : 10;
                    },
                    setNodeTypeLabels: function (labels) {
                        results.$$app.setNodeTypeLabels(labels);
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


                        var fields = {}, items = {}, self = this, nodesFound = {};


                        items['_nodes'] = {};
                        items['_nodesTurbo'] = {};
                        items['_nodesByType'] = {};


                        if (!self.getFilter().getFullSearchQuery()) {
                            // return all nodes bco no query set
                            angular.forEach(nodes, function (node) {
                                self.addNodeToSearchResult(node.identifier, 1, nodesFound, items);
                            });


                        } else {


                            // execute query search

                            angular.forEach(lunrSearch.getFields(), function (v, k) {
                                fields[v] = {boost: self.getBoost(v)}
                            });


                            angular.forEach(lunrSearch.search(self.getFilter().getFullSearchQuery(), {
                                    fields: fields,
                                    bool: "OR"
                                }), function (item) {


                                    var nodeId = item.ref.substring(item.ref.indexOf("://") + 3), nodeTypeLabel;


                                    if (nodes[nodeId] !== undefined) {
                                        if (nodes[nodeId] !== undefined) {
                                            self.addNodeToSearchResult(nodeId, item.score, nodesFound, items);
                                        }
                                    }

                                }
                            );

                        }


                        results.getApp().setResults(items);


                    },


                    /**
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


                            if (items['_nodesByType'][nodeTypeLabel] === undefined) {
                                items['_nodesByType'][nodeTypeLabel] = {};
                            }


                            items['_nodesByType'][nodeTypeLabel][hash] = new HybridsearchResultsNode(nodes[nodeId], score);
                        }

                        nodesFound[hash] = true;
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


                        var self = this, counter = 0, lastinterval = false, updates = {};
                        nodes = {};


                        if (this.isRunning() && filter.hasFilters()) {


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

                            results.$$app.clearResults();
                            filter.setAutocompletedKeywords('');


                            angular.forEach(this.getFilter().getQueryKeywords(), function (value, keyword) {

                                    if (keyword.length > 2 || (keyword.length === 2 && isNaN(keyword) === false)) {

                                        counter++;
                                        watchers.keywords[keyword] = self.getKeywords(keyword).$watch(function () {

                                                references[keyword].on("value", function (data) {

                                                    var isMatchExact = false;

                                                    angular.forEach(data.val(), function (val, keywordsegment) {


                                                        if (!isMatchExact) {


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

                                                                watchers.index[keywordsegment] = self.getIndex(keywordsegment).$watch(function () {


                                                                    references[keywordsegment].on("value", function (data) {

                                                                        updates[keywordsegment] = data.val();

                                                                        if (lastinterval) {
                                                                            clearTimeout(lastinterval);
                                                                        }

                                                                        lastinterval = setTimeout(function () {
                                                                            self.updateLocalIndex(updates);
                                                                            updates = {};
                                                                        }, 100);

                                                                    });


                                                                });
                                                            }


                                                        }


                                                        if (keywordsegment == keyword) {
                                                            isMatchExact = true;
                                                        }


                                                    });


                                                });


                                            }
                                        );

                                    }

                                }
                            );


                            if (counter == 0) {
                                // get all nodes by types without keyword
                                // don't process nodes over lunr search in this case
                                if (self.getFilter().getNodeType()) {
                                    watchers.index[self.getFilter().getNodeType()] = self.getIndex().$watch(function (data) {

                                        references[self.getFilter().getNodeType()].on("value", function (data) {
                                            updates[self.getFilter().getNodeType()] = data.val();
                                            if (lastinterval) {
                                                clearTimeout(lastinterval);
                                            }
                                            lastinterval = setTimeout(function () {
                                                self.updateLocalIndex(updates);
                                                updates = {};
                                            }, 10);

                                        });


                                    });
                                }
                            }


                            this.cleanLocalIndex(watchers.keywords);

                        }


                    },
                    /**
                     * @param string querysegment
                     * @returns {firebaseObject}
                     */
                    getKeyword: function (querysegment) {

                        var ref = hybridsearch.$firebase().database().ref().child("keywords/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.dimension + "/" + querysegment);
                        return firebaseObject(ref);
                    }
                    ,
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


                    }
                    ,
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
                                keyword = this.getFilter().getNodeType();
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

                    }
                    ,
                    /**
                     * @param array
                     * @returns void
                     */
                    cleanLocalIndex: function (existingkeywords) {

                        lunrSearch = elasticlunr(function () {
                            this.setRef('id');
                        });

                    }
                    ,
                    /**
                     * @param object data
                     * @returns void
                     */
                    updateLocalIndex: function (data) {

                        var self = this;
                        nodes = {};

                        if (self.getFilter().getFullSearchQuery()) {
                            // add to lunr search index
                            angular.forEach(data, function (val, keyword) {
                                self.removeLocalIndex(keyword);
                                self.addLocalIndex(keyword, val);
                            });
                        } else {

                            // add to local index
                            angular.forEach(data, function (value) {
                                angular.forEach(value, function (d) {
                                    nodes[d['_node']['identifier']] = d['_node'];
                                });
                            });

                        }

                        self.search();


                    }
                    ,
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


                    }
                    ,
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

                }
                ;


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
                 * @returns  {HybridsearchObject}
                 */
                $watch: function (callback) {

                    this.$$app.getResults().getApp().setCallbackMethod(callback);
                    this.run();
                    return this;
                },

                /**
                 * run search and perform queries
                 *
                 * @returns  {HybridsearchObject}
                 */
                run: function () {
                    this.$$app.setIsRunning();
                    this.$$app.setSearchIndex();

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
                            }, 100);


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
    ])
    ;


})
();


(function () {
    'use strict';
    /**
     *
     */
    angular.module('hybridsearch.results').factory('$hybridsearchResultsObject', [

        function () {

            var HybridsearchResultsDataObject = function () {

            };

            HybridsearchResultsDataObject.prototype = {

                /**
                 * @returns integer
                 */
                count: function () {
                    return !this._nodes ? 0 : Object.keys(this._nodes).length;
                },

                /**
                 * @returns string
                 */
                getLabel: function () {
                    return this.label !== undefined ? this.label : '';
                },

                /**
                 * @returns object
                 */
                getNodes: function () {
                    return this._nodes !== undefined ? this._nodes : [];
                }

            };

            var HybridsearchResultsGroupObject = function () {

                this.items = [];


            };

            HybridsearchResultsGroupObject.prototype = {

                /**
                 * @returns integer
                 */
                count: function () {
                    return !this.items ? 0 : Object.keys(this.items).length;
                },

                /**
                 * @returns object
                 */
                getItems: function () {
                    return !this.items ? {} : this.items;
                },

                /**
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

                    this.items.push(item)
                    return this;
                }

            };

            /**
             * HybridsearchResultsObject.
             * @returns {HybridsearchResultsObject}
             * @constructor
             */
            function HybridsearchResultsObject() {

                var nodeTypeLabels = {};


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

                    },

                    clearResults: function () {
                        self.$$data.results = new HybridsearchResultsDataObject();
                        self.$$data.groups = new HybridsearchResultsGroupObject();
                    },

                    getResultsData: function () {
                        return self.$$data.results;
                    },


                    callbackMethod: function () {
                        return null;
                    },

                    /**
                     * @returns {HybridsearchResultsObject}
                     */
                    setCallbackMethod: function (callback) {
                        this.callbackMethod = callback;
                        return this;

                    },

                    /**
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
                 * @returns $$app
                 */
                getApp: function () {
                    return this.$$app;
                },

                /**
                 * @returns {{DataObject}}
                 */
                getData: function () {
                    return this.$$app.getResultsData();
                },


                count: function () {
                    return !this.getNodes() ? 0 : Object.keys(this.$$app.getResultsData()._nodes).length;
                },

                countByNodeType: function (nodeType) {
                    return !this.getNodesByNodeType(nodeType) ? 0 : Object.keys(this.getNodesByNodeType(nodeType)).length;
                },

                countByNodeTypeLabel: function (nodeTypeLabel) {
                    return !this.getNodesByNodeTypeLabel(nodeTypeLabel) ? 0 : Object.keys(this.getNodesByNodeTypeLabel(nodeTypeLabel)).length;
                },

                /**
                 * @returns object
                 */
                getTurboNodes: function () {
                    return this.getData()._nodesTurbo === undefined ? null : this.getData()._nodesTurbo;
                },

                /**
                 * @returns object
                 */
                getNodes: function () {
                    return this.getData()._nodes === undefined ? null : this.getData()._nodes;
                },

                /**
                 * @returns object
                 */
                getNodesByNodeType: function (nodeType) {
                    return this.getData()._nodesByType[this.$$app.getNodeTypeLabel(nodeType)] === undefined ? null : this.getData()._nodesByType[this.$$app.getNodeTypeLabel(nodeType)];
                },

                /**
                 * @returns object
                 */
                getNodesByNodeTypeLabel: function (nodeTypeLabel) {
                    return this.getData()._nodesByType[nodeTypeLabel] === undefined ? null : this.getData()._nodesByType[nodeTypeLabel];
                },

                /**
                 * @returns array
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

                    return JSON.stringify(this.$$data);

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
                    var q = this.getAutocompletedKeywords() + " " + this.getAdditionalKeywords();
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

                    return keywords;

                }


            };


            return HybridsearchFilterObject;
        }
    ]);


})();