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
             * @param site {string} site identifier (uuid)
             * @param cdnHost {string} (optional) cdn host for static data
             * @param debug {boolean}
             * @example
             * var hybridSearch = new $hybridsearchObject(
             *  'https://<DATABASE_NAME>.firebaseio.com',
             *  'live',
             *  'fb11fdde869d0a8fcfe00a2fd35c031d',
             *  'site-root-node-name'
             * ));
             * @returns {Hybridsearch} used for HybridsearchObject constructor.
             */
            function Hybridsearch(databaseURL, workspace, dimension, site, cdnHost, debug) {


                if (!(this instanceof Hybridsearch)) {
                    return new Hybridsearch();
                }


                this.$$conf = {
                    firebase: firebaseconfig,
                    workspace: workspace,
                    dimension: dimension,
                    site: site,
                    branch: '',
                    databaseURL: databaseURL,
                    cdnHost: cdnHost,
                    branchInitialized: false
                };


                Object.defineProperty(this, '$$conf', {
                    value: this.$$conf
                });


                // Initialize the Firebase SDK
                var firebaseconfig = {
                    databaseURL: databaseURL
                };
                try {
                    firebase.initializeApp(firebaseconfig);
                    if (debug !== undefined) {
                        firebase.database.enableLogging(true);
                    }
                } catch (e) {
                    // firebase was initizalized before
                }


            }

            Hybridsearch.prototype = {

                /**
                 * @private
                 * @returns Firebase App
                 */
                $firebase: function () {
                    return firebase;
                },

                /**
                 * @private
                 * @returns Firebase App
                 */
                setBranch: function (branch) {
                    this.$$conf.branch = branch;
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
    angular.module('hybridsearch.common').factory('$hybridsearchObject', ['$firebaseObject', '$hybridsearchResultsObject', '$hybridsearchFilterObject', '$http', '$q', '$location', '$filter',

        /**
         * @private
         * @param firebaseObject
         * @param $hybridsearchResultsObject
         * @param $hybridsearchFilterObject
         * @returns {HybridsearchObject}
         */
            function (firebaseObject, $hybridsearchResultsObject, $hybridsearchFilterObject, $http, $q, $location, $filter) {

            /**
             * @example
             * var hybridSearch = new $Hybridsearch(
             *  'https://<DATABASE_NAME>.firebaseio.com',
             *  'live',
             *  'fb11fdde869d0a8fcfe00a2fd35c031d',
             *  'site-root-node-name'
             * ));
             * var mySearch = new $HybridsearchObject(hybridSearch);
             *      mySearch.setQuery("Foo").addPropertyFilter('title', 'Foo').setNodeType('bar').$watch(function (data) {
             *        console.log(data);
             *      });
             * @param {Hybridsearch} Hybridsearch see Hybridsearch constructor
             * @constructor HybridsearchObject
             */
            var HybridsearchObject = function (hybridsearch) {

                    var hybridsearchInstanceNumber, pendingRequests, results, filter, index, lunrSearch, nodes, nodesLastHash, nodeTypeLabels, resultGroupedBy, resultCategorizedBy, resultOrderBy, propertiesBoost, ParentNodeTypeBoostFactor, isRunning, firstfilterhash, searchInstancesInterval, lastSearchInstance, lastIndexHash, indexInterval, isNodesByIdentifier, nodesByIdentifier, searchCounter, searchCounterTimeout, nodeTypeProperties;

                    // count instances
                    if (window.hybridsearchInstances === undefined) {
                        window.hybridsearchInstances = 1;
                    } else {
                        window.hybridsearchInstances++;
                    }


                    searchCounter = 0;
                    nodesLastHash = 0;
                    searchCounterTimeout = false;
                    isRunning = false;
                    firstfilterhash = false;
                    searchInstancesInterval = false;
                    lastSearchInstance = false;
                    results = new $hybridsearchResultsObject();
                    filter = new $hybridsearchFilterObject();
                    nodesByIdentifier = {};
                    nodeTypeLabels = {};
                    nodeTypeProperties = {};
                    nodes = {};
                    index = {};
                    pendingRequests = [];
                    resultGroupedBy = {};
                    resultOrderBy = {};
                    resultCategorizedBy = 'nodeType';
                    lunrSearch = elasticlunr(function () {
                        this.setRef('id');
                    });


                    /**
                     * init ga data
                     */
                    if (filter.getGa() === undefined) {

                        // hybridsearch.$firebase().database().ref().child("ga").orderByChild("url").equalTo(location.href).limitToFirst(1).once('value', function (data) {
                        //     angular.forEach(data.val(), function (val) {
                        //         filter.setGa(val);
                        //     });
                        // });

                    }


                    /**
                     *  extends string prototype
                     *  finds uri in string
                     */
                    String.prototype.HybridsearchResultsValue = function () {
                        return new HybridsearchResultsValue(this);
                    };


                    /**
                     * @private
                     * global function get property from object
                     */
                    window.HybridsearchGetPropertyFromObject = function (object, property) {


                        if (property === '*') {

                            var values = [];

                            angular.forEach(object, function (val, key) {
                                angular.forEach(val, function (v) {
                                    values.push(v);
                                });
                            });

                            return values;
                        }

                        var values = [];


                        angular.forEach(object, function (val, key) {


                            if (typeof key != 'string' || values.length === 0 && key.substr(key.length - property.length, property.length) === property) {


                                if (typeof val === 'string') {
                                    try {
                                        var valuesObject = JSON.parse(val);

                                        if (valuesObject) {
                                            values = valuesObject;
                                            return values;
                                        }
                                    } catch (e) {
                                        values = [val];
                                    }

                                    if (property == key) {
                                        values = object[property];
                                        return values;
                                    } else {
                                        values = object[key];
                                        return values;
                                    }

                                }

                            }


                            if (values.length === 0 && typeof val === 'object') {

                                values = [];
                                angular.forEach(val, function (v, k) {

                                    if (values.length == 0 && typeof k == 'string' && (k.substr(k.length - property.length, property.length) === property || k == property)) {
                                        values.push(val[k]);
                                        return values;
                                    }

                                });


                            }


                        });


                        return values;


                    };

                    /**
                     * @private
                     *  global function get property from node
                     */
                    window.HybridsearchGetPropertyFromNode = function (node, property) {

                        var value = '';

                        if (node.properties[property] !== undefined) {
                            return node.properties[property];
                        }

                        // handles value as json parsable object if required
                        if (property.indexOf(".") >= 0) {

                            var propertysegments = property.split(".");

                            var value = node.properties;


                            angular.forEach(propertysegments, function (segment) {


                                if (value !== undefined) {
                                    if (value[segment] !== undefined) {
                                        value = value[segment];
                                    } else {

                                        if (value.length === undefined) {

                                            value = window.HybridsearchGetPropertyFromObject(value, segment);
                                        } else {


                                            var newvalue = [];
                                            angular.forEach(value, function (v) {

                                                var n = window.HybridsearchGetPropertyFromObject({0: v}, segment);
                                                newvalue.push(n[0]);
                                            });
                                            value = newvalue;

                                        }
                                    }
                                }


                            });


                        } else {
                            angular.forEach(node.properties, function (val, key) {
                                if (value === '' && key.substr(key.length - property.length, property.length) === property) {
                                    value = val !== undefined ? val : '';
                                    if (typeof value === 'string' && ((value.substr(0, 2) === '["' && value.substr(-2, 2) === '"]') || (value.substr(0, 2) === '[{' && value.substr(-2, 2) === '}]') )) {
                                        try {
                                            var valueJson = JSON.parse(value);
                                        } catch (e) {
                                            valueJson = value;
                                        }
                                        value = valueJson;
                                    }

                                }
                            });
                        }


                        return value;

                    };


                    /**
                     *
                     * @param value {mixed} a value
                     * @constructor
                     */
                    var HybridsearchResultsValue = function (value) {

                        var self = this;

                        self.value = value;

                    };

                    HybridsearchResultsValue.prototype = {
                        findUri: function () {

                            var urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
                            var urls = this.value.match(urlRegex)
                            return urls && urls.length == 1 ? urls[0] : urls;
                        },

                        findLastUriInBreadcrumb: function () {

                            var urlRegex = /(href="|href=')[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]("|')/ig;
                            var urls = this.value.match(urlRegex)
                            return urls[urls.length - 1].replace("href=", "").replace(/"/g, '').replace(/'/g, '');
                        },


                        toString: function () {
                            return this.value;
                        }

                    };


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
                        self.groupedNodes = [];
                        self.grouped = false;

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
                         * NodeType.
                         * @returns {string} node identifier
                         */
                        getIdentifier: function () {
                            return this.identifier !== undefined ? this.identifier : '';
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
                         * @private
                         * @param {HybridsearchResultsNode} node
                         * @returns {object}
                         */
                        addGroupedNode: function (node) {
                            this.groupedNodes.push(node);
                        },

                        /**
                         * @public
                         * @returns {boolean}
                         */
                        isGrouped: function () {
                            return this.grouped;
                        },

                        /**
                         * @private
                         * @returns {void}
                         */
                        setGrouped: function () {
                            this.grouped = true;
                        },

                        /**
                         * @public
                         * @param {boolean} uniqueByDocumentNode
                         * @returns {array}
                         */
                        getGroupedNodes: function (uniqueByDocumentNode) {
                            if (uniqueByDocumentNode === false) {
                                return this.groupedNodes;
                            } else {
                                return this.getGroupedByUniqueDocumentNode();
                            }
                        },

                        /**
                         * @private
                         * @param {boolean} uniqueByDocumentNode
                         * @returns {array}
                         */
                        countGroupedNodes: function (uniqueByDocumentNode) {
                            if (uniqueByDocumentNode === false) {
                                return this.groupedNodes.length;
                            } else {
                                return this.getGroupedByUniqueDocumentNode().length;
                            }


                        },

                        /**
                         * @private
                         * @returns {array}
                         */
                        getGroupedByUniqueDocumentNode: function () {
                            var b = [];
                            var bhash = {};

                            angular.forEach(this.groupedNodes, function (node) {
                                var h = node.getDocumentNode().getIdentifier();
                                if (bhash[h] === undefined) {

                                    b.push(node);
                                }
                                bhash[h] = node.getIdentifier();
                            });

                            return b;

                        },

                        /**
                         * Is result a turbo node or not.
                         * @returns {boolean}
                         */
                        isTurboNode: function () {
                            return this.turbonode === undefined ? false : this.turbonode;
                        },

                        /**
                         * @private
                         * @param {object}
                         * @param {string} property
                         * @returns {mixed}
                         */
                        getPropertyFromObject: function (object, property) {

                            return window.HybridsearchGetPropertyFromObject(object, property);

                        },

                        /**
                         * @private
                         * Get property.
                         * @param {string} property Get single property from node data.
                         * @returns {mixed}
                         */
                        getPropertyFromNode: function (node, property) {

                            return window.HybridsearchGetPropertyFromNode(node, property);


                        },

                        /**
                         * Get property.
                         * @param {string} property Get single property from node data.
                         * @returns {mixed}
                         */
                        getProperty: function (property) {


                            var value = '';
                            var propertyfullname = property;

                            if (this.properties == undefined) {
                                return value;
                            }

                            if (this.properties[property] !== undefined) {
                                return this.properties[property];
                            }

                            if (property.indexOf(".") >= 0) {

                                return this.getPropertyFromNode(this, property);
                            }


                            angular.forEach(this.properties, function (val, key) {
                                if (value === '' && key.substr(key.length - property.length, property.length) === property) {
                                    value = val !== undefined ? val : '';
                                    propertyfullname = key;
                                }
                            });

                            if (typeof value === 'string' && ((value.substr(0, 2) === '["' && value.substr(-2, 2) === '"]') || (value.substr(0, 2) === '[{' && value.substr(-2, 2) === '}]') )) {
                                try {
                                    var valueJson = JSON.parse(value);
                                } catch (e) {
                                    valueJson = value;
                                }
                                if (valueJson) {
                                    this.properties[propertyfullname] = valueJson;
                                    return this.properties[propertyfullname];
                                }
                            }

                            if (property == 'breadcrumb' && value == '') {
                                return this.breadcrumb
                            }

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
                         * @param maxlength
                         * @param delimiter
                         * @returns {string}
                         */
                        getPreview: function (maxlength, delimiter) {
                            if (maxlength === undefined) {
                                maxlength = 512;
                            }

                            var preview = this.properties.rawcontent === undefined ? '' : this.properties.rawcontent.substr(0, maxlength) + (this.properties.rawcontent.length >= maxlength ? ' ...' : '');

                            return preview.trim().replace(/<\/?[a-z][a-z0-9]*[^<>]*>/ig, "").replace(/\t/g, delimiter === undefined ? " ... " : delimiter);
                        },

                        /**
                         * Get sorting index
                         * @returns {integer}
                         */
                        getSortingIndex: function () {

                            return this.sortingindex === undefined ? 0 : this.sortingindex;
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
                        },

                        /**
                         * @private
                         * Get internal nodes storage
                         * @returns {array}
                         */
                        getNodes: function () {
                            return nodes;
                        },

                        /**
                         * @private
                         * Add node to internal nodes storage
                         * @param  {node} node
                         * @returns {array}
                         */
                        addNode: function (node) {
                            nodes[node['_node']['identifier']] = node;
                        }


                    };


                    this.$$app = {

                        /**
                         * @private
                         * @param request
                         * @return void
                         */
                        addPendingRequest: function (request) {
                            pendingRequests.push(request);
                        },
                        /**
                         * @private
                         * @return void
                         */
                        cancelAllPendingRequest: function () {
                            angular.forEach($http.pendingRequests, function (request) {
                                if (request.cancel && request.timeout) {
                                    request.cancel.resolve();
                                }
                            });
                        },
                        /**
                         * @private
                         * @return void
                         */
                        setHybridsearchInstanceNumber: function () {
                            hybridsearchInstanceNumber = window.hybridsearchInstances;
                        },
                        /**
                         * @private
                         * @return integer instance number
                         */
                        getHybridsearchInstanceNumber: function () {
                            return hybridsearchInstanceNumber === undefined ? 0 : hybridsearchInstanceNumber;
                        },
                        /**
                         * @private
                         * @return string last index hash
                         */
                        getLastIndexHash: function () {
                            return lastIndexHash;
                        },
                        /**
                         * @private
                         * @param string lastIndexHash
                         */
                        setLastIndexHash: function (hash) {
                            lastIndexHash = hash;
                        },
                        /**
                         * @private
                         * @return string indexInterval
                         */
                        getIndexInterval: function () {
                            return indexInterval;
                        },
                        /**
                         * @private
                         * @param string indexInterval
                         */
                        setIndexInterval: function (interval) {
                            indexInterval = interval;
                        },
                        /**
                         * @private
                         */
                        setIsRunning: function () {

                            /**
                             * init branch master/slave
                             */
                            var query = hybridsearch.$firebase().database().ref("branches/" + hybridsearch.$$conf.workspace);
                            query.on("value", function (snapshot) {
                                if (snapshot.val()) {
                                    hybridsearch.setBranch(snapshot.val());
                                } else {
                                    hybridsearch.setBranch("");
                                }

                                isRunning = true;

                            });


                        },
                        /**
                         * @private
                         */
                        setIsNodesByIdentifier: function () {
                            isNodesByIdentifier = true;
                        },
                        /**
                         * @private
                         */
                        addNodeByIdentifier: function (node) {
                            nodesByIdentifier[node.node.identifier] = node.node;
                        },
                        /**
                         * @private
                         */
                        getNodesAddedByIdentifier: function () {
                            return nodesByIdentifier;
                        },
                        /**
                         * @private
                         * @param string identifier of node
                         * returns {boolean}
                         */
                        isNodeAddedByIdentifier: function (identifier) {
                            return nodesByIdentifier[identifier] === undefined ? false : true;
                        },
                        /**
                         * @private
                         */
                        isNodesByIdentifier: function () {
                            return isNodesByIdentifier !== undefined ? true : false;
                        },
                        /**
                         * @private
                         * @param string first filter hash
                         */
                        setFirstFilterHash: function (hash) {
                            firstfilterhash = Sha1.hash(this.getHybridsearchInstanceNumber() + $location.$$absUrl + hash);
                        },
                        /**
                         * @private
                         * @returns string
                         */
                        getFirstFilterHash: function () {
                            return firstfilterhash;
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
                         * @returns {boolean}
                         */
                        getHybridsearch: function () {
                            return hybridsearch;
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
                         * @returns mixed
                         */
                        getNodeTypeProperties: function (nodeType) {

                            if (nodeType === undefined) {
                                return nodeTypeProperties === undefined ? {} : nodeTypeProperties;
                            } else {
                                return nodeTypeProperties[nodeType] !== undefined ? nodeTypeProperties[nodeType] : null;
                            }

                        },
                        /**
                         * @private
                         * @param nodeType
                         * @returns {*}
                         */
                        getNodeTypeLabel: function (nodeType) {
                            return nodeTypeLabels[nodeType] !== undefined ? nodeTypeLabels[nodeType] : (nodeTypeLabels['*'] === undefined ? nodeType : nodeTypeLabels['*']);
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

                            return propertiesBoost !== undefined && propertiesBoost[property] !== undefined ? propertiesBoost[property] : 10;
                        },
                        /**
                         * @private
                         * @param {node}
                         * @returns {number}
                         */
                        getParentNodeTypeBoostFactor: function (node) {


                            if (node.parentNode != undefined && ParentNodeTypeBoostFactor !== undefined) {

                                if (ParentNodeTypeBoostFactor[node.parentNode.nodeType] === undefined) {
                                    var filterReg = /[^0-9a-zA-ZöäüÖÄÜ]/g;
                                    var s = node.parentNode.nodeType.replace(filterReg, "-").toLowerCase();
                                    if (ParentNodeTypeBoostFactor[s] != undefined) {
                                        ParentNodeTypeBoostFactor[node.parentNode.nodeType] = ParentNodeTypeBoostFactor[s];
                                    }
                                }

                                if (ParentNodeTypeBoostFactor[node.parentNode.nodeType] != undefined) {
                                    return ParentNodeTypeBoostFactor[node.parentNode.nodeType];
                                }


                            }

                            return 1;

                        },
                        /**
                         * @private
                         * @param nodeType
                         * @returns {array}
                         */
                        getGroupedBy: function (nodeType) {

                            var grouped = resultGroupedBy !== undefined && resultGroupedBy[nodeType] !== undefined ? resultGroupedBy[nodeType] : [];


                            if (this.getNodeTypeLabel(nodeType) !== nodeType && grouped.length === 0) {
                                grouped = resultGroupedBy !== undefined && resultGroupedBy[this.getNodeTypeLabel(nodeType)] !== undefined ? resultGroupedBy[this.getNodeTypeLabel(nodeType)] : [];
                            }

                            if (typeof grouped === 'string') {
                                var g = grouped;
                                grouped = [];
                                grouped.push(g);
                            }

                            return grouped;

                        },
                        /**
                         * @private
                         * @returns {boolean}
                         */
                        hasOrderBy: function () {
                            return resultOrderBy !== undefined && Object.keys(resultOrderBy).length > 0 ? true : false;
                        },
                        /**
                         * @private
                         * @param nodeType
                         * @returns {array}
                         */
                        getOrderBy: function (nodeType) {

                            var order = resultOrderBy !== undefined && resultOrderBy[nodeType] !== undefined ? resultOrderBy[nodeType] : [];

                            if (this.getNodeTypeLabel(nodeType) !== nodeType && order.length === 0) {
                                order = resultOrderBy !== undefined && resultOrderBy[this.getNodeTypeLabel(nodeType)] !== undefined ? resultOrderBy[this.getNodeTypeLabel(nodeType)] : [];
                            }


                            if (typeof order === 'string') {
                                var g = order;
                                order = [];
                                order.push(g);
                            }

                            return order;

                        },
                        /**
                         * @private
                         * @returns string
                         */
                        getCategorizedBy: function () {
                            return resultCategorizedBy;

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
                         * @param properties
                         */
                        setNodeTypeProperties: function (properties) {
                            results.$$app.setNodeTypeProperties(properties);
                            nodeTypeProperties = properties;
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
                         * @param boost
                         */
                        setParentNodeTypeBoostFactor: function (boost) {
                            ParentNodeTypeBoostFactor = boost;
                        },
                        /**
                         * @private
                         * @param boost
                         */
                        setGroupedBy: function (groupedBy) {
                            resultGroupedBy = groupedBy;
                        },
                        /**
                         * @private
                         * @param boost
                         */
                        setOrderBy: function (orderBy) {
                            resultOrderBy = orderBy;
                        },
                        /**
                         * @private
                         * @param categorizedBy
                         */
                        setCategorizedBy: function (categorizedBy) {
                            resultCategorizedBy = categorizedBy;
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
                         * @param {object} filters
                         * @returns {hybridsearchFilterObject}
                         */
                        setFilter: function (filters) {


                            var self = this;

                            if (filters) {

                                angular.forEach(filters, function (filter, identifier) {

                                    switch (identifier) {

                                        case 'propertyFilters':

                                            angular.forEach(filter, function (obj, property) {
                                                if (self.getFilter().getScopeProperties()[identifier][property] !== undefined) {
                                                    self.getFilter().getScopeByIdentifier(identifier)[property] = obj.value;
                                                    setTimeout(function () {
                                                        self.getFilter().getScopeByIdentifier(identifier).$apply(function () {
                                                        });
                                                    }, 5);
                                                }
                                            });
                                            break;

                                        case 'query':
                                            if (self.getFilter().getScopeProperties()[identifier] !== undefined) {
                                                self.getFilter().getScopeByIdentifier(identifier)[Object.keys(self.getFilter().getScopeProperties()[identifier])[0]] = filter;
                                                setTimeout(function () {
                                                    self.getFilter().getScopeByIdentifier(identifier).$apply(function () {
                                                    });
                                                }, 5);
                                            }
                                            break;

                                    }

                                });
                            } else {

                                angular.forEach(self.getFilter().getScopeProperties(), function (obj, identifier) {

                                    switch (identifier) {
                                        // remove current query
                                        case 'query':
                                            self.getFilter().getScopeByIdentifier(identifier)[Object.keys(self.getFilter().getScopeProperties()[identifier])[0]] = '';
                                            setTimeout(function () {
                                                self.getFilter().getScopeByIdentifier(identifier).$apply(function () {
                                                });
                                            }, 5);
                                    }


                                });

                            }


                            return filter;

                        },


                        /**
                         * @private
                         * @returns mixed
                         */
                        clearLocationHash: function () {
                            $location.search('q' + this.getHybridsearchInstanceNumber(), null);

                        },

                        /**
                         * @private
                         * @returns mixed
                         */
                        getSearchCounter: function () {

                            return searchCounter;

                        },

                        /**
                         * @private
                         * @returns mixed
                         */
                        resetSearchCounter: function () {

                            searchCounter = 0;

                        },

                        /**
                         * Get node by identifier from current search result.
                         * @param {string} identifier
                         * @returns {HybridsearchResultsNode}
                         */
                        getResultNodeByIdentifier: function (identifier) {
                            return this.getResults().$$data.nodes[identifier] === undefined ? null : new HybridsearchResultsNode(this.getResults().$$data.nodes[identifier], 1);
                        },

                        /**
                         * @private
                         * @params nodesFromInput
                         * @params {boolean} booleanmode
                         * @returns mixed
                         */
                        search: function (nodesFromInput, booleanmode) {


                            var fields = {}, items = {}, self = this, nodesFound = {}, nodeTypeMaxScore = {}, nodeTypeMinScore = {}, nodeTypeScoreCount = {}, nodeTypeCount = {};


                            // set not found if search was timed out withou any results
                            if (searchCounterTimeout) {
                                clearTimeout(searchCounterTimeout);
                            }
                            searchCounterTimeout = setTimeout(function () {
                                if (self.getResults().countAll() === 0) {
                                    self.getResults().getApp().setNotFound(true);
                                }
                            }, 3000);


                            if (lunrSearch.getFields().length == 0 && self.getFilter().getFullSearchQuery() !== false) {
                                // skip search, search field not ready yet
                                return false;
                            }


                            items['_nodes'] = {};
                            items['_nodesTurbo'] = {};
                            items['_nodesByType'] = {};

                            if (nodesFromInput == undefined && self.getNodesAddedByIdentifier()) {
                                nodesFromInput = self.getNodesAddedByIdentifier();
                            }





                            if (!self.getFilter().getFullSearchQuery()) {

                                if (nodesFromInput !== undefined) {

                                    var preOrdered = [];

                                    // return all nodes bco no query set
                                    angular.forEach(nodesFromInput, function (node) {

                                        if (self.isFiltered(node) === false) {
                                            preOrdered.push(node);
                                        }
                                    });

                                    var Ordered = $filter('orderBy')(preOrdered, function (node) {
                                        var ostring = '';

                                        angular.forEach(self.getOrderBy(node.nodeType), function (property) {

                                            var s = self.getPropertyFromNode(node, property);
                                            if (typeof s === 'string') {
                                                ostring += s;
                                            }

                                        });

                                        return ostring;
                                    });

                                    angular.forEach(Ordered, function (node) {
                                        self.addNodeToSearchResult(node.identifier, 1, nodesFound, items, nodeTypeMaxScore, nodeTypeMinScore, nodeTypeScoreCount);
                                    });

                                }


                            } else {

                                var query = filter.getFinalSearchQuery(lastSearchInstance);



                                var preOrdered = [];


                                if (query === false) {
                                    // return all nodes bco no query set
                                    angular.forEach(nodesFromInput, function (node) {
                                        if (self.isFiltered(node) === false) {
                                            preOrdered.push(node);
                                        }
                                    });
                                    if (self.hasOrderBy()) {
                                        var Ordered = $filter('orderBy')(preOrdered, function (node) {

                                            var ostring = '';

                                            angular.forEach(self.getOrderBy(node.nodeType), function (property) {

                                                var s = self.getPropertyFromNode(node, property);
                                                if (typeof s === 'string') {
                                                    ostring += s;
                                                }

                                            });


                                            return ostring;


                                        });
                                    } else {
                                        var Ordered = preOrdered;
                                    }

                                    angular.forEach(Ordered, function (node) {
                                        self.addNodeToSearchResult(node.identifier, 1, nodesFound, items, nodeTypeMaxScore, nodeTypeMinScore, nodeTypeScoreCount);
                                    });

                                } else {


                                    // execute query search
                                    angular.forEach(lunrSearch.getFields(), function (v, k) {
                                        if (self.getBoost(v) >= 0) {
                                            fields[v] = {boost: self.getBoost(v)}
                                        }
                                    });


                                    var tmp = {};
                                    var resultAnd = lunrSearch.search(query, {
                                        fields: fields,
                                        bool: "AND"
                                    });

                                    if (resultAnd.length > 0) {
                                        
                                        // do AND search first
                                        angular.forEach(resultAnd, function (item) {

                                                if (nodes[item.ref] !== undefined) {

                                                    if (self.isNodesByIdentifier()) {
                                                        // post filter node
                                                        if (self.isFiltered(nodes[item.ref]) === false) {
                                                            preOrdered.push(item);
                                                        }
                                                    } else {
                                                        // dont post filter because filter were applied before while filling search index
                                                        preOrdered.push(item);
                                                    }

                                                    tmp[item.ref] = item.score;
                                                }

                                            }
                                        );
                                    }

                                    if (resultAnd.length == 0) {

                                        // merge OR search first with lower score
                                        angular.forEach(lunrSearch.search(query+ ' '+self.getFilter().$$data.query, {
                                                fields: fields,
                                                bool: "OR"
                                            }), function (item) {

                                                if (nodes[item.ref] !== undefined && tmp[item.ref] === undefined) {

                                                    item.score = item.score / 25;

                                                    if (self.isNodesByIdentifier()) {
                                                        // post filter node
                                                        if (self.isFiltered(nodes[item.ref]) === false) {
                                                            preOrdered.push(item);
                                                        }
                                                    } else {
                                                        // dont post filter because filter were applied before while filling search index
                                                        preOrdered.push(item);
                                                    }
                                                }

                                            }
                                        );
                                    }

                                    // filter out not relevant items and apply parent node type boost factor

                                    var preOrdered = $filter('orderBy')(preOrdered, function (item) {
                                        item.score = item.score * self.getParentNodeTypeBoostFactor(nodes[item.ref]);
                                        return -1 * item.score;
                                    });

                                    var preOrderedFilteredRelevance = [];


                                    angular.forEach(preOrdered, function (item) {

                                        if (nodeTypeMaxScore[self.getNodeTypeLabel(nodes[item.ref].nodeType)] === undefined) {
                                            nodeTypeMaxScore[self.getNodeTypeLabel(nodes[item.ref].nodeType)] = item.score;
                                        } else {
                                            if (nodeTypeMaxScore[self.getNodeTypeLabel(nodes[item.ref].nodeType)] < item.score) {
                                                nodeTypeMaxScore[self.getNodeTypeLabel(nodes[item.ref].nodeType)] = item.score;
                                            }
                                        }

                                        // if (nodeTypeMinScore[self.getNodeTypeLabel(nodes[item.ref].nodeType)] === undefined) {
                                        //     nodeTypeMinScore[self.getNodeTypeLabel(nodes[item.ref].nodeType)] = item.score;
                                        // } else {
                                        //     if (nodeTypeMinScore[self.getNodeTypeLabel(nodes[item.ref].nodeType)] >= item.score) {
                                        //         nodeTypeMinScore[self.getNodeTypeLabel(nodes[item.ref].nodeType)] = item.score;
                                        //     }
                                        // }

                                        if (nodeTypeScoreCount[self.getNodeTypeLabel(nodes[item.ref].nodeType)] === undefined) {
                                            nodeTypeScoreCount[self.getNodeTypeLabel(nodes[item.ref].nodeType)] = {};
                                        }

                                        if (nodeTypeScoreCount[self.getNodeTypeLabel(nodes[item.ref].nodeType)][item.score] === undefined) {
                                            nodeTypeScoreCount[self.getNodeTypeLabel(nodes[item.ref].nodeType)][item.score] = 1;
                                        } else {
                                            nodeTypeScoreCount[self.getNodeTypeLabel(nodes[item.ref].nodeType)][item.score]++;
                                        }


                                    });


                                    var ql = query.split(" ").length + 1;

                                    angular.forEach(preOrdered, function (item) {
                                        if (Object.keys(nodeTypeScoreCount[self.getNodeTypeLabel(nodes[item.ref].nodeType)]).length == 1 || Object.keys(nodeTypeScoreCount[self.getNodeTypeLabel(nodes[item.ref].nodeType)]).length > 10) {
                                            preOrderedFilteredRelevance.push(item);
                                        } else {
                                            if (item.score / nodeTypeMaxScore[self.getNodeTypeLabel(nodes[item.ref].nodeType)] < 1 / ql) {
                                                // skip irelevant score
                                            } else {
                                                preOrderedFilteredRelevance.push(item);
                                            }
                                        }
                                    });

                                    if (self.hasOrderBy()) {
                                        var Ordered = $filter('orderBy')(preOrderedFilteredRelevance, function (item) {

                                            var orderBy = self.getOrderBy(nodes[item.ref].nodeType);
                                            if (orderBy) {

                                                var ostring = '';

                                                angular.forEach(orderBy, function (property) {
                                                    if (property === 'score') {
                                                        ostring += item.score;
                                                    } else {
                                                        var s = self.getPropertyFromNode(nodes[item.ref], property);
                                                        if (typeof s === 'string') {
                                                            ostring += s;
                                                        }
                                                    }
                                                });


                                                return ostring;

                                            } else {
                                                return -1 * item.score;
                                            }


                                        });
                                    } else {
                                        var Ordered = preOrderedFilteredRelevance;
                                    }


                                    angular.forEach(Ordered, function (item) {
                                        self.addNodeToSearchResult(item.ref, item.score, nodesFound, items, nodeTypeMaxScore, nodeTypeMinScore, nodeTypeScoreCount);
                                    });

                                }


                            }


                            if (results.hasDistincts()) {
                                if (nodesLastHash > 0 && this.getLocalIndexHash() !== nodesLastHash) {
                                    results.updateDistincts();

                                }
                                if (nodesLastHash === 1) {
                                    nodesLastHash = this.getLocalIndexHash();
                                }


                            }

                            results.getApp().setResults(items, nodes, this);

                            // if (searchCounterTimeout) {
                            //     clearTimeout(searchCounterTimeout);
                            // }


                            //clearInterval(self.getIndexInterval());


                        },


                        /**
                         * @private
                         * @param integer nodeId
                         * @param float score relevance
                         * @param array nodesFound list
                         * @param array items list
                         * @param array nodeTypeMaxScore list
                         * @param array nodeTypeMinScore list
                         * @param array nodeTypeScoreCount list
                         * @returns boolean
                         */
                        addNodeToSearchResult: function (nodeId, score, nodesFound, items, nodeTypeMaxScore, nodeTypeMinScore, nodeTypeScoreCount) {


                            if (nodes[nodeId] == undefined) {
                                return false;
                            }

                            var skip = false;
                            var resultNode = new HybridsearchResultsNode(nodes[nodeId], score);
                            var hash = nodes[nodeId].hash;
                            var groupedBy = this.getGroupedBy(nodes[nodeId].nodeType);
                            var nodeTypeLabel = this.getCategorizedBy() == 'nodeType' ? this.getNodeTypeLabel(nodes[nodeId].nodeType) : resultNode.getProperty(this.getCategorizedBy());

                            if (groupedBy.length) {

                                var groupedString = '';

                                angular.forEach(groupedBy, function (property) {
                                    var p = resultNode.getProperty(property);
                                    if (typeof p === 'string' && p.trim() === '') {
                                        skip = true;
                                    }
                                    groupedString += p;
                                });


                                if (groupedString == 0 || groupedString == '') {
                                    skip = true;
                                } else {
                                    hash = Sha1.hash(groupedString);
                                }

                            }


                            if (items['_nodesByType'][nodeTypeLabel] === undefined) {
                                items['_nodesByType'][nodeTypeLabel] = {};
                            }


                            if (nodesFound[hash] !== undefined) {
                                skip = true;
                            }


                            if (skip === false) {

                                // nodeTypeMaxScore[nodeTypeLabel] = score;
                                // nodeTypeMinScore[nodeTypeLabel] = score;

                                if (nodes[nodeId]['turbonode'] === true) {
                                    items['_nodesTurbo'][hash] = resultNode;
                                } else {
                                    items['_nodes'][hash] = resultNode;
                                }


                                items['_nodesByType'][nodeTypeLabel][hash] = resultNode;
                            } else {
                                if (items['_nodes'][hash] !== undefined) {
                                    items['_nodes'][hash].setGrouped();
                                }
                                resultNode.setGrouped();

                            }

                            // add item as grouped node

                            if (items['_nodes'][hash] !== undefined) {
                                items['_nodes'][hash].addGroupedNode(resultNode);
                            }

                            nodesFound[hash] = nodeId;

                        },
                        /**
                         * @private
                         * @param {object}
                         * @param {string} property
                         * @returns {mixed}
                         */
                        getPropertyFromObject: function (object, property) {

                            return window.HybridsearchGetPropertyFromObject(object, property);


                        },

                        /**
                         * Get property.
                         * @param {string} property Get single property from node data.
                         * @returns {mixed}
                         */
                        getPropertyFromNode: function (node, property) {

                            return window.HybridsearchGetPropertyFromNode(node, property);

                        },

                        /**
                         * @private
                         * @returns boolean
                         */
                        isFiltered: function (node) {

                            var self = this;


                            if (this.getFilter().getNodeType() && this.getFilter().getNodeType() !== node.nodeType) {
                                return true;
                            }


                            if (this.getFilter().getNodePath().length > 0 && node.uri.path.substr(0, this.getFilter().getNodePath().length) != this.getFilter().getNodePath()) {
                                return true;
                            }


                            var propertyFiltered = Object.keys(this.getFilter().getPropertyFilters()).length > 0 ? true : false;
                            var propertyFilteredLength = Object.keys(this.getFilter().getPropertyFilters()).length;


                            if (propertyFiltered) {

                                var propertyMatching = 0;


                                angular.forEach(this.getFilter().getPropertyFilters(), function (filter, property) {

                                    if (filter.nodeType !== undefined && filter.nodeType != node.nodeType) {
                                        propertyMatching++;
                                    } else {

                                        var filterApplied = false, filterobject = {};


                                        var propertyValue = self.getPropertyFromNode(node, property);


                                        // filter is null
                                        if (filterApplied === false && filter.value === null) {
                                            propertyMatching++;
                                            filterApplied = true;
                                        }

                                        // filter is string
                                        if (filterApplied === false && typeof filter.value === 'string') {

                                            if (((filter.reverse === false && propertyValue == filter.value) || (filter.reverse === true && propertyValue != filter.value))) {
                                                propertyMatching++;
                                            }

                                            filterApplied = true;
                                        }


                                        // convert array to object
                                        if (filterApplied === false && filter.value.length) {
                                            var filterobject = {};
                                            angular.forEach(filter.value, function (value) {
                                                filterobject[value] = true;
                                            });
                                        } else {
                                            filterobject = filter.value;
                                        }


                                        // filter is object
                                        if (filterApplied === false && Object.keys(filterobject).length > 0) {

                                            var isMatching = 0;


                                            angular.forEach(filterobject, function (value, key) {


                                                if (value) {
                                                    if ((filter.reverse === false && (key == propertyValue) || self.inArray(key, propertyValue)) || (filter.reverse == true && key != propertyValue && self.inArray(key, propertyValue) === false)) {

                                                        isMatching++;
                                                    }
                                                } else {
                                                    if (filter.booleanmode === false) {
                                                        isMatching++;
                                                    }
                                                }
                                            });


                                            if (filter.booleanmode === false && isMatching === Object.keys(filterobject).length) {
                                                propertyMatching++;
                                            }

                                            if (filter.booleanmode === true && isMatching > 0) {
                                                propertyMatching++;
                                            }

                                            filterApplied = true;

                                        }

                                        if (filterApplied === false) {
                                            propertyMatching++;
                                        }

                                    }

                                });


                                if (propertyMatching !== propertyFilteredLength) {
                                    return true;

                                } else {
                                    propertyFiltered = false;
                                }

                            }


                            if (propertyFiltered === false && this.getFilter().getAgeFilter() != '') {
                                if (this.getFilter().getPropertyFilters() != node.__userAgeBracket) {
                                    return true;
                                }
                            }

                            if (propertyFiltered === false && this.getFilter().getGenderFilter() != '') {
                                if (this.getFilter().getGenderFilter() != node.__userGender) {
                                    return true;
                                }
                            }


                            return propertyFiltered;

                        },


                        /**
                         * @private
                         * @param {string} target
                         * @param {array} array
                         * @returns mixed
                         */
                        inArray: function (target, array) {

                            if (array !== undefined) {
                                for (var i = 0; i < array.length; i++) {

                                    if (array[i] == target) {
                                        return true;
                                    }
                                }
                            }

                            return false;
                        },

                        /**
                         * @private
                         * @returns mixed
                         */
                        setSearchIndex: function () {


                            var self = this;
                            nodes = {};
                            self.cancelAllPendingRequest();

                            if (self.isNodesByIdentifier() === false && self.isRunning() && filter.hasFilters()) {


                                if (lastSearchInstance) {
                                    // cancel old requests
                                    angular.forEach(lastSearchInstance.$$data.promises, function (unbind) {
                                        unbind();
                                    });
                                    lastSearchInstance = null;
                                    lastSearchInstance = {};
                                }

                                if (searchInstancesInterval) {
                                    clearInterval(searchInstancesInterval);
                                }


                                var keywords = self.getFilter().getQueryKeywords();


                                // fetch index from given keywords
                                var searchIndex = new this.SearchIndexInstance(self, keywords);
                                lastSearchInstance = searchIndex.getIndex();

                                var counter = 0;
                                searchInstancesInterval = setInterval(function () {
                                    counter++;
                                    if (lastSearchInstance.$$data.canceled === true || counter > 15000 || lastSearchInstance.$$data.proceeded.length >= lastSearchInstance.$$data.running) {
                                        clearInterval(searchInstancesInterval);
                                        lastSearchInstance.execute(self, lastSearchInstance);
                                    }
                                }, 4);


                            } else {
                                if (self.isRunning()) {
                                    self.search();
                                }
                            }


                        },

                        /**
                         * @private
                         * @returns mixed
                         */
                        SearchIndexInstance: function (self, keywords) {


                            this.$$data = {
                                keywords: [],
                                running: 0,
                                proceeded: [],
                                canceled: false,
                                promises: {}
                            };

                            Object.defineProperty(this, '$$data', {
                                value: this.$$data
                            });


                            /**
                             * Run search.
                             * @returns {SearchIndexInstance} SearchIndexInstance
                             */
                            this.getIndex = function () {

                                var instance = this;

                                if (keywords !== undefined) {


                                    angular.forEach(keywords, function (keyword) {
                                        if (keyword.length > 2 || (keyword.length === 2 && isNaN(keyword) === false)) {
                                            self.getKeywords(keyword, instance);
                                        }
                                    });

                                }


                                return instance;


                            },

                                /**
                                 * execute search.
                                 * @returns {SearchIndexInstance} SearchIndexInstance
                                 */
                                this.execute = function (self, lastSearchInstance) {


                                    clearInterval(self.getIndexInterval());


                                    if (lastSearchInstance.$$data.keywords.length) {

                                        var matchexact = [];
                                        var query = " " + filter.getQuery() + " ";


                                        angular.forEach(lastSearchInstance.$$data.keywords, function (v, k) {



                                            if (v == query || query.search(" " + v + " ") >= 0 || query.indexOf(v) >= 0 || (
                                                v.length > 6 && query.search(" " + v.substr(0, 6)) >= 0 )
                                            ) {
                                                if (query.search(v) > 0) {
                                                    matchexact.push(v);
                                                }

                                            }

                                        });


                                        if (matchexact.length) {
                                            matchexact.sort();
                                            lastSearchInstance.$$data.keywords = matchexact;

                                        }



                                        // get unique
                                        var uniqueobject = {};
                                        var uniquarray = [];

                                        angular.forEach(lastSearchInstance.$$data.keywords, function (keyword) {
                                            if (uniqueobject[keyword] === undefined) {
                                                uniquarray.push(keyword);
                                            }
                                            uniqueobject[keyword] = true;
                                        });


                                        // reduce more based on subterm
                                        var uniqueobject = {};
                                        var uniquarrayfinal = [];

                                        angular.forEach(lastSearchInstance.$$data.keywords, function (keyword) {

                                            if (self.getFilter().isBlockedKeyword(keyword) === false) {
                                                if (uniqueobject[keyword.substr(0, 6)] === undefined) {
                                                    uniqueobject[keyword.substr(0, 6)] = {};
                                                }
                                                uniqueobject[keyword.substr(0, 6)][keyword] = keyword;
                                            }
                                        });


                                        angular.forEach(uniqueobject, function (short, key) {

                                            var match = false;
                                            angular.forEach(short, function (term) {

                                                //if (query.search(" " + term + " ") >= 0) {
                                                    match = term;
                                                //}
                                            });

                                            if (match) {
                                                uniquarrayfinal.push(match);
                                            } else {
                                                angular.forEach(short, function (term) {

                                                    if (query.search(" " + term.substr(0, 3)) > -1) {
                                                        uniquarrayfinal.push(term);
                                                    }

                                                });
                                            }

                                        });

                                    } else {


                                        // fetch index from non query request
                                        if (self.getFilter().getQuery() === '') {
                                            uniquarrayfinal = [null];
                                        } else {
                                            self.search();
                                        }

                                    }





                                    // fetch index data
                                    var indexintervalcounter = 0;
                                    var indexcounter = 0;
                                    var indexdata = {};

                                    var cleanedup = false;


                                    angular.forEach(uniquarrayfinal, function (keyword) {


                                        if (hybridsearch.$$conf.cdnHost !== undefined) {


                                            // bind indirectly after preloading over rest/cdn
                                            $http({
                                                method: 'GET',
                                                cache: true,
                                                headers: {
                                                    "Cache-Control": "public, max-age=360",
                                                },
                                                url: self.getIndex(keyword, true),
                                            }).then(function successCallback(response) {


                                                angular.forEach(response.data, function (node, id) {
                                                    nodes[id] = node.node;
                                                });
                                                if (keyword === null) {
                                                    self.search(nodes);
                                                } else {

                                                    indexdata[keyword] = [];
                                                    filter.addAutocompletedKeywords(keyword);
                                                    angular.forEach(response.data, function (node, id) {
                                                        indexdata[keyword].push(node);
                                                    });
                                                    //self.updateLocalIndex(indexdata);
                                                    indexcounter++;

                                                }


                                                self.getIndex(keyword).on("child_changed", function (data) {
                                                    self.getIndex(keyword).once("value", function (data) {
                                                        angular.forEach(data.val(), function (node, id) {
                                                            nodes[id] = node.node;
                                                        });
                                                        if (keyword === null) {
                                                            self.search(nodes);
                                                        } else {
                                                            indexdata[keyword] = [];
                                                            angular.forEach(data.val(), function (node, id) {
                                                                nodes[id] = node;
                                                                indexdata[keyword].push(node);
                                                            });
                                                            self.updateLocalIndex(indexdata);
                                                            indexcounter++;
                                                        }
                                                    });
                                                });


                                            }, function errorCallback() {

                                                // called asynchronously if an error occurs
                                                // or server returns response with an error status.
                                                self.getIndex(keyword).on("value", function (data) {
                                                    angular.forEach(data.val(), function (node, id) {
                                                        nodes[id] = node.node;
                                                    });
                                                    if (keyword === null) {
                                                        self.search(nodes);
                                                    } else {
                                                        indexdata[keyword] = [];
                                                        angular.forEach(data.val(), function (node, id) {
                                                            nodes[id] = node;
                                                            indexdata[keyword].push(node);
                                                        });
                                                        self.updateLocalIndex(indexdata);
                                                        indexcounter++;
                                                    }
                                                });
                                            });

                                        } else {
                                            // called asynchronously if an error occurs
                                            // or server returns response with an error status.
                                            self.getIndex(keyword).on("value", function (data) {


                                                angular.forEach(data.val(), function (node, id) {
                                                    nodes[id] = node.node;
                                                });


                                                if (keyword === null) {
                                                    self.search(nodes);
                                                } else {
                                                    indexdata[keyword] = [];
                                                    angular.forEach(data.val(), function (node, id) {
                                                        nodes[id] = node;
                                                        indexdata[keyword].push(node);
                                                    });
                                                    self.updateLocalIndex(indexdata);
                                                    indexcounter++;
                                                }
                                            });
                                        }


                                    });


                                    if (lastSearchInstance.$$data.keywords.length) {
                                        // wait for all data and put it together to search index
                                        self.setIndexInterval(setInterval(function () {

                                            if (indexintervalcounter > 200 || indexcounter >= uniquarrayfinal.length) {
                                                clearInterval(self.getIndexInterval());

                                                var hash = self.getFilter().getHash() + " " + Sha1.hash(JSON.stringify(indexdata));

                                                if (hash !== self.getLastIndexHash() || results.count() === 0) {
                                                    if (cleanedup === false) {
                                                        results.$$app.clearResults();
                                                        self.cleanLocalIndex();
                                                        cleanedup = true;
                                                    }
                                                    self.updateLocalIndex(indexdata);
                                                } else {
                                                    self.setLastIndexHash(hash);
                                                    self.search();
                                                }


                                            }
                                            indexintervalcounter++;

                                        }, 5));
                                    }


                                    return this;
                                }
                            ;


                        }

                        ,
                        /**
                         * @private
                         * @param string querysegment
                         * @returns {firebaseObject}
                         */
                        getKeyword: function (querysegment) {

                            return hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "keywords/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/" + querysegment);
                        }

                        ,
                        /**
                         * @private
                         * @param string querysegment
                         * @param {object}
                         * @param boolean synchronous
                         * @returns {firebaseObject}
                         */
                        getKeywords: function (querysegment, instance) {

                            var self = this;
                            var substrStart = querysegment.toLowerCase();
                            var substrEnd = substrStart;
                            if (substrStart.length > 8) {
                                substrStart = substrStart.substr(0, substrStart.length - 3);
                            }


                            if (this.getFilter().getNodeType()) {
                                substrStart = "_" + this.getFilter().getNodeType() + substrStart;
                                substrEnd = "_" + this.getFilter().getNodeType() + substrEnd;
                            }

                            instance.$$data.running++;

                             if (parseInt(substrEnd) > 0) {
                              var ref = hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "keywords/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/").orderByKey().equalTo(substrEnd).limitToFirst(5);
                              } else {
                                 var ref = hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "keywords/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/").orderByKey().startAt(substrStart).limitToFirst(5);
                            }



                            ref.once("value", function (data) {

                                if (data !== undefined) {



                                    angular.forEach(data.val(), function (v, k) {


                                            if (self.getFilter().getNodeType()) {
                                                var kk = k.substr(self.getFilter().getNodeType().length+1);
                                                if (kk.substr(0,querysegment.length) == querysegment) {
                                                    instance.$$data.keywords.push(kk);
                                                }

                                            } else {
                                                if (k.substr(0,querysegment.length) == querysegment) {
                                                    instance.$$data.keywords.push(k);
                                                }
                                            }


                                    });

                                    var ismatchexact = false;
                                    angular.forEach(instance.$$data.keywords, function (k) {

                                        if (ismatchexact === false && k == querysegment) {
                                            ismatchexact = true;
                                        }

                                    });
                                    if (ismatchexact) {
                                        instance.$$data.keywords.push(querysegment);
                                    }



                                }



                                instance.$$data.proceeded.push(1);

                            });


                        }


                        ,
                        /**
                         * @private
                         * @param string keyword
                         * @param boolan rest using rest
                         * @returns {firebaseObject}
                         */
                        getIndex: function (keyword, rest) {


                            var self = this;


                            // remove old bindings
                            angular.forEach(index, function (ref, keyw) {
                                if (self.getFilter().isInQuery(keyw) === false || keyword == keyw) {
                                    ref.off('value');
                                }
                            });


                            if (keyword === undefined || keyword === null) {
                                keyword = this.getFilter().getQuery() ? this.getFilter().getQuery() : '';
                            }

                            var query = false;

                            if (query === false && this.getFilter().getNodeType()) {
                                if (keyword === "") {


                                    if (rest) {
                                        return (hybridsearch.$$conf.cdnHost === undefined ? hybridsearch.$$conf.databaseURL : hybridsearch.$$conf.cdnHost ) + '/sites/' + hybridsearch.$$conf.site + '/index/' + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/__" + this.getFilter().getNodeType() + '/.json';
                                    } else {
                                        query = hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/__" + this.getFilter().getNodeType());
                                    }

                                    keyword = this.getFilter().getNodeType();


                                } else {

                                    if (rest) {
                                        return (hybridsearch.$$conf.cdnHost === undefined ? hybridsearch.$$conf.databaseURL : hybridsearch.$$conf.cdnHost ) + '/sites/' + hybridsearch.$$conf.site + '/index/' + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/_" + this.getFilter().getNodeType() + keyword + '/.json';
                                    } else {


                                        query = hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/__" + this.getFilter().getNodeType());
                                    }


                                }
                            }


                            if (query === false) {
                                if (keyword === null) {
                                    return null;
                                }

                                if (rest) {
                                    return (hybridsearch.$$conf.cdnHost === undefined ? hybridsearch.$$conf.databaseURL : hybridsearch.$$conf.cdnHost ) + '/sites/' + hybridsearch.$$conf.site + '/index/' + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + '/' + keyword + '/.json';
                                } else {
                                    query = hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + '/' + keyword);
                                }
                            }

                            index[keyword] = query;

                            return query;

                        },

                        /**
                         * @private
                         * @param string identifier
                         * @returns {firebaseObject}
                         */
                        getIndexByNodeIdentifier: function (identifier) {
                            return hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/" + identifier + "/" + identifier);
                        },

                        /**
                         * @private
                         * @param string identifier
                         * @returns {firebaseObject}
                         */
                        getIndexByNodeType: function (nodeType) {
                            return hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/").orderByChild("_nodetype").equalTo(nodeType);
                        },

                        /**
                         * @private
                         * @returns string
                         */
                        getLocalIndexHash: function () {
                            return Sha1.hash(JSON.stringify({nodes: nodes, q: this.getFilter().getQuery()}));
                        },
                        /**
                         * @private
                         * @param array
                         * @returns void
                         */
                        cleanLocalIndex: function () {

                            if (results.hasDistincts()) {
                                this.setNodesLastHash(this.getLocalIndexHash());
                            }

                            nodes = {};

                            this.getFilter().setAutocompletedKeywords('');
                            lunrSearch = null;
                            lunrSearch = elasticlunr(function () {
                                this.setRef('id');
                            });

                        },

                        /**
                         * @private
                         * @param string
                         * @returns void
                         */
                        setNodesLastHash: function (hash) {
                            nodesLastHash = hash;

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


                                angular.forEach(data, function (val, keyword) {
                                    self.addLocalIndex(val, keyword);
                                });


                            } else {

                                // add to local index
                                angular.forEach(data, function (value) {
                                    if (value.node !== undefined) {
                                        nodes[value.node.identifier] = value.node;
                                    }
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
                         * @param object data
                         * @param string keyword
                         * @returns mixed
                         */
                        addLocalIndex: function (data, keyword) {

                            var self = this;


                            angular.forEach(data, function (value, key) {


                                if (self.isFiltered(value.node) === false) {

                                    nodes[value.node.identifier] = value.node;


                                    if (value.node != undefined && value.node.properties != undefined) {

                                        var doc = JSON.parse(JSON.stringify(value.node.properties));


                                        angular.forEach(doc, function (propvalue, property) {


                                            if (typeof propvalue === 'string' && ((propvalue.substr(0, 1) == '{') || ((propvalue.substr(0, 2) === '["' && propvalue.substr(-2, 2) === '"]')) || (propvalue.substr(0, 2) === '[{' && propvalue.substr(-2, 2) === '}]'))) {
                                                try {
                                                    var valueJson = JSON.parse(propvalue);
                                                } catch (e) {
                                                    valueJson = false;
                                                }

                                                if (valueJson) {

                                                    angular.forEach(valueJson, function (val, subproperty) {
                                                        if (typeof val == 'string') {

                                                            doc[property + "-" + subproperty] = val.replace(/<\/?[a-z][a-z0-9]*[^<>]*>/ig, "").trim().toLowerCase();
                                                        } else {
                                                            try {
                                                                angular.forEach(val, function (val2, subsubproperty) {
                                                                    if (typeof val2 == 'string') {
                                                                        doc[property + "-" + subproperty + "-" + subsubproperty] = val2.replace(/<\/?[a-z][a-z0-9]*[^<>]*>/ig, "").trim().toLowerCase();
                                                                    }

                                                                });
                                                            } catch (e) {
                                                                // skpp
                                                            }

                                                        }


                                                    });

                                                }

                                            }

                                            if (typeof propvalue == 'string') {
                                                doc[property] = propvalue.replace(/<\/?[a-z][a-z0-9]*[^<>]*>/ig, "").trim().toLowerCase();
                                            }


                                        });


                                        if (keyword !== undefined) {

                                            angular.forEach(Object.keys(doc), function (property) {

                                                var propvalue = doc[property];
                                                var i = typeof propvalue == 'string' ? propvalue.indexOf(keyword) : -2;

                                                if (i == -1) {

                                                    delete doc[property];
                                                } else {
                                                    if (i != -2 && propvalue.length > 120) {
                                                        doc[property] = propvalue.substr(i - 60 > 0 ? i - 60 : 0, keyword.length + 60);
                                                    } else {
                                                        if (propvalue.length < 3) {
                                                            delete doc[property];
                                                        }
                                                    }
                                                }

                                            });
                                        }


                                        angular.forEach(Object.keys(doc), function (key) {
                                            if (lunrSearch.getFields().indexOf(key) < 0) {
                                                lunrSearch.addField(key);
                                            }
                                        });


                                        doc.id = value.node.identifier;
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


                }
                ;


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

                    return this;
                },

                /**
                 * @param {scope} angular scope
                 * @returns {HybridsearchObject}
                 */
                setScope: function (scope) {
                    this.$$app.getResults().$$app.setScope(scope);
                    return this;
                },

                /**
                 * @param {string} scope variable name
                 * @param {scope} scope
                 * @example
                 *   .$bind(scopevar,scope);
                 *
                 * @returns {HybridsearchObject}
                 */
                $bind: function (scopevar, scope) {

                    this.$$app.getResults().$$app.setScope(scope);
                    scope[scopevar] = this.$$app.getResults();

                    return this;
                },

                /**
                 * @private
                 * run search and perform queries
                 * @returns  {HybridsearchObject}
                 */
                run: function () {

                    var self = this;


                    if (self.$$app.getHybridsearch().$$conf.branchInitialized === false) {

                        self.$$app.setIsRunning();

                        var counter = 0;
                        var branchInitInterval = setInterval(function () {
                            counter++;
                            if (counter > 100 || self.$$app.getHybridsearch().$$conf.branch.length > 1) {
                                clearInterval(branchInitInterval);
                                self.$$app.setHybridsearchInstanceNumber();
                                self.$$app.setFirstFilterHash(self.$$app.getFilter().getHash());
                                self.$$app.setSearchIndex();
                            }

                        }, 10);

                        self.$$app.getHybridsearch().$$conf.branchInitialized = true;


                    } else {

                        if (self.$$app.isRunning() === false) {

                            self.$$app.setHybridsearchInstanceNumber();
                            self.$$app.setFirstFilterHash(self.$$app.getFilter().getHash());
                            self.$$app.setIsRunning();
                            self.$$app.setSearchIndex();
                        }

                    }


                },


                /**
                 * @param {string} nodeType to search only for
                 * @param {scope} scope false if is simple string otherwise angular scope required for binding data
                 * @returns {HybridsearchObject}
                 */
                setNodeType: function (nodeType, scope) {

                    var self = this;

                    if (scope != undefined) {
                        self.$$app.getFilter().setScopeProperty(scope, nodeType, 'nodeType');
                        scope.$watch(nodeType, function (filterNodeInput) {
                            self.$$app.getFilter().setNodeType(filterNodeInput);
                            self.$$app.setSearchIndex();

                        }, true);

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
                 * @param boolean reverse (true if condition logic is reversed)
                 * @param boolean booleanmode (true if array values treated with OR conditions)
                 * @param nodeType nodeType (apply filter only to given nodeType)
                 * @returns {HybridsearchObject}
                 */
                addPropertyFilter: function (property, value, scope, reverse, booleanmode, nodeType) {

                    var self = this;
                    if (booleanmode === undefined) {
                        booleanmode = true;
                    }

                    if (scope != undefined) {
                        self.$$app.getFilter().setScopeProperty(scope, value, 'propertyFilters');
                        scope.$watch(value, function (v) {
                            self.$$app.getFilter().addPropertyFilter(property, v, booleanmode, reverse, nodeType);
                            self.$$app.setSearchIndex();
                        }, true);

                    } else {
                        self.$$app.getFilter().addPropertyFilter(property, value, booleanmode, reverse, nodeType);
                        self.$$app.setSearchIndex();
                    }

                    return this;

                },

                /**
                 * Adds nodes by identifier to search index
                 * @param {array} nodesArray
                 * @returns {HybridsearchObject}
                 */
                addNodesByIdentifier: function (nodesArray) {


                    var self = this;
                    var timer = false;

                    //self.$$app.addNodesByIdentifier(nodesArray);
                    self.$$app.setIsNodesByIdentifier();

                    angular.forEach(nodesArray, function (node) {

                        self.$$app.getIndexByNodeIdentifier(node).once("value", function (data) {

                            if (data.val()) {

                                if (self.$$app.isFiltered(data.val().node) === false) {

                                    self.$$app.addNodeByIdentifier(data.val());
                                    self.$$app.addLocalIndex([data.val()]);

                                    if (timer !== false) {
                                        clearTimeout(timer);
                                    }
                                    timer = setTimeout(function () {
                                        self.$$app.search();
                                    }, nodesArray.length > 50 ? 500 : 10);


                                    // wait for updates
                                    self.$$app.getIndexByNodeIdentifier(node).on("value", function (data) {
                                        if (data.val()) {
                                            self.$$app.addLocalIndex([data.val()]);
                                            self.$$app.search();
                                        }
                                    });
                                }

                            }


                        });


                    });

                    return this;

                },

                /**
                 * Adds nodes by node types to search index
                 * @param {array} nodesTypesArray
                 * @returns {HybridsearchObject}
                 */
                addNodesByNodeTypes: function (nodesTypesArray) {


                    var self = this;
                    var timer = false;

                    self.$$app.setIsNodesByIdentifier();

                    angular.forEach(nodesTypesArray, function (nodetype) {

                        self.$$app.getIndexByNodeType(nodetype).once("value", function (data) {

                            var addnodes = [];

                            if (data.val()) {

                                angular.forEach(data.val(), function (node) {
                                    addnodes.push(node);
                                });
                                self.$$app.addLocalIndex(addnodes);

                                if (timer !== false) {
                                    clearTimeout(timer);
                                }
                                timer = setTimeout(function () {
                                    self.$$app.search();
                                }, 50);
                            }

                        });


                    });

                    return this;

                },

                /**
                 * Adds a gender filter to the query. Show only nodes, that are visited mostly by given gender
                 * @param {string} gender male|female
                 * @param {scope} scope false if is simple string otherwise angular scope required for binding data
                 * @returns {HybridsearchObject}
                 */
                setGenderFilter: function (gender, scope) {

                    var self = this;

                    if (scope != undefined) {
                        self.$$app.getFilter().setScopeProperty(scope, input, 'genderFilter');
                        scope.$watch(gender, function (v) {
                            self.$$app.getFilter().setGenderFilter(v);
                            self.$$app.setSearchIndex();
                        }, true);

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
                setAgeFilter: function (age, scope) {

                    var self = this;

                    if (scope != undefined) {
                        self.$$app.getFilter().setScopeProperty(scope, age, 'ageFilter');
                        scope.$watch(age, function (v) {
                            self.$$app.getFilter().setAgeFilter(v);
                            self.$$app.setSearchIndex();
                        }, true);

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
                setNodePath: function (nodePath, scope) {

                    var self = this;

                    if (scope != undefined) {
                        self.$$app.getFilter().setScopeProperty(scope, nodePath, 'nodePath');
                        scope.$watch(nodePath, function (filterNodeInput) {
                            self.$$app.getFilter().setNodePath(filterNodeInput);
                            self.$$app.setSearchIndex();
                        }, true);

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
                setQuery: function (input, scope) {

                    var self = this;

                    if (scope) {
                        self.$$app.getFilter().setScopeProperty(scope, input, 'query');

                        scope['__query'] = input;

                        scope.$watch(input, function (searchInput, searchInputLast) {

                            if (scope["_hybridsearchSetQeuryInterval"] !== undefined) {
                                window.clearTimeout(scope["_hybridsearchSetQeuryInterval"]);
                            }

                            scope["_hybridsearchSetQeuryInterval"] = window.setTimeout(function () {
                                if (searchInput !== searchInputLast) {

                                    self.$$app.getFilter().setQuery(scope[input]);

                                    if (searchInput !== undefined) {
                                        if (searchInput.length === 0) {

                                            self.$$app.getFilter().resetQuery();
                                            self.$$app.setNodesLastHash(1);
                                            self.$$app.clearLocationHash();
                                        }

                                        self.$$app.setSearchIndex();

                                    }

                                }


                            }, 5);


                        });

                    } else {
                        if (input.length === 0) {
                            self.$$app.getFilter().resetQuery();
                        }
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
                 * Sets node type properties used for magic property search.
                 * @param {object} nodetypeproperties
                 * @example var nodetypeproperties = {
                 *        'nodeType': {'propertyname': {label: 'property label', 'description': 'property description'}
                 *    }
                 * @returns {$hybridsearchResultsObject|*}
                 */
                setNodeTypeProperties: function (nodetypeproperties) {
                    var self = this;
                    if (nodetypeproperties !== undefined) {
                        self.$$app.setNodeTypeProperties(nodetypeproperties);
                    }
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
                 * Sets parent node type boost.
                 * @param {object} ParentNodeTypeBoostFactor
                 * @example var ParentNodeTypeBoostFactor = {
                 *        'corporate-contact-collection': 1.5
                 *    }
                 * @returns {$hybridsearchResultsObject|*}
                 */
                setParentNodeTypeBoostFactor: function (ParentNodeTypeBoostFactor) {
                    var self = this;
                    self.$$app.setParentNodeTypeBoostFactor(ParentNodeTypeBoostFactor);
                    return this;
                },

                /**
                 * Sets groupedBy.
                 * @param {object} groupedBy
                 * @example var groupedBy = {
                 *        'nodeType': ['id'],
                 *        'nodeTypeLabel': ['name','lastname']
                 *    }
                 * @returns {$hybridsearchResultsObject|*}
                 */
                setGroupedBy: function (groupedBy) {
                    var self = this;
                    self.$$app.setGroupedBy(groupedBy);
                    return this;
                },

                /**
                 * Sets orderBy.
                 * @param {object} orderBy
                 * @example var orderBy = {
                 *        'nodeTypeLabel': ['name'],
                 *        'nodeType': ['name']
                 *    }
                 * @returns {$hybridsearchResultsObject|*}
                 */
                setOrderBy: function (orderBy) {
                    var self = this;
                    self.$$app.setOrderBy(orderBy);
                    return this;
                },

                /**
                 * Sets categorizedBy.
                 * @param {object} categorizedBy
                 * @example var categorizedBy = 'property-type'
                 * @returns {$hybridsearchResultsObject|*}
                 */
                setCategorizedBy: function (categorizedBy) {
                    var self = this;
                    self.$$app.setCategorizedBy(categorizedBy);
                    return this;
                },

                /**
                 * @param {string} add hidden keyword uses in search query.
                 * @param {scope} scope false if is simple string otherwise angular scope required for binding data
                 * @returns {HybridsearchObject}
                 */
                addAdditionalKeywords: function (input, scope) {

                    var self = this;

                    if (scope != undefined) {
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
    ])
    ;


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

                this.$$data = {
                    grouped: null
                };

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
                 * Get property of group.
                 * @returns {string} Group label
                 */
                getProperty: function (property) {
                    return this._nodes[0].getProperty(property);

                },

                /**
                 * Get all nodes for this group from current search result.
                 * @param {integer} limit max results
                 * @returns {array} collection of {HybridsearchResultsNode}
                 */
                getNodes: function (limit) {
                    return this._nodes !== undefined ? (limit === undefined ? this._nodes : this._nodes.slice(0, limit)) : [];
                },

                /**
                 * Get all nodes grouped by given facet.
                 * @param {categorizedBy} string
                 * @returns {array} collection of {HybridsearchResultsDataObject}
                 */
                getCategorizedNodes: function (categorizedBy,limit) {

                    var self = this;

                    if (self.$$data.grouped !== null) {
                        return self.$$data.grouped.getItems();
                    } else {
                        self.$$data.grouped = new HybridsearchResultsGroupObject();
                    }

                    var g = {};


                    angular.forEach(this._nodes, function (node) {
                        var p = node.getProperty(categorizedBy);
                        if (g[p] == undefined) {
                            g[p] = [];
                        }

                        g[p].push(node);


                    });

                    angular.forEach(g, function (v, k) {
                        self.$$data.grouped.addItem(k, v);
                    });


                    return self.$$data.grouped.getItems();


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
                var nodeTypeProperties = {};

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
                    groups: new HybridsearchResultsGroupObject(),
                    notfound: false,
                    searchCounter: 0,
                    quickinfo: false,
                };

                this.$$app = {

                    /**
                     * @private
                     * @param results
                     * @param nodes
                     */
                    setResults: function (results, nodes) {


                        this.clearResults();

                        self.$$data.nodes = nodes;


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

                        self.$$data.searchCounter++;

                        self.getApp().setNotFound(false);

                        this.executeCallbackMethod(self);

                        return self;

                    },
                    /**
                     * @private
                     */
                    clearResults: function () {
                        self.$$data.results = new HybridsearchResultsDataObject();
                        self.$$data.groups = new HybridsearchResultsGroupObject();
                        self.$$data.notfound = false;
                        self.$$data.quickinfo = false;
                    },
                    /**
                     * @param {boolean}
                     * @private
                     */
                    setNotFound: function (status) {

                        var selfthis = this;

                        self.$$data.notfound = status;


                        if (this.getScope() !== undefined) {
                            setTimeout(function () {
                                selfthis.getScope().$digest(function () {
                                });
                            }, 5);
                        }


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
                     * @returns {mixed}
                     */
                    getCallbackMethod: function () {
                        return this.callbackMethod;
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
                     * @param {scope} scope
                     * @returns {HybridsearchResultsObject}
                     */
                    setScope: function (scope) {
                        this.scope = scope;
                        return this;
                    },

                    /**
                     * @private
                     * @returns {HybridsearchResultsObject}
                     */
                    getScope: function () {
                        return this.scope;
                    },

                    /**
                     * @private
                     * @param obj
                     * @returns mixed
                     */
                    executeCallbackMethod: function (obj) {

                        var self = this;
                        if (self.getScope() !== undefined) {
                            setTimeout(function () {
                                self.getScope().$digest(function () {
                                });
                            }, 5);
                        }
                        this.callbackMethod(obj);
                    },
                    /**
                     * @private
                     * @returns mixed
                     */
                    getNodeTypeLabels: function () {
                        return nodeTypeLabels;
                    },
                    /**
                     * @private
                     * @returns mixed
                     */
                    getNodeTypeLabel: function (nodeType) {
                        return nodeTypeLabels[nodeType] !== undefined ? nodeTypeLabels[nodeType] : (nodeTypeLabels['*'] === undefined ? nodeType : nodeTypeLabels['*']);
                    },
                    /**
                     * @private
                     * @returns mixed
                     */
                    setNodeTypeLabels: function (labels) {
                        nodeTypeLabels = labels;
                    },
                    /**
                     * @private
                     * @returns mixed
                     */
                    setNodeTypeProperties: function (properties) {
                        nodeTypeProperties = properties;
                    },
                    /**
                     * @private
                     * @returns mixed
                     */
                    getNodeTypeProperties: function (nodeType) {

                        if (nodeType === undefined) {
                        } else {
                            return nodeTypeProperties[nodeType] !== undefined ? nodeTypeProperties[nodeType] : null;
                        }

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
                    return Sha1.hash(JSON.stringify(this.$$data.results));
                },
                /**
                 * Is search executed
                 * @returns {boolean} true if a search was executed
                 */
                isStarted: function () {
                    return this.$$data.searchCounter > 0 ? true : false
                },
                /**
                 * Is search executed
                 * @returns {boolean} true if a search was executed
                 */
                isLoading: function () {

                    if (this.$$data.searchCounter === 0) {
                        return true;
                    } else {
                        return this.$$data.notfound == true ? false : (this.countAll() > 0) ? false : true;
                    }

                },

                /**
                 * Get quick info of asked query
                 * @returns {array}
                 */
                getQuickInfo: function () {

                    var self = this;

                    if (self.$$data.quickinfo !== false) {
                        return self.$$data.quickinfo;
                    }

                    if (this.isLoading() === false && this.count() > 0) {

                        var topnode = this.getNodes(1)[0];
                        var s = this.$$app.getScope()[this.$$app.getScope()['__query']];
                        var properties = this.$$app.getNodeTypeProperties(topnode.getNodeType());


                        self.$$data.quickinfo = {
                            query: '',
                            items: [],
                            node: topnode
                        };

                        if (properties) {

                            var t = {};

                            angular.forEach(s.split(" "), function (term) {
                                term = term.toLowerCase();

                                if (term.length > 1) {

                                    angular.forEach(properties, function (val, key) {
                                        var v = " " + val.label + " " + val.description + " ";
                                        if (v.indexOf(term) >= 0) {
                                            var u = topnode.getProperty(key);
                                            if (typeof u == 'string' && u.length > 1 && t[val.label] === undefined) {
                                                self.$$data.quickinfo.items.push({term: val.label, value: u});
                                                t[val.label] = true;
                                            }
                                        }
                                    });

                                }


                            });
                        }

                        if (self.$$data.quickinfo.items.length === 0 && this.count() > 1) {

                            if (this.getNodes(2)[1].getNodeType() !== this.getNodes(1)[0].getNodeType()) {
                                if (typeof this.getNodes(1)[0].getProperty('image') == 'object') {
                                    self.$$data.quickinfo.items.push({term: '', value: ''});
                                }
                            }

                        }


                    }

                    return self.$$data.quickinfo;


                },
                /**
                 * Get number of search results.
                 * @returns {integer} Search results length.
                 */
                count: function () {
                    return !this.getNodes() ? 0 : Object.keys(this.$$app.getResultsData()._nodes).length;
                },
                /**
                 * Get number of search results including turbonodes.
                 * @returns {integer} Search results length.
                 */
                countAll: function () {
                    return this.count() + this.countTurboNodes();
                },
                /**
                 *
                 * Get number of turbo nodes
                 * @returns {integer} Search results length.
                 */
                countTurboNodes: function () {
                    return this.getTurboNodes() ? this.getTurboNodes().length : 0;
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
                 * @param {integer} limit max results
                 * @returns {array} collection of {HybridsearchResultsNode}
                 */
                getTurboNodes: function (limit) {
                    return this.getData()._nodesTurbo === undefined ? null : (limit === undefined ? this.getData()._nodesTurbo : this.getData()._nodesTurbo.slice(0, limit) );
                },

                /**
                 * Get all nodes from current search result.
                 * @param {integer} limit max results
                 * @returns {array} collection of {HybridsearchResultsNode}
                 */
                getNodes: function (limit) {
                    return this.getData()._nodes === undefined ? null : (limit === undefined ? this.getData()._nodes : this.getData()._nodes.slice(0, limit) );
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
                 * update distincts
                 * @returns {HybridsearchResultsObject}
                 */
                updateDistincts: function () {

                    var self = this;
                    this.clearDistincts();

                    angular.forEach(this.$$data.distincts, function (val, key) {
                        self.getDistinct(key);
                    });

                    return this;

                },
                /**
                 * clear distincts
                 * @returns {void}
                 */
                clearDistincts: function () {
                    this.$$data.distincts = {};
                },
                /**
                 * @private
                 * check if any distincts are ative
                 * @returns {boolean}
                 */
                hasDistincts: function () {
                    return this.$$data.distincts === undefined ? false : Object.keys(this.$$data.distincts).length ? true : false;
                },
                /**
                 * Get distinct count
                 * @param {string} property
                 * @returns {integer} count collection of property values
                 */
                getDistinctCount: function (property) {
                    return Object.keys(this.getDistinct(property)).length;
                },

                /**
                 * Get all different values from given property
                 * @param {string} property
                 * @param {boolean} counterGroupedByNode count existences grouped by node
                 * @returns {array} collection of property values
                 */
                getDistinct: function (property, counterGroupedByNode) {


                    if (counterGroupedByNode === undefined) {
                        counterGroupedByNode = true;
                    }


                    var self = this, variants = {}, variantsByNodes = {}, propvalue = '', variantsfinal = [];

                    if (self.$$data.distincts == undefined) {
                        self.$$data.distincts = {};
                    }

                    if (self.$$data.distincts[property] == undefined) {
                        self.$$data.distincts[property] = {};
                    }

                    if (Object.keys(self.$$data.distincts[property]).length) {
                        return self.$$data.distincts[property];
                    }

                    angular.forEach(this.getNodes(), function (node) {

                        variantsByNodes[node.identifier] = {};

                        propvalue = self.getPropertyFromNode(node, property);

                        if (typeof propvalue == 'object') {

                            angular.forEach(propvalue, function (v, k) {

                                if (v !== undefined) {
                                    var k = Sha1.hash(JSON.stringify(v));


                                    variants[k] = {
                                        value: v,
                                        count: variants[k] === undefined ? 1 : (!counterGroupedByNode || variantsByNodes[node.identifier][k] === undefined ? variants[k].count + 1 : variants[k].count)
                                    };

                                    variantsByNodes[node.identifier][k] = true;
                                }


                            });
                        } else {
                            if (propvalue !== undefined && propvalue.length) {


                                if (typeof propvalue === 'string' && ((propvalue.substr(0, 1) == '{') || ((propvalue.substr(0, 2) === '["' && propvalue.substr(-2, 2) === '"]')) || (propvalue.substr(0, 2) === '[{' && propvalue.substr(-2, 2) === '}]'))) {
                                    try {
                                        var valueJson = JSON.parse(propvalue);

                                    } catch (e) {
                                        valueJson = false;
                                    }

                                }

                                if (valueJson) {

                                    if (propvalue.substr(0, 1) == '{') {

                                        var k = Sha1.hash(JSON.stringify(valueJson));

                                        variants[k] = {
                                            value: valueJson,
                                            count: variants[k] === undefined ? 1 : (!counterGroupedByNode || variantsByNodes[node.identifier][k] === undefined ? variants[k].count + 1 : variants[k].count)
                                        };
                                        variantsByNodes[node.identifier][k] = true;


                                    } else {
                                        // treat variants as array
                                        angular.forEach(valueJson, function (variant) {
                                            var k = Sha1.hash(JSON.stringify(variant));

                                            variants[k] = {
                                                value: variant,
                                                count: variants[k] === undefined ? 1 : (!counterGroupedByNode || variantsByNodes[node.identifier][k] === undefined ? variants[k].count + 1 : variants[k].count)
                                            };
                                            variantsByNodes[node.identifier][k] = true;
                                        });
                                    }


                                } else {

                                    var k = Sha1.hash(JSON.stringify(propvalue));

                                    variants[k] = {
                                        value: propvalue,
                                        count: variants[k] === undefined ? 1 : (!counterGroupedByNode || variantsByNodes[node.identifier][k] === undefined ? variants[k].count + 1 : variants[k].count)
                                    };
                                    variantsByNodes[node.identifier][k] = true;

                                }


                            }


                        }


                    });


                    angular.forEach(variants, function (v, k) {


                        valueJson = false;


                        if (typeof v.value === 'string' && (((v.value.substr(0, 2) === '["' && v.value.substr(-2, 2) === '"]')) || (v.value.substr(0, 2) === '[{' && v.value.substr(-2, 2) === '}]'))) {
                            try {
                                var valueJson = JSON.parse(v.value);

                            } catch (e) {
                                valueJson = false;
                            }

                        }


                        if (valueJson) {

                            angular.forEach(valueJson, function (vs) {


                                if (vs.length > 0) {
                                    variants[property][k] = {value: vs, count: v.count};
                                }
                            });


                        }


                    });


                    self.$$data.distincts[property] = variants;

                    return self.$$data.distincts[property];


                },

                /**
                 * @private
                 * @param {object}
                 * @param {string} property
                 * @returns {mixed}
                 */
                getPropertyFromObject: function (object, property) {

                    return window.HybridsearchGetPropertyFromObject(object, property);


                },
                /**
                 * @private
                 * Get property.
                 * @param {string} property Get single property from node data.
                 * @returns {mixed}
                 */
                getPropertyFromNode: function (node, property) {

                    return window.HybridsearchGetPropertyFromNode(node, property);

                },

                /**
                 *
                 * Get alle nodes from current search result a grouped object.
                 * @returns {HybridsearchResultsGroupObject}
                 */
                getGrouped: function () {


                    var self = this;


                    if (self.$$data.groups.count() > 0) {
                        return self.$$data.groups;
                    }

                    angular.forEach(this.getData()._nodesByType, function (result, key) {

                        if (Object.keys(result).length > 1) {
                            self.$$data.groups.addItem(result.group, result);
                        }

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


            var defaultStopWords = [
                "a", "ab", "aber", "ach", "acht", "achte", "achten", "achter", "achtes", "ag", "alle", "allein", "allem", "allen", "aller", "allerdings", "alles", "allgemeinen", "als", "also", "am", "an", "andere", "anderen", "andern", "anders", "au", "auch", "auf", "aus", "ausser", "ausserdem", "außer", "außerdem", "b", "bald", "bei", "beide", "beiden", "beim", "beispiel", "bekannt", "bereits", "besonders", "besser", "besten", "bin", "bis", "bisher", "bist", "c", "d", "d.h", "da", "dabei", "dadurch", "dafür", "dagegen", "daher", "dahin", "dahinter", "damals", "damit", "danach", "daneben", "dank", "dann", "daran", "darauf", "daraus", "darf", "darfst", "darin", "darum", "darunter", "darüber", "das", "dasein", "daselbst", "dass", "dasselbe", "davon", "davor", "dazu", "dazwischen", "daß", "dein", "deine", "deinem", "deiner", "dem", "dementsprechend", "demgegenüber", "demgemäss", "demgemäß", "demselben", "demzufolge", "den", "denen", "denn", "denselben", "der", "deren", "derjenige", "derjenigen", "dermassen", "dermaßen", "derselbe", "derselben", "des", "deshalb", "desselben", "dessen", "deswegen", "dich", "die", "diejenige", "diejenigen", "dies", "diese", "dieselbe", "dieselben", "diesem", "diesen", "dieser", "dieses", "dir", "doch", "dort", "drei", "drin", "dritte", "dritten", "dritter", "drittes", "du", "durch", "durchaus", "durfte", "durften", "dürfen", "dürft", "e", "eben", "ebenso", "ehrlich", "ei", "ei,", "eigen", "eigene", "eigenen", "eigener", "eigenes", "ein", "einander", "eine", "einem", "einen", "einer", "eines", "einige", "einigen", "einiger", "einiges", "einmal", "eins", "elf", "en", "ende", "endlich", "entweder", "er", "erst", "erste", "ersten", "erster", "erstes", "es", "etwa", "etwas", "euch", "euer", "eure", "f", "folgende", "früher", "fünf", "fünfte", "fünften", "fünfter", "fünftes", "für", "g", "gab", "ganz", "ganze", "ganzen", "ganzer", "ganzes", "gar", "gedurft", "gegen", "gegenüber", "gehabt", "gehen", "geht", "gekannt", "gekonnt", "gemacht", "gemocht", "gemusst", "genug", "gerade", "gern", "gesagt", "geschweige", "gewesen", "gewollt", "geworden", "gibt", "ging", "gleich", "gott", "gross", "grosse", "grossen", "grosser", "grosses", "groß", "große", "großen", "großer", "großes", "gut", "gute", "guter", "gutes", "h", "habe", "haben", "habt", "hast", "hat", "hatte", "hatten", "hattest", "hattet", "heisst", "her", "heute", "hier", "hin", "hinter", "hoch", "hätte", "hätten", "i", "ich", "ihm", "ihn", "ihnen", "ihr", "ihre", "ihrem", "ihren", "ihrer", "ihres", "im", "immer", "in", "indem", "infolgedessen", "ins", "irgend", "ist", "j", "ja", "jahr", "jahre", "jahren", "je", "jede", "jedem", "jeden", "jeder", "jedermann", "jedermanns", "jedes", "jedoch", "jemand", "jemandem", "jemanden", "jene", "jenem", "jenen", "jener", "jenes", "jetzt", "k", "kam", "kann", "kannst", "kaum", "kein", "keine", "keinem", "keinen", "keiner", "kleine", "kleinen", "kleiner", "kleines", "kommen", "kommt", "konnte", "konnten", "kurz", "können", "könnt", "könnte", "l", "lang", "lange", "leicht", "leide", "lieber", "los", "m", "machen", "macht", "machte", "mag", "magst", "mahn", "mal", "man", "manche", "manchem", "manchen", "mancher", "manches", "mann", "mehr", "mein", "meine", "meinem", "meinen", "meiner", "meines", "mich", "mir", "mit", "mittel", "mochte", "mochten", "morgen", "muss", "musst", "musste", "mussten", "muß", "mußt", "möchte", "mögen", "möglich", "mögt", "müssen", "müsst", "müßt", "n", "na", "nach", "nachdem", "nahm", "natürlich", "neben", "nein", "neue", "neuen", "neun", "neunte", "neunten", "neunter", "neuntes", "nicht", "nichts", "nie", "niemand", "niemandem", "niemanden", "noch", "nun", "nur", "o", "ob", "oben", "oder", "offen", "oft", "ohne", "p", "q", "r", "recht", "rechte", "rechten", "rechter", "rechtes", "richtig", "rund", "s", "sa", "sache", "sagt", "sagte", "sah", "satt", "schlecht", "schon", "sechs", "sechste", "sechsten", "sechster", "sechstes", "sehr", "sei", "seid", "seien", "sein", "seine", "seinem", "seinen", "seiner", "seines", "seit", "seitdem", "selbst", "sich", "sie", "sieben", "siebente", "siebenten", "siebenter", "siebentes", "sind", "so", "solang", "solche", "solchem", "solchen", "solcher", "solches", "soll", "sollen", "sollst", "sollt", "sollte", "sollten", "sondern", "sonst", "soweit", "sowie", "später", "startseite", "statt", "steht", "suche", "t", "tag", "tage", "tagen", "tat", "teil", "tel", "tritt", "trotzdem", "tun", "u", "uhr", "um", "und", "und?", "uns", "unser", "unsere", "unserer", "unter", "v", "vergangenen", "viel", "viele", "vielem", "vielen", "vielleicht", "vier", "vierte", "vierten", "vierter", "viertes", "vom", "von", "vor", "w", "wahr", "wann", "war", "waren", "wart", "warum", "was", "wegen", "weil", "weit", "weiter", "weitere", "weiteren", "weiteres", "welche", "welchem", "welchen", "welcher", "welches", "wem", "wen", "wenig", "wenige", "weniger", "weniges", "wenigstens", "wenn", "wer", "werde", "werden", "werdet", "weshalb", "wessen", "wie", "wieder", "wieso", "will", "willst", "wir", "wird", "wirklich", "wirst", "wissen", "wo", "wohl", "wollen", "wollt", "wollte", "wollten", "worden", "wurde", "wurden", "während", "währenddem", "währenddessen", "wäre", "würde", "würden", "x", "y", "z", "z.b", "zehn", "zehnte", "zehnten", "zehnter", "zehntes", "zeit", "zu", "zuerst", "zugleich", "zum", "zunächst", "zur", "zurück", "zusammen", "zwanzig", "zwar", "zwei", "zweite", "zweiten", "zweiter", "zweites", "zwischen", "zwölf", "über", "überhaupt", "übrigens"
            ];


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
                    hash.push(this.$$data.propertyFilter);

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
                 * @param scope scope
                 * @param {string} property
                 * @param {string} identifier
                 * @returns HybridsearchObject
                 */
                setScopeProperty: function (scope, property, identifier) {

                    if (this.$$data.scopes == undefined) {
                        this.$$data.scopes = {};
                    }
                    if (this.$$data.scopeProperties == undefined) {
                        this.$$data.scopeProperties = {};
                    }

                    this.$$data.scopes[identifier] = scope;
                    if (this.$$data.scopeProperties[identifier] === undefined) {
                        this.$$data.scopeProperties[identifier] = {};
                    }

                    this.$$data.scopeProperties[identifier][property] = identifier;

                    return this;
                },
                /**
                 * @param string identifier
                 * @returns mixed
                 */
                getScopeProperties: function () {
                    return this.$$data.scopeProperties;

                },

                /**
                 * @param string identifier
                 * @returns scope
                 */
                getScopeByIdentifier: function (identifier) {

                    return this.$$data.scopes[identifier];
                },


                /**
                 * @private
                 * @returns HybridsearchObject
                 */
                resetQuery: function () {

                    this.$$data.hasquery = false;
                    this.$$data.autocompletedKeywords = '';
                    this.$$data.query = '';
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
                 * @param boolean booleanmode (true if array values treated with OR conditions)
                 * @param boolean reverse (true if condition logic is reversed)
                 * @param nodeType nodeType (apply filter only to given nodeType)
                 * @returns HybridsearchObject
                 */
                addPropertyFilter: function (property, value, booleanmode, reverse, nodeType) {


                    if (booleanmode === undefined) {
                        booleanmode = true;
                    }

                    if (this.$$data.propertyFilter == undefined) {
                        this.$$data.propertyFilter = {};
                    }

                    if (value !== undefined && value !== null && typeof value === 'object' && (value.length === 0 || Object.keys(value).length === 0)) {
                        if (this.$$data.propertyFilter[property] !== undefined) {
                            delete this.$$data.propertyFilter[property];
                        }
                        return this;
                    }

                    if (value == undefined || value == null) {
                        return this;
                    }


                    this.$$data.propertyFilter[property] = {
                        value: value,
                        booleanmode: booleanmode,
                        reverse: reverse == undefined ? false : reverse,
                        nodeType: nodeType
                    };
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

                    var propertyfilters = this.$$data.propertyFilter === undefined ? {} : this.$$data.propertyFilter;

                    angular.forEach(propertyfilters, function (propertyfilter, property) {

                        angular.forEach(propertyfilter.value, function (value, key) {

                            if (value === false) {
                                delete propertyfilters[property].value[key];
                            }


                        });


                    });

                    return propertyfilters;
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
                 * @private
                 * @param string keyword
                 * @returns boolean
                 */
                isBlockedKeyword: function (keyword) {

                    if (defaultStopWords.indexOf(keyword) >= 0) {
                        return true;
                    }

                    return false;
                },

                /**
                 * @param string property
                 * @returns mixed
                 */
                getGa: function (property) {
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


                    if (this.getQuery() == '' && this.getAutocompletedKeywords() === undefined) {
                        return false;
                    }

                    var q = this.$$data.magickeywords + "  " + this.getAutocompletedKeywords() + "  " + this.getAdditionalKeywords();


                    return q.length - (q.match(/ /g) || []).length > 1 ? q : false;

                },

                /**
                 * @private
                 * @param string keyword
                 * @returns boolean
                 */
                isInQuery: function (keyword) {

                    if (this.getFullSearchQuery() === false) {
                        return false;
                    }

                    return this.getFullSearchQuery().indexOf(" " + keyword + " ") < 0 ? false : true;


                },

                /**
                 * @returns string
                 */
                getFinalSearchQuery: function (lastSearchInstance, ignoredtermsstring) {


                    // restrict search query to current request
                    var d = new Date();
                    var self = this;

                    // get unique
                    var uniqueobject = {};
                    var uniquarray = [];

                    if (lastSearchInstance.$$data !== undefined) {
                        var term = lastSearchInstance.$$data.keywords.join(" ");
                        var terms = term.split(" ");

                        angular.forEach(terms, function (keyword) {

                            if (uniqueobject[keyword] === undefined && self.isBlockedKeyword(keyword) === false && (ignoredtermsstring == undefined || ignoredtermsstring.indexOf(keyword) === -1)) {
                                uniquarray.push(keyword);
                            }
                            uniqueobject[keyword] = true;

                        });

                    } else {
                        return self.getQuery().length ? self.getQuery() : false;

                    }


                    return uniquarray.join(" ");


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

                    var t = s.replace(/([0-9-])( )/i, '$1').replace(/([0-9]{2})/gi, '$1 ');

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


                        angular.forEach(self.getMagicReplacements(term), function (a, t) {
                            if (t.length > 1) {
                                magickeywords.push(t);
                            }
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

                    return magicreplacements;


                    if (string.length > 12) {
                        // double consonants
                        var d = string.replace(/([bcdfghjklmnpqrstvwxyz])\1+/, "$1");

                        magicreplacements[d.replace(/(.*)([bcdfghjklmnpqrstvwxyz])([^bcdfghjklmnpqrstvwxyz]*)/, "$1$2$2$3").replace(/([bcdfghjklmnpqrstvwxyz])\3+/, "$1$1")] = true;
                        magicreplacements[d.replace(/(.*)([bcdfghjklmnpqrstvwxyz])([^bcdfghjklmnpqrstvwxyz]*)([bcdfghjklmnpqrstvwxyz])([^bcdfghjklmnpqrstvwxyz]*)/, "$1$2$2$3$4$4$5").replace(/([bcdfghjklmnpqrstvwxyz])\3+/, "$1$1")] = true;

                        // common typo errors
                        magicreplacements[d.replace(/th/, "t")] = true;
                        magicreplacements[d.replace(/t/, "th")] = true;

                        magicreplacements[d.replace(/üe/, "ü")] = true;
                        magicreplacements[d.replace(/ü/, "üe")] = true;

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
                        magicreplacements[d.replace(/(.*)v(.*)/, "$1w$2")] = true;
                        magicreplacements[d.replace(/(.*)w(.*)/, "$1v$2")] = true;


                    }


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