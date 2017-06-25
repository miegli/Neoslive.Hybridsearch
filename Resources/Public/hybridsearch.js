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

    angular.module("hybridsearch.common", []);
    angular.module("hybridsearch.results", []);
    angular.module("hybridsearch.filter", []);
    angular.module("hybridsearch", []);

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
    angular.module('hybridsearch').factory('$hybridsearch', ['$hybridsearchObject', '$cookies',

        function ($hybridsearchObject, $cookies) {

            /**
             * @class Hybridsearch
             * @param databaseURL {string} databaseURL, google firebase realtime database endpoint
             * @param workspace {string} workspace, identifier of the workspace to use from indexed datebase
             * @param dimension {string} dimension, hash of the dimension configuration to use form indexed database
             * @param site {string} site identifier (uuid)
             * @param cdnDatabaseURL {string} cdnDatabaseURL for json requests
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
            function Hybridsearch(databaseURL, workspace, dimension, site, cdnDatabaseURL, cdnStaticURL, debug) {


                if (!(this instanceof Hybridsearch)) {
                    return new Hybridsearch();
                }


                this.$$conf = {
                    workspace: workspace,
                    dimension: dimension,
                    site: site,
                    branch: '',
                    databaseURL: databaseURL,
                    cdnDatabaseURL: cdnDatabaseURL,
                    cdnStaticURL: cdnStaticURL,
                    branchInitialized: false
                };


                Object.defineProperty(this, '$$conf', {
                    value: this.$$conf
                });


                // Initialize the Firebase SDK
                var firebaseconfig = {
                    databaseURL: databaseURL
                };


                if (window.hybridsearchInstancesApp == undefined) {
                    window.hybridsearchInstancesApp = 0;
                }

                window.hybridsearchInstancesApp++;

                firebase.initializeApp(firebaseconfig, "instance" + window.hybridsearchInstancesApp);
                this.$$conf.firebase = firebase.app("instance" + window.hybridsearchInstancesApp);
                if (debug == true) {
                    firebase.database.enableLogging(true);
                }

            }

            Hybridsearch.prototype = {

                /**
                 * @private
                 * @returns Firebase App
                 */
                $firebase: function () {

                    if (this.$$conf.firebase !== undefined) {
                        return this.$$conf.firebase;
                    }

                },

                /**
                 * @private
                 * @returns Firebase App
                 */
                setBranch: function (branch) {
                    this.$$conf.branch = branch;

                },

                /**
                 * @private
                 * @returns Firebase App
                 */
                getBranch: function () {

                    if (this.$$conf.branch === undefined || this.$$conf.branch == null) {
                        this.$$conf.branch = 'master';
                        return 'master';
                    }
                    return this.$$conf.branch.length > 1 ? this.$$conf.branch : false;
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
    angular.module('hybridsearch.common').factory('$hybridsearchObject', ['$hybridsearchResultsObject', '$hybridsearchFilterObject', '$http', '$q', '$location', '$filter', '$sce', '$window',

        /**
         * @private
         * @param firebaseObject
         * @param $hybridsearchResultsObject
         * @param $hybridsearchFilterObject
         * @returns {HybridsearchObject}
         */
            function ($hybridsearchResultsObject, $hybridsearchFilterObject, $http, $q, $location, $filter, $sce, $window) {

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

                var hybridsearchInstanceNumber, pendingRequests, logStoreApplied, results, filter, index, lunrSearch,
                    nodesIndexed, nodesLastCount, nodes, nodesLastHash, nodeTypeLabels, resultGroupedBy,
                    resultCategorizedBy,
                    resultOrderBy, propertiesBoost, ParentNodeTypeBoostFactor, NodeUrlBoostFactor, isRunning,
                    firstfilterhash,
                    searchInstancesInterval, lastSearchInstance, lastIndexHash, indexInterval, isNodesByIdentifier,
                    nodesByIdentifier, searchCounter, searchCounterTimeout, nodeTypeProperties, isloadedall,
                    externalSources, isLoadedFromLocalStorage, lastSearchHash, lastSearchApplyTimeout, config,
                    getKeywordsTimeout, getIndexTimeout, setIndexTimeout, staticCachedNodes;

                var self = this;

                // count instances
                if (window.hybridsearchInstances === undefined) {
                    window.hybridsearchInstances = 1;
                } else {
                    window.hybridsearchInstances++;
                }

                staticCachedNodes = {};
                isloadedall = {};
                config = {};
                nodesLastCount = 0;
                isLoadedFromLocalStorage = false;
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
                externalSources = {};
                nodeTypeProperties = {};
                nodes = {};
                nodesIndexed = {};
                logStoreApplied = {};
                index = {};
                pendingRequests = [];
                resultGroupedBy = {};
                resultOrderBy = {};
                getKeywordsTimeout = null;
                getIndexTimeout = null;
                setIndexTimeout = null;
                lastSearchHash = null;
                lastSearchApplyTimeout = null;
                resultCategorizedBy = 'nodeType';
                lunrSearch = elasticlunr(function () {
                    this.setRef('id');
                });


                /**
                 * @private
                 * global function get property from object
                 */
                window.HybridsearchGetPropertyFromObject = function (inputObject, property) {

                    if (inputObject == undefined) {
                        return null;
                    }

                    if (property.indexOf("(") > 0) {
                        if (typeof inputObject['__proto__'][property.substr(0, property.indexOf("("))] == 'function') {
                            try {
                                var v = eval("inputObject." + property);
                            } catch (e) {
                                v = null;
                            }
                            return v;
                        }
                    }


                    if (property === '*') {

                        var values = [];

                        angular.forEach(inputObject, function (val, key) {
                            angular.forEach(val, function (v) {
                                values.push(v);
                            });
                        });

                        return values;
                    }

                    var values = [];


                    if (inputObject[property] !== undefined) {
                        return inputObject[property];
                    }


                    angular.forEach(inputObject, function (val, key) {


                        if (val !== null) {

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
                                        values = inputObject[property];
                                        return values;
                                    } else {
                                        values = inputObject[key];
                                        return values;
                                    }

                                }

                            }


                            if (typeof val === 'object') {


                                if (val[property] !== undefined) {
                                    values.push(val[property]);
                                } else {
                                    values = [];
                                    angular.forEach(val, function (v, k) {
                                        if (values.length == 0 && typeof k == 'string' && (k.substr(k.length - property.length, property.length) === property || k == property)) {
                                            values.push(val[k]);
                                            return values;
                                        }

                                    });

                                }
                            }

                        } else {
                            return null;
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

                    if (property == undefined) {
                        return null;
                    }

                    if (typeof property == 'function') {
                        return property(node);
                    }

                    if (property === '_document') {
                        return node.grandParentNode;
                    }

                    if (property === '__index') {
                        return node['__index'];
                    }

                    if (node.properties === undefined) {

                        return null;
                    }

                    if (node.properties[property] !== undefined) {

                        return node.properties[property];
                    }


                    if (property === 'identifier') {
                        return node.identifier;
                    }

                    if (property === 'lastmodified') {
                        return node.lastmodified;
                    }


                    // handles value as json parsable object if required
                    if (property.indexOf(".") >= 0) {

                        var propertysegments = property.split(".");

                        var value = null;


                        angular.forEach(propertysegments, function (segment, c) {


                            if (c == 0) {
                                value = window.HybridsearchGetPropertyFromNode(node, segment);
                            } else {

                                if (typeof value === 'string' && ((value.substr(0, 1) === '{') || ((value.substr(0, 2) === '["' && value.substr(-2, 2) === '"]')) || (value.substr(0, 2) === '[{' && value.substr(-2, 2) === '}]'))) {
                                    try {
                                        var valueJson = JSON.parse(value);
                                    } catch (e) {
                                        valueJson = false;
                                    }

                                    if (valueJson) {
                                        value = valueJson;
                                    }
                                }

                                if (segment === '*') {
                                    var valuetmp = [];
                                    angular.forEach(value, function (v) {

                                        if (typeof v !== 'object') {
                                            valuetmp.push(v);
                                        } else {
                                            angular.forEach(v, function (vv) {
                                                valuetmp.push(vv);
                                            });
                                        }

                                    });
                                    value = valuetmp;

                                } else {

                                    value = window.HybridsearchGetPropertyFromObject(value, segment);

                                }

                            }


                        });


                        return value;


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

                    angular.forEach(self.properties, function (val, key) {

                        if (val !== null && typeof val == 'object' && val.properties !== undefined && val.nodeType !== undefined && val.identifier !== undefined) {
                            self.properties[key] = new HybridsearchResultsNode(val);
                        }
                    });

                    self.score = score;
                    self.groupedNodes = [];
                    self.grouped = false;

                    if (self.properties == undefined) {
                        self.properties = {};
                    }

                    if (self.url !== undefined) {
                        self.properties.url = self.url;
                    }
                    if (self.uri !== undefined) {
                        self.properties.uri = self.uri;
                    }

                    if (self.lastmodified !== undefined && nodeData.lastmodified !== undefined) {
                        self.properties.lastmodified = nodeData.lastmodified;
                    }

                    if (self.created !== undefined && nodeData.created !== undefined) {
                        self.properties.created = nodeData.created;
                    }

                    self.groupedNodesByNodeType = {};


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
                     * @private
                     * @param {HybridsearchResultsNode} node
                     * @param {string} groupedBy
                     * @returns {object}
                     */
                    addGroupedByNodeType: function (node, groupedBy) {


                        if (this.groupedNodesByNodeType[groupedBy] == undefined) {
                            this.groupedNodesByNodeType[groupedBy] = {};
                        }

                        if (this.groupedNodesByNodeType[groupedBy][node.nodeType] == undefined) {
                            this.groupedNodesByNodeType[groupedBy][node.nodeType] = [];
                        }

                        this.groupedNodesByNodeType[groupedBy][node.nodeType].push(node);


                    },

                    /**
                     * @private
                     * @returns {object}
                     */
                    clearGroupedByNodeType: function () {

                        this.groupedNodesByNodeType = {};
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
                     * @param {string} groupedBy
                     * @returns {array}
                     */
                    getGroupedByNodeType: function (groupedBy) {
                        var ghash = Sha1.hash(groupedBy);
                        return this.groupedNodesByNodeType[ghash];
                    },

                    /**
                     * @public
                     * @param {string} groupedBy
                     * @returns {array}
                     */
                    countGroupedByNodeType: function (groupedBy) {
                        var ghash = Sha1.hash(groupedBy);
                        if (this.groupedNodesByNodeType[ghash] == undefined) {
                            return 0;
                        }
                        return Object.keys(this.groupedNodesByNodeType[ghash]).length;
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

                        if (typeof property == 'string' && property.indexOf(".") >= 0) {
                            this.properties[propertyfullname] = this.getPropertyFromNode(this, property);
                            return this.properties[propertyfullname];

                        }

                        if (typeof property == 'function') {
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
                     * @param boolean absolute
                     * @returns {string}
                     */
                    getUrl: function (absolute) {

                        if (absolute == undefined) {
                            absolute = false;
                        }

                        if (this.url === undefined) {
                            return '';
                        }

                        // is neos backend
                        if (window.location.pathname.indexOf("@user-") > -1) {
                            var url = this.url.substr(0, this.url.lastIndexOf(".")) + window.location.pathname.substr(window.location.pathname.indexOf("@user-"));
                            if (url.substr(-5) !== '.html') {
                                url = url + ".html";
                            }
                            if (url.substr(0, 4) == 'http') {
                                return url.substr(url.substr(10).indexOf("/") + 10);
                            }
                            return (absolute ? window.location.origin : '') + url;
                        } else {
                            // front end
                            if (typeof this.url == 'string' && this.url.substr(0, 4) == 'http') {
                                return this.url;
                            }
                            return (absolute ? window.location.origin : '') + this.url;
                        }


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
                     * @param string property
                     * @param delimiter
                     * @returns {string}
                     */
                    getPreview: function (property, maxlength, delimiter) {

                        if (maxlength === undefined || !maxlength) {
                            maxlength = 512;
                        }
                        var preview = '';
                        if (property == undefined) {
                            preview = this.rawcontent === undefined ? '' : this.rawcontent;
                        } else {
                            preview = this.getProperty(property);
                        }

                        preview = preview.trim().replace(/<\/?[a-z][a-z0-9]*[^<>]*>/ig, " ").replace(/\t/g, delimiter === undefined ? " ... " : delimiter);

                        if (preview.length > maxlength && maxlength > 0) {
                            var point = preview.indexOf(".");
                            if (point) {
                                if (point < preview.length / 3 * 2) {
                                    maxlength = point + 1;
                                }
                            }
                        }

                        return maxlength > 0 ? preview.substr(0, maxlength) : preview;
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

                        if (this._parentNode == undefined) {
                            if (this.parentNode) {
                                this._parentNode = new HybridsearchResultsNode(this.parentNode);
                            } else {
                                this._parentNode = null;
                            }
                        }


                        return this._parentNode;
                    },

                    /**
                     * Nearest Document node.
                     * @returns {HybridsearchResultsNode}
                     */
                    getDocumentNode: function () {


                        if (this._grandParentNode == undefined) {
                            if (this.grandParentNode) {
                                this._grandParentNode = new HybridsearchResultsNode(this.grandParentNode);
                            } else {
                                this._grandParentNode = null;
                            }
                        }


                        return this._grandParentNode;

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
                     * @param boost
                     */
                    getSearchObject: function () {
                        return self;
                    },
                    /**
                     * @private
                     * @param request
                     * @return void
                     */
                    addPendingRequest: function (request) {


                    },
                    /**
                     * @private
                     * @return void
                     */
                    cancelAllPendingRequest: function () {

                        angular.forEach($http.pendingRequests, function (request) {
                            if (request.cancel) {
                                request.cancel(request);
                            }
                            if (request.timeoutRef !== undefined) {
                                clearTimeout(request.timeoutRef);
                            }
                        });
                        pendingRequests = [];

                    },
                    /**
                     * @private
                     * @return void
                     */
                    hasPendingRequests: function () {

                        return pendingRequests.length ? true : false;

                    },
                    /**
                     * @private
                     * @return void
                     */
                    setHybridsearchInstanceNumber: function (id) {
                        if (id == undefined) {
                            hybridsearchInstanceNumber = window.hybridsearchInstances;
                        } else {
                            hybridsearchInstanceNumber = id;
                        }
                        return this.getHybridsearchInstanceNumber();
                    },

                    /**
                     * @private
                     * @param string key
                     * @return mixed
                     */
                    getConfig: function (key) {
                        return config[key] !== undefined ? config[key] : null;
                    },

                    /**
                     * @private
                     * @param string key
                     * @param string value
                     * @return mixed
                     */
                    setConfig: function (key, value) {
                        config[key] = value;
                        return value;
                    },
                    /**
                     * @private
                     * @return integer instance number
                     */
                    getHybridsearchInstanceNumber: function () {
                        return hybridsearchInstanceNumber;
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

                        if (hybridsearch.$$conf.databaseURL.length == 0) {
                            isRunning = false;
                            return false;
                        }

                        if (hybridsearch.$$conf.branchisloading === undefined) {

                            hybridsearch.$$conf.branchisloading = true;

                            if (!hybridsearch.getBranch()) {

                                /**
                                 * watch branch
                                 */
                                var query = hybridsearch.$firebase().database().ref("branches/" + hybridsearch.$$conf.workspace);
                                query.on("value", function (snapshot) {
                                    hybridsearch.setBranch(snapshot.val());
                                    isRunning = true;
                                });

                            } else {
                                isRunning = true;
                            }
                        } else {
                            isRunning = true;
                        }

                    },
                    /**
                     * @private
                     */
                    setIsLoadedAll: function (hash) {
                        isloadedall[hash] = true;
                    },
                    /**
                     * @private
                     */
                    setIsNotLoadedAll: function (hash) {
                        try {
                            delete isloadedall[hash];
                        } catch (e) {
                            // skip
                        }
                    },
                    /**
                     * @private
                     */
                    clearIsLoadedAll: function () {
                        isloadedall = {};
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
                    addNodeByIdentifier: function (node, index) {
                        if (index !== undefined && index >= 0) {
                            node.node['__index'] = index;
                        }
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
                    isLoadedFromLocalStorage: function () {
                        return isLoadedFromLocalStorage;
                    },
                    /**
                     * @private
                     * @param boolean value
                     * @returns {boolean}
                     */
                    setLoadedFromLocalStorage: function (value) {
                        isLoadedFromLocalStorage = value;
                    },
                    /**
                     * @private
                     * @returns {boolean}
                     */
                    isLoadedAll: function (hash) {


                        if (hash == undefined) {


                            var found = 0;
                            var self = this;


                            angular.forEach(isloadedall, function (v, key) {

                                if (typeof self.getFilter().getNodeType() == 'string') {
                                    if (key.indexOf(self.getFilter().getNodeType()) >= 0) {
                                        found = 1;
                                    }
                                } else {
                                    angular.forEach(self.getFilter().getNodeType(), function (val) {
                                        if (key.indexOf(val) >= 0) {
                                            found++;
                                        }
                                    });
                                }

                            });

                            if (self.getFilter().getNodeType() == 'string' && found == 1) {
                                return true
                            } else {
                                if (self.getFilter().getNodeType().length == found) {
                                    return true;
                                }
                            }

                            return false;

                        }

                        return isloadedall[hash] == undefined ? false : isloadedall[hash];

                    },
                    /**
                     * @private
                     * @returns {boolean}
                     */
                    countIsLoadedAll: function () {
                        return isloadedallCount;
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
                     * @returns {{}|*}
                     */
                    getExternalSources: function () {
                        return Object.keys(externalSources).length ? externalSources : null;
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
                     * @param nodetype
                     * @returns {number}
                     */
                    getBoost: function (property, nodetype) {

                        var p = property;

                        if (propertiesBoost !== undefined && propertiesBoost[property] == undefined && property.indexOf(".") > -1) {
                            property = property.substr(0, property.indexOf("."));
                            if (property == '') {
                                return 1;
                            }

                        }

                        if (nodetype !== undefined && nodetype.length > property.length) {
                            property = nodetype + "-" + property;
                        }

                        return propertiesBoost !== undefined && propertiesBoost[property] !== undefined ? propertiesBoost[property] : property == 'breadcrumb' ? 50 : property.substr(-28) == 'neoslivehybridsearchkeywords' ? 500 : 10;


                    },

                    /**
                     * html parser
                     * @returns array node data
                     */
                    parseHtml: function (html, config) {

                        var items = {};


                        jQuery(html).find(config.results.selector).each(function (i) {

                            var properties = {};
                            var html = jQuery(this);
                            var id = Guid.create();
                            id = id.value;

                            angular.forEach(config.fields, function (fieldconfig, field) {


                                if (fieldconfig.attribute !== undefined) {
                                    properties[field] = html.find(fieldconfig.selector).attr(fieldconfig.attribute);
                                } else {
                                    properties[field] = html.find(fieldconfig.selector).html();
                                }

                                if (fieldconfig.prepend !== undefined) {
                                    properties[field] = fieldconfig.prepend + properties[field];
                                }

                                if (properties[field] === undefined) {
                                    properties[field] = '';
                                }


                            });


                            items[id] = {
                                node: {
                                    properties: properties,
                                    grandParentNode: {
                                        identifier: id,
                                        nodeType: config.nodeType,
                                        properties: properties
                                    },
                                    nodeType: config.nodeType,
                                    turbonode: false,
                                    identifier: id,
                                    hash: id,
                                    url: properties['url'] !== undefined ? properties['url'] : null
                                },
                                nodeType: config.nodeType
                            };


                        });


                        return items;

                    },

                    /**
                     * html parser
                     * @returns array node data
                     */
                    parseXml: function (xml, config) {
                        var x2js = new X2JS();
                        var jsonObj = x2js.xml_str2json(xml);
                        return this.parseJson(jsonObj, config);
                    },

                    /**
                     * html parser
                     * @returns array node data
                     */
                    parseJson: function (json, config) {


                        var items = {}, selector = [];
                        if (config.results !== undefined && config.results.selector !== undefined) {
                            eval("selector = json." + config.results.selector);
                        } else {
                            selector = json;
                        }

                        angular.forEach(selector, function (i) {

                            var properties = {};

                            var id = Guid.create();
                            id = id.value;


                            angular.forEach(config.fields, function (fieldconfig, field) {
                                properties[field] = i[fieldconfig];

                                if (typeof properties[field] == 'object' && properties[field].toString !== undefined) {
                                    properties[field] = properties[field].toString();
                                }

                                if (typeof properties[field] == 'string' && field.toLowerCase().indexOf('date') >= 0 && properties[field].length < 64 && Date.parse(properties[field])) {
                                    properties[field] = new Date(properties[field]);
                                }

                            });

                            items[id] = {
                                node: {
                                    properties: properties,
                                    grandParentNode: {
                                        identifier: id,
                                        nodeType: config.nodeType,
                                        properties: properties
                                    },
                                    nodeType: config.nodeType,
                                    turbonode: false,
                                    hash: id,
                                    identifier: id,
                                    url: properties['url'] !== undefined ? properties['url'] : null
                                },
                                nodeType: config.nodeType
                            };


                        });

                        return items;

                    },

                    /**
                     * @private
                     * @param {node}
                     * @returns {number}
                     */
                    getParentNodeTypeBoostFactor: function (node) {

                        if (node.parentNode != undefined && ParentNodeTypeBoostFactor !== undefined) {
                            if (ParentNodeTypeBoostFactor[node.parentNode.nodeType] != undefined) {
                                return ParentNodeTypeBoostFactor[node.parentNode.nodeType];
                            }
                        }

                        return 1;

                    },

                    /**
                     * @private
                     * @param {node}
                     * @returns {number}
                     */
                    getNodeUrlBoostFactor: function (node) {

                        var b = 1;

                        if (NodeUrlBoostFactor !== undefined) {

                            angular.forEach(NodeUrlBoostFactor, function (boost, needed) {

                                if (b == 1 && node.url.indexOf(needed) >= 0) {
                                    b = boost;
                                    return b;
                                }
                            });

                        }

                        return b;

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

                        if (order.length === 0 && resultOrderBy['*'] !== undefined) {
                            order = resultOrderBy['*'];
                        }

                        if (typeof order === 'string' || typeof order === 'function') {
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
                     * @param labels
                     */
                    setExternalSources: function (externalsources) {
                        externalSources = externalsources;
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
                    setNodeUrlBoostFactor: function (boost) {

                        var ordered = {};
                        var orderedBoost = {};

                        angular.forEach(boost, function (val, key) {
                            if (ordered[key.length] == undefined) {
                                ordered[key.length] = {}
                            }
                            ordered[key.length][key] = val;
                        });

                        var r = Object.keys(ordered).reverse();

                        angular.forEach(r, function (v, k) {
                            angular.forEach(ordered[v], function (val, key) {
                                orderedBoost[key] = val;
                            });
                        });

                        NodeUrlBoostFactor = orderedBoost;

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
                                                }, 1);
                                            }
                                        });
                                        break;

                                    case 'query':
                                        if (self.getFilter().getScopeProperties()[identifier] !== undefined) {
                                            self.getFilter().getScopeByIdentifier(identifier)[Object.keys(self.getFilter().getScopeProperties()[identifier])[0]] = filter;
                                            setTimeout(function () {
                                                self.getFilter().getScopeByIdentifier(identifier).$apply(function () {
                                                });
                                            }, 1);
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
                                        }, 1);
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
                     * @params string identifier
                     * @params boolean apply scope vars or not
                     * @returns mixed
                     */
                    sortNodes: function (preOrdered) {

                        var self = this;

                        if (self.hasOrderBy() === false) {
                            return preOrdered;
                        }

                        var orderingkeys = [];
                        var Ordered = [];
                        var OrderedFinal = [];
                        var reverse = false;
                        var forcereverse = false;
                        angular.forEach(preOrdered, function (node) {

                            var orderingstring = 0;


                            if (typeof self.getOrderBy(node.nodeType) == 'function') {
                                var v = self.getOrderBy(node.nodeType);
                                orderingstring = v(node);
                            } else {


                                angular.forEach(self.getOrderBy(node.nodeType), function (property) {


                                    if (typeof property == 'function') {
                                        var v = property;
                                        orderingstring = v(node);
                                    } else {

                                        if (typeof property == 'string' && property.substr(0, 1) == '-') {
                                            reverse = true;
                                            property = property.substr(1);
                                        } else {
                                            reverse = false;
                                        }

                                        var s = self.getPropertyFromNode(node, property);


                                        if (typeof s === 'string') {
                                            orderingstring += s + " ";
                                            if (reverse) {
                                                forcereverse = true;
                                            }
                                        } else {

                                            if (typeof s === 'number') {
                                                if (reverse) {
                                                    s = 1 / s;
                                                }
                                                orderingstring = parseFloat(orderingstring + s);
                                            }

                                        }


                                    }


                                });
                            }

                            if (orderingstring == '') {
                                orderingstring = 0;
                            }

                            if (Ordered[orderingstring] == undefined) {
                                Ordered[orderingstring] = [];
                            }

                            if (orderingkeys.indexOf(orderingstring) == -1) {
                                orderingkeys.push(orderingstring);
                            }

                            Ordered[orderingstring].push(node);


                        });


                        angular.forEach(forcereverse ? orderingkeys.reverse() : orderingkeys.sort(), function (o) {
                            angular.forEach(Ordered[o], function (node) {
                                OrderedFinal.push(node);
                            });
                        });

                        return OrderedFinal;

                    },

                    /**
                     * @private
                     * @params string identifier
                     * @params array excludedScopeProperties dont apply given scope property names
                     * @returns mixed
                     */
                    loadNodesFromLocalStorage: function (identifier, excludedScopeProperties) {

                        var self = this;

                        if (identifier == undefined) {
                            return self;
                        }

                        if (self.isLoadedFromLocalStorage() == false) {

                            if ($window.localStorage[identifier] == undefined) {
                                return self;
                            }


                            var storage = null;

                            try {
                                storage = angular.fromJson($window.localStorage[identifier]);
                            } catch (e) {
                                // error in localstorage
                                return self;
                            }


                            if (storage.scope !== undefined) {

                                var scope = self.getFilter().getScope();

                                if (scope) {

                                    angular.forEach(storage.scope, function (value, key) {

                                        if (self.getFilter().isScopePropertyUsedAsFilter(key)) {
                                            scope[key] = value;
                                        } else {

                                            if (scope['__hybridsearchBindedResultTo'] !== key && (excludedScopeProperties == undefined || (excludedScopeProperties !== undefined && excludedScopeProperties.indexOf(key) == -1))) {
                                                if (key.substr(0, 1) !== '_') {
                                                    scope[key] = value;
                                                    window.setTimeout(function () {
                                                        scope.$apply();
                                                    }, 2);
                                                }
                                            }
                                        }


                                    });


                                    window.setTimeout(function () {
                                        scope.$apply();
                                    }, 2);
                                }


                            }


                            if (storage.scrollTop !== undefined) {

                                var intervalcounter = 0;
                                var interval = window.setInterval(function () {

                                    intervalcounter++;
                                    if (intervalcounter > 100 || self.getResults().isLoading() == false) {
                                        window.setTimeout(function () {
                                            jQuery('html, body').stop().animate({
                                                'scrollTop': storage.scrollTop
                                            }, 900, 'swing', function () {

                                            });

                                        }, 10);
                                        window.clearInterval(interval);
                                    }


                                }, 10);


                            }


                            if (storage.nodes == undefined || Object.keys(storage.nodes).length == 0) {
                                return self;
                            }

                            var items = {};
                            items['_nodes'] = {};
                            items['_nodesOrdered'] = [];
                            items['_nodesTurbo'] = {};
                            items['_nodesByType'] = {};

                            angular.forEach(storage.nodes, function (node) {
                                self.addNodeToSearchResult(node.identifier, 1, storage, items);
                                self.addLocalIndex([{node: node}]);
                            });

                            results.getApp().setResults(items, storage.nodes, this);


                        }

                        return this;

                    },

                    /**
                     * @private
                     * @params nodesFromInput
                     * @params {boolean} booleanmode
                     * @returns mixed
                     */
                    createSearchIndexOnDemand: function () {

                        var self = this;
                        var nodesToIndex = [];
                        var nodescount = Object.keys(nodes).length;

                        if (nodescount == nodesLastCount) {
                            return null;
                        }

                        angular.forEach(nodes, function (node) {
                            if (nodesIndexed[node.hash] == undefined) {
                                nodesToIndex.push({node: node});
                            }
                        });

                        if (nodesToIndex.length) {
                            self.addLocalIndex(nodesToIndex);
                        }


                        nodesLastCount = nodescount;

                    },


                    /**
                     * @private
                     * @params nodesFromInput
                     * @params {boolean} booleanmode
                     * @params {string} customquery
                     * @returns mixed
                     */
                    search: function (nodesFromInput, booleanmode, customquery) {


                        var self = this;


                        // set not found if search was timed out withou any results
                        if (searchCounterTimeout) {
                            clearTimeout(searchCounterTimeout);
                        }

                        searchCounterTimeout = window.setTimeout(function () {

                            var fields = {}, items = {}, nodesFound = {}, nodeTypeMaxScore = {},
                                nodeTypeMinScore = {}, nodeTypeScoreCount = {}, nodeTypeCount = {},
                                wasloadedfromInput = false;
                            var hasDistinct = self.getResults().hasDistincts();


                            if (self.getFilter().getQuery().length == 0) {
                                self.getResults().getApp().clearQuickNodes();
                            }


                            self.createSearchIndexOnDemand();

                            items['_nodes'] = {};
                            items['_nodesOrdered'] = [];
                            items['_nodesTurbo'] = {};
                            items['_nodesByType'] = {};
                            items['_nodesGroupedBy'] = {};

                            if (nodesFromInput == undefined && self.getNodesAddedByIdentifier()) {
                                nodesFromInput = self.getNodesAddedByIdentifier();
                            }


                            if (!self.getFilter().getFullSearchQuery()) {


                                var preOrdered = [];
                                var unfilteredResult = [];


                                if (nodesFromInput == undefined || Object.keys(nodesFromInput).length == 0) {
                                    nodesFromInput = nodes;
                                }


                                // return all nodes bco no query set
                                if (hasDistinct) {
                                    angular.forEach(nodesFromInput, function (node) {
                                        if (self.isFiltered(node) === false) {
                                            preOrdered.push(node);
                                        }
                                        unfilteredResult.push(node);
                                    });
                                } else {
                                    angular.forEach(nodesFromInput, function (node) {

                                        if (self.isFiltered(node) === false) {
                                            preOrdered.push(node);
                                        }

                                    });
                                }


                                angular.forEach(self.sortNodes(preOrdered), function (node) {
                                    self.addNodeToSearchResult(node.identifier, 1, nodesFound, items, nodeTypeMaxScore, nodeTypeMinScore, nodeTypeScoreCount);
                                });
                                wasloadedfromInput = true;
                                results.getApp().setResults(items, nodes, self);


                            } else {

                                var query = filter.getFinalSearchQuery(lastSearchInstance);

                                var preOrdered = [];
                                var unfilteredResult = [];


                                if (query === false) {
                                    if (hasDistinct) {
                                        // return all nodes bco no query set
                                        angular.forEach(nodesFromInput, function (node) {
                                            if (self.isFiltered(node) === false) {
                                                preOrdered.push(node);
                                            }
                                            unfilteredResult.push(node);
                                        });
                                    } else {
                                        // return all nodes bco no query set
                                        angular.forEach(nodesFromInput, function (node) {
                                            if (self.isFiltered(node) === false) {
                                                preOrdered.push(node);
                                            }
                                        });
                                    }


                                    angular.forEach(self.sortNodes(preOrdered), function (node) {
                                        self.addNodeToSearchResult(node.identifier, 1, nodesFound, items, nodeTypeMaxScore, nodeTypeMinScore, nodeTypeScoreCount);
                                    });

                                } else {

                                    // execute query search
                                    angular.forEach(lunrSearch.getFields(), function (v, k) {
                                        if (self.getBoost(v) >= 0) {
                                            fields[v] = {boost: self.getBoost(v)}
                                        }
                                    });

                                    if (query.length == 0) {
                                        // apply local query instead of autocompleted query
                                        query = self.getFilter().getQuery();
                                    }

                                    var tmp = {};


                                    if (self.isLoadedAll() && query == '') {

                                        // add all nodes to result
                                        angular.forEach(nodes, function (node, identifier) {
                                            preOrdered.push({ref: identifier, score: 1});
                                        });

                                    } else {

                                        if (Object.keys(lunrSearch.index).length == 0) {
                                            return self;
                                        }

                                        var resultsSearch = [];
                                        var sq = query;
                                        var qq = self.getFilter().getQuery();
                                        var qqq = self.getFilter().getQuery().split(" ");
                                        angular.forEach(qqq, function (i) {
                                            if (qq.indexOf(i + " ") < 0) {
                                                sq = sq.replace(" " + i, "");
                                            } else {
                                                angular.forEach(sq.split(" "), function (a) {
                                                    if (a.indexOf(i) == 0) {
                                                        sq = sq.replace(" " + a, " " + i);
                                                    }
                                                });
                                            }

                                        });

                                        resultsSearch[0] = lunrSearch.search(customquery == undefined ? self.getFilter().getQuery() : customquery, {
                                            fields: fields,
                                            bool: "AND",
                                            expand: true
                                        });

                                                                        
                                        if (resultsSearch[0].length == 0) {
                                            resultsSearch[1] = lunrSearch.search(self.getFilter().getQuery(), {
                                                fields: fields,
                                                bool: "AND",
                                                expand: false
                                            });

                                        }

                                        if (resultsSearch[1] != undefined && resultsSearch[1].length == 0) {

                                            resultsSearch[2] = lunrSearch.search(self.getFilter().getQuery(), {
                                                fields: fields,
                                                bool: "AND",
                                                expand: true
                                            });

                                        }


                                        if (resultsSearch[2] != undefined && resultsSearch[2].length == 0) {

                                            resultsSearch[3] = lunrSearch.search(sq, {
                                                fields: fields,
                                                bool: "AND",
                                                expand: false
                                            });

                                        }


                                        if (resultsSearch[3] != undefined && resultsSearch[3].length == 0) {
                                            resultsSearch[4] = lunrSearch.search(self.getFilter().getQuery(), {
                                                fields: fields,
                                                bool: "OR"
                                            });

                                        }

                                        if (resultsSearch[4] != undefined && resultsSearch[4].length == 0) {

                                            resultsSearch[5] = lunrSearch.search(self.getFilter().getQuery(), {
                                                fields: fields,
                                                bool: "OR",
                                                expand: true
                                            });

                                        }

                                        if (resultsSearch[5] != undefined && resultsSearch[5].length == 0) {

                                            resultsSearch[6] = lunrSearch.search(sq, {
                                                fields: fields,
                                                bool: "OR",
                                                expand: false
                                            });

                                        }

                                        if (resultsSearch[6] != undefined && resultsSearch[6].length == 0) {
                                            resultsSearch[7] = lunrSearch.search(query, {
                                                fields: fields,
                                                bool: "OR",
                                                expand: true
                                            });

                                        }

                                        if (resultsSearch[7] != undefined && resultsSearch[7].length == 0) {
                                            resultsSearch[8] = lunrSearch.search(self.getFilter().getQuery() + " " + query, {
                                                fields: fields,
                                                bool: "OR",
                                                expand: true
                                            });

                                        }


                                        var result = resultsSearch[resultsSearch.length - 1];


                                        //var scoresum = 0;
                                        // if (result.length > 0) {
                                        //
                                        //     angular.forEach(result, function (item) {
                                        //             scoresum = scoresum + item.score;
                                        //         }
                                        //     );
                                        //     console.log(scoresum,scoresum / result.length);
                                        //     if (scoresum / result.length < 10) {
                                        //         result = lunrSearch.search(self.getFilter().getQuery() + ' ' + query, {
                                        //             fields: fields,
                                        //             bool: "OR",
                                        //             expand: true
                                        //         });
                                        //
                                        //     }
                                        // }


                                        if (result.length > 0) {

                                            if (hasDistinct) {
                                                angular.forEach(result, function (item) {
                                                        if (nodes[item.ref] !== undefined) {
                                                            unfilteredResult.push(nodes[item.ref]);
                                                        }
                                                    }
                                                );
                                            }


                                            angular.forEach(result, function (item) {

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

                                                        //tmp[item.ref] = item.score;

                                                    }

                                                }
                                            );


                                        }


                                    }

                                    //

                                    var preOrdered = $filter('orderBy')(preOrdered, function (item) {
                                        item.score = Math.floor(item.score * self.getParentNodeTypeBoostFactor(nodes[item.ref]) * self.getNodeUrlBoostFactor(nodes[item.ref]));
                                        return -1 * item.score;
                                    });


                                    var preOrderedFilteredRelevance = preOrdered;

                                    if (self.hasOrderBy()) {

                                        var Ordered = $filter('orderBy')(preOrderedFilteredRelevance, function (item) {

                                            var orderBy = self.getOrderBy(nodes[item.ref].nodeType);
                                            if (orderBy.length) {

                                                var ostring = '';
                                                angular.forEach(orderBy, function (property) {

                                                    if (property === 'score') {
                                                        ostring += item.score;
                                                    } else {
                                                        var s = self.getPropertyFromNode(nodes[item.ref], property);
                                                        if (typeof s === 'string' || typeof s === 'number') {
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

                                    // var items = {};
                                    // items['_nodes'] = {};
                                    // items['_nodesTurbo'] = {};
                                    // items['_nodesByType'] = {};

                                    angular.forEach(Ordered, function (item) {
                                        self.addNodeToSearchResult(item.ref, item.score, nodesFound, items, nodeTypeMaxScore, nodeTypeMinScore, nodeTypeScoreCount);
                                    });

                                }


                            }


                            if (hasDistinct && unfilteredResult.length) {
                                var unfilteredResultNodes = [];
                                var nodeObject = null;
                                angular.forEach(unfilteredResult, function (node) {
                                    nodeObject = new HybridsearchResultsNode(node, 1);
                                    nodeObject['_isfiltered'] = {};
                                    angular.forEach(self.getResults().$$data.distincts, function (distinct, property) {
                                        nodeObject['_isfiltered'][property] = self.isFiltered(nodeObject, property);
                                    });
                                    unfilteredResultNodes.push(nodeObject);
                                });


                                results.updateDistincts(unfilteredResultNodes);
                            }


                            if (wasloadedfromInput == false) {

                                results.getApp().setResults(items, nodes, self, customquery == undefined ? false : true, self);
                                lastSearchApplyTimeout = null;
                            }


                        }, 8);

                    }
                    ,


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


                        if (this.getFilter().$$data.maxResultsFilter !== undefined && this.getFilter().$$data.maxResultsFilter > 0) {
                            if (this.getFilter().$$data.maxResultsFilter <= Object.keys(items['_nodes']).length) {
                                return true;
                            }
                        }


                        if (nodes[nodeId] == undefined) {
                            nodes[nodeId] = nodesFound[nodeId];
                        }

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

                                if (property === 'url') {
                                    var p = resultNode.uri !== undefined ? resultNode.uri.path : resultNode.getUrl();
                                } else {
                                    if (typeof property == 'string' && property.substr(0, 12) == 'documentNode') {
                                        var p = resultNode.getDocumentNode() ? resultNode.getDocumentNode().getProperty(property) : null;
                                    } else {
                                        var p = resultNode.getProperty(property);
                                    }
                                }

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
                            if (this.isFiltered(nodes[nodeId])) {
                                skip = true;
                            }
                        }


                        if (skip === false) {

                            // nodeTypeMaxScore[nodeTypeLabel] = score;
                            // nodeTypeMinScore[nodeTypeLabel] = score;

                            if (nodes[nodeId]['turbonode'] === true) {
                                items['_nodesTurbo'][hash] = resultNode;
                            } else {

                                if (items['_nodes'][hash] == undefined) {
                                    items['_nodesOrdered'].push({hash: hash});
                                }
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

                    }
                    ,
                    /**
                     * @private
                     * @param {object}
                     * @param {string} property
                     * @returns {mixed}
                     */
                    getPropertyFromObject: function (object, property) {

                        return window.HybridsearchGetPropertyFromObject(object, property);


                    }
                    ,


                    /**
                     * Get property.
                     * @param {string} property Get single property from node data.
                     * @returns {mixed}
                     */
                    getPropertyFromNode: function (node, property) {

                        return window.HybridsearchGetPropertyFromNode(node, property);

                    }
                    ,

                    /**
                     * @private
                     * @param {HybridsearchResultsNode} node
                     * @param string excluded property for filtering
                     * @returns boolean
                     */
                    isFiltered: function (node, excludedProperty) {

                        var self = this;


                        if (node.removed !== undefined && node.removed === true) {
                            return true;
                        }

                        if (this.getFilter().getNodeType()) {

                            if (typeof this.getFilter().getNodeType() == 'string') {
                                if (this.getFilter().getNodeType() !== node.nodeType) {
                                    return true;
                                }
                            } else {

                                if (self.inArray(node.nodeType, this.getFilter().getNodeType()) === false) {
                                    return true;
                                }

                            }


                        }


                        if (this.getFilter().getNodePath().length > 0 && node.uri !== undefined && node.uri.path.substr(0, this.getFilter().getNodePath().length) != this.getFilter().getNodePath()) {
                            return true;
                        }


                        var propertyFiltered = Object.keys(this.getFilter().getPropertyFilters()).length > 0 ? true : false;
                        var propertyFilteredLength = Object.keys(this.getFilter().getPropertyFilters()).length;
                        var excludedProperty1 = null;
                        var excludedProperty2 = null;

                        if (propertyFiltered) {


                            var propertyMatching = 0;


                            angular.forEach(this.getFilter().getPropertyFilters(), function (filter, property) {

                                if (filter === undefined || node == undefined) {
                                    return true;
                                }
                                if (excludedProperty !== undefined) {
                                    excludedProperty1 = excludedProperty.substr(-1 * (property.length + 2));
                                    excludedProperty2 = excludedProperty1.substr(0, excludedProperty1.length - 2);
                                }

                                if (excludedProperty === undefined || (excludedProperty1 !== property && excludedProperty2 !== property)) {


                                    if (filter.nodeType !== undefined && (filter.nodeType != node.nodeType)) {
                                        propertyMatching++;
                                    } else {

                                        var filterApplied = false, filterobject = {};

                                        var propertyValue = self.getPropertyFromNode(node, property);


                                        // filter is fulltext mode
                                        if (filterApplied === false && filter.fulltextmode === true) {
                                            var vv = JSON.stringify(filter.value).replace(/['",\[\]\}\{]/gi, '').toLowerCase().split(" ");
                                            var vvc = 0;
                                            angular.forEach(vv, function (v) {
                                                if (JSON.stringify(propertyValue).toLowerCase().indexOf(v) >= 0) {
                                                    vvc++;
                                                }
                                            });

                                            if (vvc == vv.length) {
                                                propertyMatching++;
                                                filterApplied = true;
                                            }
                                        }


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

                                        // filter is boolean
                                        if (filterApplied === false && typeof filter.value === 'boolean') {

                                            if (((filter.reverse === false && propertyValue == filter.value) || (filter.reverse === true && propertyValue != filter.value))) {
                                                propertyMatching++;
                                            }
                                            filterApplied = true;
                                        }


                                        // filter is a number
                                        if (filterApplied === false && typeof filter.value === 'number') {
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

                                                    if (filter.reverse === false && propertyValue === value) {
                                                        isMatching++;
                                                    } else {

                                                        if ((filter.reverse === false && (key == propertyValue) || self.inArray(key, propertyValue)) || (filter.reverse == true && key != propertyValue && self.inArray(key, propertyValue) === false)) {
                                                            isMatching++;
                                                        }
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
                                } else {
                                    if (excludedProperty !== undefined) {
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


                        //
                        // if (propertyFiltered === false && this.getFilter().getAgeFilter() != '') {
                        //     if (this.getFilter().getPropertyFilters() != node.__userAgeBracket) {
                        //         return true;
                        //     }
                        // }
                        //
                        // if (propertyFiltered === false && this.getFilter().getGenderFilter() != '') {
                        //     if (this.getFilter().getGenderFilter() != node.__userGender) {
                        //         return true;
                        //     }
                        // }


                        return propertyFiltered;

                    }
                    ,


                    /**
                     * @private
                     * @param {string} target
                     * @param {array} array
                     * @returns mixed
                     */
                    inArray: function (target, array) {

                        if (array !== undefined && typeof array == 'object' && array) {
                            for (var i = 0; i < array.length; i++) {

                                if (array[i] == target) {
                                    return true;
                                }
                            }
                        }

                        return false;
                    }
                    ,


                    /**
                     * @private
                     * @returns mixed
                     */
                    setSearchIndex: function () {


                        var self = this;

                        if (self.getHybridsearch().getBranch() === false) {
                            self.cancelAllPendingRequest();
                            return false;
                        }

                        if (self.isRunning() === false) {
                            return false;
                        } else {

                            if (self.getFilter().getNodeType() && self.getFilter().getQuery() == '') {
                                // don't cancel pending requests
                            } else {
                                self.cancelAllPendingRequest();
                            }

                        }


                        // if (self.isLoadedAll() === false && self.isLoadedFromLocalStorage() == false) {
                        //     nodes = {};
                        // }


                        if (self.isNodesByIdentifier() === false && self.isRunning() && filter.hasFilters()) {


                            if (lastSearchInstance && lastSearchInstance.$$data !== undefined) {
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

                            window.clearTimeout(getIndexTimeout);

                            getIndexTimeout = window.setTimeout(function () {
                                lastSearchInstance = searchIndex.getIndex();

                                var counter = 0;

                                searchInstancesInterval = setInterval(function () {
                                    counter++;
                                    if (lastSearchInstance.$$data.canceled === true || counter > 55000 || lastSearchInstance.$$data.proceeded.length >= lastSearchInstance.$$data.running) {
                                        clearInterval(searchInstancesInterval);
                                        lastSearchInstance.execute(self, lastSearchInstance);
                                        self.search(nodes);
                                    }
                                }, 10);
                            }, 5);


                        } else {
                            if (self.isRunning()) {
                                self.search();
                            }
                        }


                    }
                    ,

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


                            if (Object.keys(keywords).length > 0) {
                                angular.forEach(keywords, function (keyword) {
                                    self.getKeywords(keyword, instance);
                                });
                            } else {
                                instance.$$data.running++;
                                instance.$$data.proceeded.push(1);
                            }


                            return instance;


                        },


                            /**
                             * execute search.
                             * @returns {SearchIndexInstance} SearchIndexInstance
                             */
                            this.execute = function (self, lastSearchInstance) {


                                clearInterval(self.getIndexInterval());

                                var uniquarrayfinal = [];
                                var uniquarrayfinalTerms = {};

                                if (lastSearchInstance.$$data.keywords.length) {
                                    var unique = {};

                                    angular.forEach(lastSearchInstance.$$data.keywords, function (v) {
                                        if (unique[v.metaphone] === undefined) {
                                            uniquarrayfinal.push(v.metaphone);
                                            uniquarrayfinalTerms[v.metaphone] = (uniquarrayfinalTerms[v.metaphone] == undefined ? '' : uniquarrayfinalTerms[v.metaphone]) + " " + v.term;
                                            unique[v.metaphone] = true;
                                        }
                                    });


                                } else {
                                    self.search();
                                }


                                // fetch index data
                                var indexintervalcounter = 0;
                                var indexcounter = 0;
                                var indexdata = {};
                                var executedRef = {};

                                var cleanedup = false;


                                if (self.isLoadedAll() === false) {


                                    if (uniquarrayfinal.length === 0 && self.getFilter().getQuery().length == 0) {
                                        uniquarrayfinal = [null];
                                    }

                                    var execute = function (keyword, data, ref) {


                                        if (ref) {

                                            if (self.isLoadedAll(ref.socket !== undefined ? ref.socket.toString() : null) === false) {


                                                if (ref.parser) {

                                                    var parsed = false;

                                                    if (ref.parser !== undefined && ref.parser.type == 'html') {
                                                        data = self.parseHtml(data, ref.parser.config);
                                                        parsed = true;
                                                    }

                                                    if (ref.parser !== undefined && ref.parser.type == 'xml') {
                                                        data = self.parseXml(data, ref.parser.config);
                                                        parsed = true;
                                                    }

                                                    if (ref.parser !== undefined && ref.parser.type == 'json') {
                                                        data = self.parseJson(data, ref.parser.config);
                                                        parsed = true;
                                                    }


                                                    if (parsed === false) {
                                                        data = null;
                                                    }

                                                }


                                                if (data !== null) {


                                                    if (keyword === null || keyword === '') {

                                                        if (indexdata['__'] === undefined) {
                                                            indexdata['__'] = [];
                                                        }

                                                        angular.forEach(data, function (node, id) {
                                                            if (node != undefined) {
                                                                nodes[node.node.identifier] = node.node;
                                                                indexdata['__'].push(node);
                                                            }
                                                        });

                                                        if (setIndexTimeout) {
                                                            clearTimeout(setIndexTimeout);
                                                        }
                                                        // setIndexTimeout = window.setTimeout(function () {
                                                        self.search(nodes);
                                                        // }, 1);

                                                        self.setIsLoadedAll(ref.socket.toString());


                                                    } else {

                                                        if (ref.http) {
                                                            keyword = Sha1.hash(ref.http) + "://" + keyword;
                                                        } else {
                                                            if (ref.socket) {
                                                                Sha1.hash(ref.socket.path.toString()) + "://" + keyword;
                                                            }
                                                        }

                                                        if (indexdata[keyword] === undefined) {
                                                            indexdata[keyword] = [];
                                                        }

                                                        angular.forEach(data, function (node, id) {
                                                            if (node && node.node !== undefined) {
                                                                nodes[node.node.identifier] = node.node;
                                                                indexdata[keyword].push(node);
                                                            }
                                                        });
                                                        self.updateLocalIndex(indexdata, lastSearchInstance);
                                                        indexcounter++;
                                                    }

                                                }
                                            }
                                        }

                                    };


                                    clearTimeout(self.getIndexInterval());


                                    angular.forEach(uniquarrayfinal, function (keyword) {

                                        var refs = self.getIndex(keyword);


                                        if (refs !== null && refs.length) {
                                            angular.forEach(refs, function (ref) {

                                                    if (self.isLoadedAll(ref.socket.toString()) == false && self.isLoadedAll(JSON.stringify(self.getFilter().getNodeType())) == false) {

                                                        var canceller = $q.defer();

                                                        if (self.getConfig('realtime') === null && ref.socket !== undefined) {
                                                            ref.http = null;
                                                        }

                                                        if (ref.http && (self.getConfig('realtime') === null || self.getConfig('realtime') === false) && ref.socket !== undefined) {

                                                            var req = {
                                                                method: 'get',
                                                                url: ref.http,
                                                                timeout: canceller.promise,
                                                                cancel: function (reason) {
                                                                    canceller.resolve(reason);
                                                                }
                                                            };

                                                            self.addPendingRequest($http(req).success(function (data) {

                                                                nodesIndexed = {};
                                                                var tmpNodes = [];
                                                                var tmpNodesCounter = 0;

                                                                var reqNodesCount = data ? Object.keys(data).length : 0;


                                                                if (reqNodesCount) {

                                                                    if (self.getFilter().getNodeType()) {
                                                                        self.setIsLoadedAll(JSON.stringify(self.getFilter().getNodeType()));
                                                                    }


                                                                    var groupedByNodeType = {};
                                                                    angular.forEach(data, function (node, identifier) {
                                                                        if (groupedByNodeType[node.nodeType] == undefined) {
                                                                            groupedByNodeType[node.nodeType] = {
                                                                                'ref': self.getIndex(null, node.nodeType),
                                                                                'nodes': {}
                                                                            };

                                                                        }
                                                                        groupedByNodeType[node.nodeType]['nodes'][identifier] = null;

                                                                    });

                                                                    var requestCount = Object.keys(groupedByNodeType).length;
                                                                    var requestCountDone = 0;
                                                                    var groupedByNodeTypeNodes = [];
                                                                    var isstaticcached = true;

                                                                    angular.forEach(groupedByNodeType, function (group, nodetype) {
                                                                        if (staticCachedNodes[nodetype] == undefined) {
                                                                            isstaticcached = false;
                                                                        }
                                                                    });


                                                                    if (isstaticcached == false) {
                                                                        angular.forEach(groupedByNodeType, function (group, nodetype) {

                                                                            // fetch all nodes content
                                                                            if (self.getConfig('cache')) {
                                                                                var req = {
                                                                                    method: 'get',
                                                                                    url: group.ref.http,
                                                                                    headers: {'cache-control': 'private, max-age=' + self.getConfig('cache')},
                                                                                    timeout: canceller.promise,
                                                                                    cancel: function (reason) {
                                                                                        canceller.resolve(reason);
                                                                                    }
                                                                                };

                                                                            } else {
                                                                                var req = {
                                                                                    method: 'get',
                                                                                    url: group.ref.http,
                                                                                    cache: true,
                                                                                    timeout: canceller.promise,
                                                                                    cancel: function (reason) {
                                                                                        canceller.resolve(reason);
                                                                                    }
                                                                                };
                                                                            }

                                                                            self.addPendingRequest($http(req).success(function (data) {
                                                                                angular.forEach(groupedByNodeType[nodetype].nodes, function (node, identifier) {
                                                                                    groupedByNodeTypeNodes.push(data[identifier]);
                                                                                });
                                                                                requestCountDone++;
                                                                                if (staticCachedNodes[nodetype] == undefined) {
                                                                                    staticCachedNodes[nodetype] = data;
                                                                                }
                                                                                //execute(keyword, groupedByNodeType[nodetype]['nodes'], ref);
                                                                                if (requestCountDone == requestCount) {
                                                                                    execute(keyword, groupedByNodeTypeNodes, ref);
                                                                                }
                                                                            }));


                                                                        });

                                                                    } else {
                                                                        angular.forEach(groupedByNodeType, function (group, nodetype) {
                                                                            angular.forEach(groupedByNodeType[nodetype].nodes, function (node, identifier) {
                                                                                groupedByNodeTypeNodes.push(staticCachedNodes[nodetype][identifier]);
                                                                            });
                                                                        });
                                                                        execute(keyword, groupedByNodeTypeNodes, ref);
                                                                    }


                                                                }
                                                            }));

                                                        } else {

                                                            if (ref.socket) {

                                                                if (ref.isLoadingAllFromNodeType == undefined) {


                                                                    ref.socket.on("child_removed", function (data) {
                                                                        // node was removed
                                                                        if (nodes[data.key] !== undefined) {
                                                                            nodes[data.key].removed = true;
                                                                        }
                                                                        self.search();
                                                                    });


                                                                    ref.socket.on("value", function (data) {

                                                                        nodesIndexed = {};

                                                                        var tmpNodes = [];
                                                                        var tmpNodesCount = 0;
                                                                        var tmpSkippedNodesCount = 0;
                                                                        var reqNodesCount = data.val() ? Object.keys(data.val()).length : 0;
                                                                        var nodeData = data.val();

                                                                        self.setIsNotLoadedAll(ref.socket.toString());


                                                                        if (reqNodesCount) {

                                                                            angular.forEach(nodeData, function (node, identifier) {

                                                                                    if (nodes[identifier] == undefined) {

                                                                                        if (self.getFilter().getNodeType() && (self.getFilter().getNodeType() !== node.nodeType && self.getFilter().getNodeType().indexOf(node.nodeType) < 0)) {
                                                                                            // skip filtered nodetype
                                                                                            tmpNodesCount++;
                                                                                        } else {

                                                                                            self.getIndexByNodeIdentifierAndNodeType(identifier, node.nodeType).on("value", function (data) {

                                                                                                if (nodes[identifier] == undefined) {
                                                                                                    // add node
                                                                                                    tmpNodes.push(data.val());
                                                                                                    tmpNodesCount++;
                                                                                                } else {

                                                                                                    // update node
                                                                                                    tmpNodesCount++;

                                                                                                    if (data.val()) {
                                                                                                        if (data.val().node === undefined) {
                                                                                                            // node was removed
                                                                                                            if (nodes[identifier] !== undefined) {
                                                                                                                nodes[identifier].removed = true;
                                                                                                            }
                                                                                                        } else {
                                                                                                            if (nodes[identifier] == undefined || (nodes[identifier].removed == undefined)) {
                                                                                                                nodes[identifier] = data.val().node;
                                                                                                            }
                                                                                                        }

                                                                                                        self.search();
                                                                                                    }

                                                                                                }

                                                                                                if (tmpNodesCount == reqNodesCount) {

                                                                                                    execute(keyword, tmpNodes, ref);
                                                                                                    self.search();
                                                                                                    self.setIsLoadedAll(ref.socket.toString());
                                                                                                }

                                                                                            });

                                                                                        }

                                                                                    } else {
                                                                                        // skip node update
                                                                                        tmpNodesCount++;
                                                                                        tmpSkippedNodesCount++;
                                                                                        tmpNodes[identifier] = nodes[identifier];
                                                                                        if (tmpSkippedNodesCount == tmpNodesCount) {
                                                                                            self.search();
                                                                                        }
                                                                                    }

                                                                                }
                                                                            );
                                                                        }

                                                                    });


                                                                } else {


                                                                    ref.socket.once("value", function (data) {

                                                                        if (data.val()) {
                                                                            execute(keyword, data.val(), ref);
                                                                            self.search();
                                                                        }
                                                                        angular.forEach(data.val(), function (node, identifier) {
                                                                            self.getIndexByNodeIdentifierAndNodeType(identifier, node.nodeType).on("child_changed", function (data) {
                                                                                nodes[identifier] = data.val();
                                                                                self.search();
                                                                            });
                                                                        });


                                                                    });


                                                                }


                                                            }
                                                        }

                                                    }
                                                    else {
                                                        if (keyword) {
                                                            self.search();
                                                        } else {
                                                            self.search(nodes);
                                                        }
                                                    }
                                                }
                                            );

                                        }


                                    })
                                    ;
//}, 5));


                                    var musthavelength = uniquarrayfinal.length;

                                    if (lastSearchInstance.$$data.keywords.length) {

                                        if (self.getExternalSources()) {

                                            // // add external sources
                                            var canceller = $q.defer();
                                            angular.forEach(self.getExternalSources(), function (ref) {

                                                if (ref.proceeded === undefined && (ref.standalone === undefined || ref.standalone == false)) {
                                                    musthavelength++;
                                                    self.addPendingRequest($http({
                                                        method: 'get',
                                                        url: ref.http.replace("$query", self.getFilter().getQuery()),
                                                        cache: true,
                                                        timeout: canceller.promise,
                                                        cancel: function (reason) {
                                                            canceller.resolve(reason);
                                                        }
                                                    }).success(function (data) {
                                                        execute(self.getFilter().getQuery(), data, ref);
                                                    }));
                                                }
                                                ref.proceeded = true;

                                            });

                                        }


                                    }


                                } else {
                                    //  results.$$app.clearResults();
                                    self.search();
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
                     * @param array log store data
                     * @returns {firebaseObject}
                     */
                    executeLogStoreData: function (data) {

                        // var canceller = $q.defer();
                        // var self = this;
                        // var datanodes = [];
                        //
                        // if (typeof data == 'string') {
                        //     datanodes.push(data);
                        // } else {
                        //     datanodes = data;
                        // }
                        //
                        // angular.forEach(datanodes, function (node) {
                        //     self.addPendingRequest($http({
                        //         method: 'get',
                        //         url: self.getIndexUrlByNodeIdentifier(node),
                        //         cache: true,
                        //         timeout: canceller.promise,
                        //         cancel: function (reason) {
                        //             canceller.resolve(reason);
                        //         }
                        //     }).success(function (n) {
                        //         if (n !== null) {
                        //             nodes[n.node.identifier] = new HybridsearchResultsNode(n.node, 1);
                        //             self.getResults().getApp().addQuickNode(nodes[n.node.identifier]);
                        //         }
                        //     }));
                        //
                        // });

                        return this;

                    },

                    /**
                     * @private
                     * @param string query
                     * @returns {string}
                     */
                    getMetaphone: function (querysegment) {

                        // get search results
                        var q = metaphone(querysegment.toLowerCase()).toUpperCase();

                        if (q.length > 7) {
                            q = q.substr(0, q.length - 2);
                        }
                        if (q.length == 0 || q == 0) {
                            return querysegment.toLowerCase();
                        }
                        if (q.length < 4) {
                            q = querysegment.substr(0, 1) + q;
                        }
                        if (q.length < 4) {
                            q = querysegment.toUpperCase().substr(0, 3) + q;
                        }

                        q = q.replace(/[^A-z]/, '0').toUpperCase();



                        return q;
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

                        instance.$$data.autocomplete = [];

                        if (this.getFilter().isBlockedKeyword(querysegment)) {
                            return false;
                        }

                        var q = self.getMetaphone(querysegment);
                        var qfallback = "000" + self.getMetaphone(querysegment.substr(0, 3));

                        instance.$$data.running++;

                        var ref = {};
                        ref.socket = hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "keywords/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/" + q);
                        ref.http = (hybridsearch.$$conf.cdnDatabaseURL == undefined ? hybridsearch.$$conf.databaseURL : hybridsearch.$$conf.cdnDatabaseURL) + ("/sites/" + hybridsearch.$$conf.site + "/" + "keywords/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/" + q + ".json");

                        instance.$$data.keywords.push({term: q, metaphone: q});

                        ref.socketAutocomplete = hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "keywords/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/" + qfallback);
                        ref.socketAutocomplete.once("value", function (data) {
                            self.setAutocomplete(data.val(), querysegment);
                        });


                        ref.socket.once("value", function (data) {
                            if (data.val()) {
                                self.setAutocomplete(data.val(), querysegment);
                                angular.forEach(data.val(), function (v, k) {
                                    instance.$$data.keywords.push({term: k, metaphone: q});

                                });
                                instance.$$data.proceeded.push(1);
                            } else {
                                instance.$$data.proceeded.push(1);
                            }

                        });

                        instance.$$data.proceeded.push(1);

                    }


                    ,
                    /**
                     * @private
                     * @param string keyword
                     * @param string nodeType
                     * @returns {firebaseObject}
                     */
                    getIndex: function (keyword, nodeType) {


                        var self = this;
                        var queries = [];

                        if (nodeType !== undefined) {

                            var query = {
                                isLoadingAllFromNodeType: true,
                                socket: hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/__" + nodeType),
                                http: (self.getConfig('cache') ? (hybridsearch.$$conf.cdnStaticURL == undefined ? '/_Hybridsearch' : hybridsearch.$$conf.cdnStaticURL + '/_Hybridsearch') : (hybridsearch.$$conf.cdnDatabaseURL == undefined ? hybridsearch.$$conf.databaseURL : hybridsearch.$$conf.cdnDatabaseURL)) + "/sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/__" + nodeType + ".json"
                            };
                            return query;

                        }


                        // remove old bindings
                        angular.forEach(index, function (refs, keyw) {
                            if (self.getFilter().isInQuery(keyw) === false || keyword == keyw) {
                                angular.forEach(refs, function (ref) {
                                    if (ref.socket) {
                                        //if (ref.socket.toString(), self.isLoadedAll(ref.socket.toString()) == false) {
                                        ref.socket.off('value');
                                        ref.socket.off('child_removed');
                                        ref.socket.off('child_added');
                                        // }
                                    }
                                });
                            }
                        });


                        if (keyword === undefined || keyword === null) {
                            keyword = this.getFilter().getQuery() ? this.getFilter().getQuery() : '';
                        }


                        if (queries.length === 0 && this.getFilter().getNodeType()) {


                            if (typeof this.getFilter().getNodeType() == 'string') {

                                if (keyword.length) {
                                    queries.push({
                                        socket: hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + '/' + keyword),
                                        http: (hybridsearch.$$conf.cdnDatabaseURL == undefined ? hybridsearch.$$conf.databaseURL : hybridsearch.$$conf.cdnDatabaseURL) + "/sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + '/' + keyword + ".json"
                                    });
                                } else {
                                    queries.push(
                                        {
                                            isLoadingAllFromNodeType: true,
                                            socket: hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/__" + this.getFilter().getNodeType()),
                                            http: (self.getConfig('cache') ? (hybridsearch.$$conf.cdnStaticURL == undefined ? '/_Hybridsearch' : hybridsearch.$$conf.cdnStaticURL + '/_Hybridsearch') : (hybridsearch.$$conf.cdnDatabaseURL == undefined ? hybridsearch.$$conf.databaseURL : hybridsearch.$$conf.cdnDatabaseURL)) + "/sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/__" + this.getFilter().getNodeType() + ".json"
                                        }
                                    );
                                }

                                index[this.getFilter().getNodeType()] = queries;


                            } else {


                                angular.forEach(this.getFilter().getNodeType(), function (nodeType) {

                                    if (keyword.length) {
                                        queries.push({
                                            socket: hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + '/' + keyword),
                                            http: (hybridsearch.$$conf.cdnDatabaseURL == undefined ? hybridsearch.$$conf.databaseURL : hybridsearch.$$conf.cdnDatabaseURL) + "/sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + '/' + keyword + ".json"
                                        });

                                    } else {
                                        queries.push(
                                            {
                                                isLoadingAllFromNodeType: true,
                                                socket: hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/__" + nodeType),
                                                http: (self.getConfig('cache') ? '/_Hybridsearch' : (hybridsearch.$$conf.cdnDatabaseURL == undefined ? hybridsearch.$$conf.databaseURL : hybridsearch.$$conf.cdnDatabaseURL)) + "/sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/__" + nodeType + ".json"
                                            }
                                        );
                                    }


                                });


                                index[this.getFilter().getNodeType()] = queries;


                            }


                        }


                        if (queries.length === 0) {
                            if (keyword === null) {
                                return null;
                            }

                            if (keyword.length < 2) {
                                return null;
                            }


                            queries.push({
                                socket: hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + '/' + keyword),
                                http: (hybridsearch.$$conf.cdnDatabaseURL == undefined ? hybridsearch.$$conf.databaseURL : hybridsearch.$$conf.cdnDatabaseURL) + "/sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + '/' + keyword + ".json"
                            });

                        }


                        index[keyword] = queries;


                        return queries;

                    }
                    ,

                    /**
                     * @private
                     * @param string identifier
                     * @returns {firebaseObject}
                     */
                    getIndexByNodeIdentifier: function (identifier) {
                        return hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/" + identifier + "/" + identifier);
                    }
                    ,
                    /**
                     * @private
                     * @param string identifier
                     * @returns {firebaseObject}
                     */
                    getIndexByNodeIdentifierAndNodeType: function (identifier, nodeType) {
                        return hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/__" + nodeType + "/" + identifier);
                    }
                    ,

                    /**
                     * @private
                     * @param string identifier
                     * @returns string
                     */
                    getIndexUrlByNodeIdentifier: function (identifier) {
                        return (hybridsearch.$$conf.cdnDatabaseURL == undefined ? hybridsearch.$$conf.databaseURL : hybridsearch.$$conf.cdnDatabaseURL) + "/sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/" + identifier + "/" + identifier + ".json";
                    }
                    ,

                    /**
                     * @private
                     * @param string identifier
                     * @returns {firebaseObject}
                     */
                    getIndexByNodeType: function (nodeType) {

                        return hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/__" + nodeType);

                    }
                    ,

                    /**
                     * @private
                     * @returns string
                     */
                    getLocalIndexHash: function () {
                        return Sha1.hash(JSON.stringify({nodes: nodes, q: this.getFilter().getQuery()}));
                    }
                    ,
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
                        nodesIndexed = {};

                        this.getFilter().setAutocompletedKeywords('');
                        lunrSearch = elasticlunr(function () {
                            this.setRef('id');
                        });

                    }
                    ,

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
                     * @param string
                     * @param string
                     * @returns void
                     */
                    setAutocomplete: function (a, querysegment) {
                        this.getResults().updateAutocomplete(a, querysegment);
                    }
                    ,
                    /**
                     * @private
                     * @param object data
                     * @returns void
                     */
                    updateLocalIndex: function (data, lastSearchInstance, isloadingall) {


                        var self = this, keywords = [];

                        angular.forEach(data, function (val, keyword) {
                            keyword = keyword.indexOf("://") ? keyword.substr(keyword.indexOf("://") + 3) : keyword;
                            angular.forEach(lastSearchInstance.$$data.keywords, function (k) {
                                keywords.push(k.term);
                            });
                            self.addLocalIndex(val, keyword, keywords, isloadingall);

                            keywords = [];
                        });


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
                    addLocalIndex: function (data, keyword, keywords, isloadingall) {

                        var self = this;
                        var hasDistinct = self.getResults().hasDistincts();
                        var boost = {};


                        angular.forEach(data, function (value, key) {

                                if (value && nodesIndexed[value.node.hash] == undefined) {
                                    var doc = {};

                                    //if (hasDistinct == true || self.isFiltered(value.node) === false) {

                                    nodes[value.node.identifier] = value.node;
                                    if (value.node != undefined && value.node.properties != undefined) {

                                        //angular.forEach(JSON.parse(JSON.stringify(value.node.properties)), function (propvalue, property) {
                                        angular.forEach(value.node.properties, function (propvalue, property) {

                                            if (property.length > 1 && property !== 'lastmodified' && property !== 'sorting' && property !== 'uri' && propvalue && propvalue.getProperty == undefined) {

                                                if (boost[property] == undefined) {
                                                    boost[property] = self.getBoost(property, value.node.nodeType);
                                                }

                                                if (boost[property] > 0) {


                                                    var valueJson = false;

                                                    if (typeof propvalue === 'object') {
                                                        valueJson = propvalue;
                                                    } else {
                                                        if (typeof propvalue === 'string' && ((propvalue.substr(0, 1) == '{') || ((propvalue.substr(0, 2) === '["' && propvalue.substr(-2, 2) === '"]')) || (propvalue.substr(0, 2) === '[{' && propvalue.substr(-2, 2) === '}]'))) {
                                                            try {
                                                                var valueJson = JSON.parse(propvalue);
                                                            } catch (e) {
                                                                valueJson = false;
                                                            }
                                                        }
                                                    }

                                                    if (valueJson) {

                                                        var recstring = valueJson.getRecursiveStrings();


                                                        angular.forEach(recstring, function (o) {
                                                            doc[property + '.' + o.key] = o.val.replace(/(<([^>]+)>)/ig, " ");

                                                        });

                                                    } else {
                                                        if (typeof propvalue === 'string') {
                                                            doc[property] = propvalue.replace(/(<([^>]+)>)/ig, " ");
                                                        }
                                                    }

                                                }
                                            }
                                        });

                                        if (Object.keys(doc).length) {


                                            if (doc.rawcontent == undefined && value.node.rawcontent !== undefined) {
                                                doc.rawcontent = value.node.rawcontent;
                                            }

                                            if (value.node.breadcrumb !== undefined) {
                                                doc.breadcrumb = value.node.breadcrumb.replace(/(<([^>]+)>)/ig, "");
                                                doc.breadcrumb = doc.breadcrumb.substr(doc.breadcrumb.trim().lastIndexOf(" ")).toLowerCase();
                                                doc.breadcrumb = doc.breadcrumb.replace(/[^A-zöäü^>]/ig, " ");
                                            }

                                            var eachObjecKeys = Object.keys(doc);
                                            var lunrFields = lunrSearch.getFields();
                                            angular.forEach(eachObjecKeys, function (key) {
                                                if (lunrFields.indexOf(key) < 0) {
                                                    lunrSearch.addField(key);
                                                }
                                            });

                                            doc.id = value.node.identifier;
                                            lunrSearch.addDoc(doc);
                                            nodesIndexed[value.node.hash] = true;
                                        }

                                    }
                                    // }

                                }

                            }
                        );


                    }

                }
                ;

                this.$$conf = {};

                this.$$data = {
                    'filterWasChangedOnce': false
                };

                Object.defineProperty(this, '$$conf', {
                    value: this.$$conf
                });

                Object.defineProperty(this, '$$data', {
                    value: this.$$data
                });

                Object.defineProperty(this, '$$app', {
                    value: this.$$app
                });


            }


            HybridsearchObject.prototype = {

                /**
                 * @param {function} callback method called whenever results are loaded
                 * @example
                 *   .$watch(function (data) {
                 *           $scope.result = data;
                 *           setTimeout(function () {
                 *               $scope.$apply();
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
                 * @returns {scope} angular scope
                 */
                getScope: function () {
                    return this.$$app.getResults().$$app.getScope();
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
                    scope['__hybridsearchBindedResultTo'] = scopevar;
                    this.$$app.setHybridsearchInstanceNumber();
                    this.startLogStore();
                    return this;
                },

                /**
                 * @private
                 * run logstore
                 * @returns  {HybridsearchObject}
                 */
                startLogStore: function () {

                    // var id = this.getScope().$id;
                    // var logStoreApplied = {};
                    // var self = this;
                    //
                    //
                    // jQuery('.ng-scope').each(function () {
                    //
                    //     if (angular.element(this).scope().$id == id) {
                    //
                    //         jQuery(this).on("click", function (event) {
                    //
                    //             var node = angular.element(event.target);
                    //             if (node !== undefined && node.scope() !== undefined && node.scope().node) {
                    //
                    //                 if (logStoreApplied[node.scope().node.getIdentifier()] == undefined) {
                    //                     var q = self.$$app.getFilter().getQueryLogStoreHash();
                    //                     if (q.length > 2 && logStoreApplied[q] == undefined) {
                    //                         var ref = self.$$app.getHybridsearch().$firebase().database().ref("logstore/" + self.$$app.getHybridsearch().$$conf.site + "/" + self.$$app.getHybridsearch().$$conf.workspace + "/" + self.$$app.getHybridsearch().$$conf.dimension + "/" + q);
                    //                         ref.set(node.scope().node.getIdentifier());
                    //                         logStoreApplied[node.scope().node.getIdentifier()] = true;
                    //                         logStoreApplied[q] = true;
                    //                     }
                    //
                    //                 }
                    //
                    //                 if (event.target.tagName == 'A') {
                    //
                    //                     var identifier = self.save().getIdentifier();
                    //                     if (identifier !== undefined && window.location.hash !== identifier) {
                    //                         window.location.hash = identifier;
                    //                     }
                    //                 }
                    //
                    //
                    //             }
                    //
                    //         });
                    //
                    //     }
                    //
                    // });


                    return this;

                },

                /**
                 * @private
                 * run search and perform queries
                 * @returns  {HybridsearchObject}
                 */
                run: function () {

                    var self = this;

                    if (self.$$app.isRunning() === false) {
                        self.$$app.setIsRunning();
                    }

                    if (this.$$app.getResults().$$data.isrunningfirsttimestamp > 0) {
                        return null;
                    }

                    if (!self.$$app.getHybridsearch().getBranch()) {
                        var counter = 0;
                        var branchInitInterval = setInterval(function () {
                            counter++;
                            if (counter > 20000 || self.$$app.getHybridsearch().getBranch()) {
                                clearInterval(branchInitInterval);
                                self.getScope()['__hybridsearchInstanceNumber'] = self.$$app.setHybridsearchInstanceNumber(angular.element(self.getScope()).$id);
                                self.$$app.setFirstFilterHash(self.$$app.getFilter().getHash());
                                self.$$app.setSearchIndex();
                            }

                        }, 10);

                        self.$$app.getHybridsearch().$$conf.branchInitialized = true;

                    } else {
                        if (self.$$app.isRunning() === false) {
                            self.$$app.setFirstFilterHash(self.$$app.getFilter().getHash());
                            self.$$app.setSearchIndex();
                        }

                    }

                    if (self.$$app.getHybridsearchInstanceNumber() === undefined) {
                        self.$$app.setHybridsearchInstanceNumber();
                    }

                    this.$$app.getResults().$$data.isrunningfirsttimestamp = Date.now();

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
                 * Creates snapshot of current HybridsearchObject for cached instant use
                 * @param string identifier
                 * @returns HybridsearchSnapshot of HybridsearchObject
                 */
                save: function (identifier) {

                    var snapshot = new HybridsearchSnapshotObject(this, identifier, false);
                    return snapshot;

                },

                /**
                 * Disable realtime search, use static data over cdn instead of
                 * @returns {HybridsearchObject}
                 */
                hasFilterChanges: function () {
                    return this.$$data.filterWasChangedOnce;
                },

                /**
                 * Disable realtime search, use static data over cdn instead of
                 * @returns {HybridsearchObject}
                 */
                disableRealtime: function () {
                    this.$$app.setConfig('realtime', false);
                    return this;
                },

                /**
                 * Disable realtime search, use static data over cdn instead of
                 * @returns {HybridsearchObject}
                 */
                enableCache: function (expires) {
                    this.$$app.setConfig('cache', expires == undefined ? 3600 : expires);
                    this.$$app.setConfig('realtime', false);
                    return this;
                },

                /**
                 * Adds a property filter to the query.
                 * @param {string} property to search only for
                 * @param {string} value that property must match
                 * @param {scope} scope false if is simple string otherwise angular scope required for binding data
                 * @param boolean reverse (true if condition logic is reversed)
                 * @param boolean booleanmode (true if array values treated with OR conditions)
                 * @param boolean fulltextmode (true find in fulltext mode)
                 * @param nodeType nodeType (apply filter only to given nodeType)
                 * @returns {HybridsearchObject}
                 */
                addPropertyFilter: function (property, value, scope, reverse, booleanmode, nodeType, fulltextmode) {

                    var self = this;
                    if (booleanmode === undefined) {
                        booleanmode = true;
                    }

                    if (fulltextmode === undefined) {
                        fulltextmode = false;
                    }

                    if (reverse === false || reverse === null) {
                        reverse = undefined;
                    }


                    if (booleanmode === false || booleanmode === null) {
                        booleanmode = undefined;
                    }


                    if (nodeType === false || nodeType === null) {
                        nodeType = undefined;
                    }

                    if (scope === false || scope === null) {
                        scope = undefined;
                    }


                    if (scope != undefined) {
                        self.$$app.getFilter().setScopeProperty(scope, value, 'propertyFilters');
                        scope.$watch(value, function (v, o) {
                            if (self.$$data.filterWasChangedOnce == false && v && v !== o) {
                                self.$$data.filterWasChangedOnce = true;
                            }
                            self.$$app.getFilter().addPropertyFilter(property, v, booleanmode, reverse, nodeType, fulltextmode);
                            self.$$app.setSearchIndex();
                        }, true);

                    } else {
                        self.$$app.getFilter().addPropertyFilter(property, value, booleanmode, reverse, nodeType, fulltextmode);

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


                    if (self.addedNodesByIdentifierIndex == undefined) {
                        self.addedNodesByIdentifierIndex = {};
                        self.addedNodesByIdentifierCounter = 0;
                    }

                    var execute = function (nodesArray) {
                        angular.forEach(nodesArray, function (node) {

                            self.addedNodesByIdentifierCounter++;
                            self.addedNodesByIdentifierIndex[node] = self.addedNodesByIdentifierCounter + 1;

                            self.$$app.getIndexByNodeIdentifier(node).once("value", function (data) {

                                if (data.val()) {
                                    var identifier = data.getKey();
                                    if (self.$$app.getConfig('realtime') == null) {
                                        self.$$app.getIndexByNodeIdentifierAndNodeType(identifier, data.val().nodeType).on("value", function (data) {
                                            self.$$app.addNodeByIdentifier(data.val(), self.addedNodesByIdentifierIndex[data.val().node.identifier]);
                                            self.$$app.addLocalIndex([data.val()]);
                                            self.$$app.search();
                                        });
                                    } else {
                                        self.$$app.getIndexByNodeIdentifierAndNodeType(identifier, data.val().nodeType).once("value", function (data) {
                                            self.$$app.addNodeByIdentifier(data.val(), self.addedNodesByIdentifierIndex[data.val().node.identifier]);
                                            self.$$app.addLocalIndex([data.val()]);
                                            self.$$app.search();
                                        });
                                    }
                                }


                            });


                        });


                    };


                    self.$$app.setIsNodesByIdentifier();

                    if (self.$$app.isRunning() === false) {
                        self.$$app.setIsRunning()
                    }

                    if (self.$$app.getHybridsearch().getBranch() === false) {
                        var counter = 0;
                        var branchInitInterval = setInterval(function () {
                            counter++;
                            if (counter > 10000 || self.$$app.getHybridsearch().getBranch()) {
                                clearInterval(branchInitInterval);
                                execute(nodesArray);
                            }

                        }, 5);
                    } else {
                        execute(nodesArray);
                    }


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
                            var datanodes = data.val();

                            if (datanodes) {


                                angular.forEach(datanodes, function (node) {
                                    addnodes.push(node);
                                });
                                self.$$app.addLocalIndex(addnodes);

                                if (timer !== false) {
                                    clearTimeout(timer);
                                }
                                timer = setTimeout(function () {
                                    self.$$app.search();
                                }, 5);
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
                 * Adds max imtem filter
                 * @param {integer} max results
                 * @param {scope} scope false if is simple string otherwise angular scope required for binding data
                 * @returns {HybridsearchObject}
                 */
                setLimit: function (limit, scope) {

                    var self = this;

                    if (scope != undefined) {
                        self.$$app.getFilter().$$data.maxResultsFilter = limit;
                        scope.$watch(limit, function (v) {
                            self.$$app.getFilter().$$data.maxResultsFilter = limit;
                        }, true);

                    } else {
                        self.$$app.getFilter().$$data.maxResultsFilter = limit;
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
                        scope.$watch(nodePath, function (filterNodeInput, filterNodeInputOld) {
                            if (self.$$data.filterWasChangedOnce == false && filterNodeInput && filterNodeInput !== filterNodeInputOld) {
                                self.$$data.filterWasChangedOnce = true;
                            }
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

                            if (self.$$data.filterWasChangedOnce == false && searchInput !== '' && searchInput !== searchInputLast) {
                                self.$$data.filterWasChangedOnce = true;
                            }


                            //  if (searchInput !== searchInputLast) {
                            self.$$app.getFilter().setQuery(scope[input]);

                            if (scope[input] !== '' && self.$$app.isRunning() === false) {
                                self.run();
                            }
                            if (searchInput !== undefined) {
                                if (searchInput.length === 0) {

                                    self.$$app.getFilter().resetQuery();
                                    self.$$app.setNodesLastHash(1);
                                    self.$$app.clearLocationHash();
                                }

                                self.$$app.setSearchIndex();

                            }

                            // }


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
                 * Load nodes form local storage (saved before using save() method)
                 * @param {string} identifier
                 * @param {array} excludedScopeProperties don't apply given scope property names
                 * @returns {$hybridsearchResultsObject|*}
                 */
                load: function (identifier, excludedScopeProperties) {
                    this.$$app.loadNodesFromLocalStorage(identifier == undefined || !identifier ? Sha1.hash($location.$$absUrl + this.$$app.getHybridsearchInstanceNumber()) : identifier, excludedScopeProperties);
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
                 * Sets external sources
                 * @param {object} external sources
                 *    }
                 * @returns {$hybridsearchResultsObject|*}
                 */
                setExternalSources: function (externalsources) {
                    var self = this;
                    self.$$app.setExternalSources(externalsources);
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
                 * Sets parent node type boost.
                 * @param {object} NodeUrlBoostFactor
                 * @example var NodeUrlBoostFactor = {
                 *        'about-us': 0.5,
                 *        'products': 1.5
                 *    }
                 * @returns {$hybridsearchResultsObject|*}
                 */
                setNodeUrlBoostFactor: function (NodeUrlBoostFactor) {
                    var self = this;
                    self.$$app.setNodeUrlBoostFactor(NodeUrlBoostFactor);
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


            /**
             * @param {HybridsearchObject} HybridsearchObject
             * @param string identifier (optional)
             * @param boolean savenodes or not
             * @constructor HybridsearchSnapshotObject
             */
            var HybridsearchSnapshotObject = function (HybridsearchObject, identifier) {

                this.$$data = {
                    identifier: identifier
                };

                Object.defineProperty(this, '$$data', {
                    value: this.$$data
                });


                if (identifier == undefined && HybridsearchObject.$$app.getHybridsearchInstanceNumber() == undefined) {
                    return this;
                }


                var filename = identifier == undefined ? Sha1.hash(window.location.pathname + HybridsearchObject.$$app.getHybridsearchInstanceNumber()) : identifier;

                this.$$data.identifier = filename;
                var storage = {};
                var scope = HybridsearchObject.getScope();

                var scopeCopy = {};
                angular.forEach(scope, function (value, key) {

                    if (key.substr(0, 1) !== '$' && key.substr(0, 1) !== '_' && typeof value !== 'function') {

                        var serialized = null;

                        try {
                            serialized = angular.toJson(value)
                        } catch (e) {
                        }

                        if (serialized !== {}) {
                            scopeCopy[key] = value;
                        }
                    }

                });


                storage['scope'] = scopeCopy;

                if (jQuery != undefined) {
                    storage['scrollTop'] = jQuery(window).scrollTop();
                }

                if ($ != undefined) {
                    storage['scrollTop'] = $(window).scrollTop();
                }

                $window.localStorage[filename] = angular.toJson(storage);

                return this;

            }

            HybridsearchSnapshotObject.prototype = {

                /**
                 * return the snapshot val
                 */
                getIdentifier: function () {
                    return this.$$data.identifier;
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
     * @private
     * @module Angular results module
     * @returns {HybridsearchResultsObject}
     */
    angular.module('hybridsearch.results').factory('$hybridsearchResultsObject', ['$window',

        function ($window) {


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
                 * Get groups label.
                 * @returns {string} Group label
                 */
                getHashKey: function () {
                    return this.$$hashKey.substr(this.$$hashKey.indexOf(":") + 1);
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
                 * Get all nodes for this group from current search result.
                 * @param {integer} limit max results
                 * @returns {array} collection of {HybridsearchResultsNode}
                 */
                getTest: function (limit) {
                    console.log(this);
                },

                /**
                 * Get all nodes grouped by given facet.
                 * @param {categorizedBy} string
                 * @returns {array} collection of {HybridsearchResultsDataObject}
                 */
                getCategorizedNodes: function (categorizedBy, limit) {

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
                var externalSources = {};
                var nodeTypeProperties = {};

                /**
                 * HybridsearchResultsDataObject
                 * @constructor
                 */
                var HybridsearchResultsDataObject = function () {
                    // initialize local storage results
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
                    isStartedFirstTime: false,
                    quicknodes: [],
                    isrunningfirsttimestamp: 0,
                    autocomplete: [],
                    autocompleteKeys: {},
                    distinctsConfiguration: {},
                    unfilteredResultNodes: [],
                    identifier: generateUUID()

                };


                this.$$app = {


                    /**
                     * @private
                     * @param node
                     * @returns boolean
                     */
                    addQuickNode: function (node) {
                        self.$$data.quicknodes = [];
                        self.$$data.quicknodes.push(node);
                        this.executeCallbackMethod(self);
                    },

                    /**
                     * @private
                     * @returns boolean
                     */
                    clearQuickNodes: function () {
                        self.$$data.quicknodes = [];
                        this.executeCallbackMethod(self);
                    },

                    /**
                     * @private
                     */
                    setIsStartedFirstTime: function () {

                        self.$$data.isStartedFirstTime = true;
                    },


                    /**
                     * @private
                     * @param results
                     * @param nodes
                     * @param obj
                     * @param caller
                     * @param boolean skipAutocompleteUpdate

                     */
                    setResults: function (results, nodes, object, skipAutocompleteUpdate, caller) {

                        if (self.$$data.isStartedFirstTime == false) {
                            this.setIsStartedFirstTime();
                        }

                        if (self.isStarted()) {
                            this.clearResults();

                        }
                        self.$$data.nodes = nodes;

                        angular.forEach(results, function (val, key) {

                            var sorteable = [];

                            if (key !== '_nodes') {

                                angular.forEach(val, function (v, k) {
                                    if (key === '_nodesByType') {
                                        v.group = k;
                                        sorteable.push(v);
                                    } else {
                                        if (key === '_nodesOrdered') {
                                            sorteable.push(results['_nodes'][v.hash]);
                                        } else {
                                            sorteable.push(v);
                                        }
                                    }
                                });
                                if (key == '_nodesOrdered') {
                                    self.$$data.results['_nodes'] = sorteable;
                                } else {
                                    self.$$data.results[key] = sorteable;
                                }

                            }


                        });

                        self.$$data.searchCounter++;

                        if (self.isStarted()) {
                            self.getApp().setNotFound(false);
                            self.updateNodesGroupedBy();
                            this.executeCallbackMethod(self);
                            if (skipAutocompleteUpdate !== true) {
                                self.updateAutocomplete(null, null, caller);
                            }
                        }

                        return self;

                    },
                    /**
                     * @private
                     */
                    clearResults: function () {

                        if (self.$$data.results['_nodes'] == undefined || self.$$data.results['_nodes'].length > 0) {
                            self.$$data.results = new HybridsearchResultsDataObject();
                            self.$$data.groups = new HybridsearchResultsGroupObject();
                            self.$$data.notfound = false;
                            self.$$data.quickinfo = false;
                            return true;
                        } else {
                            return false;
                        }

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
                                selfthis.getScope().$apply(function () {
                                });
                            }, 1);
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
                     * @param string identifier
                     * @returns scope
                     */
                    applyScope: function () {

                        var self = this;
                        if (self.getScope() !== undefined) {
                            setTimeout(function () {
                                self.getScope().$digest(function () {
                                });
                            }, 1);
                        }
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
                                self.getScope().$apply(function () {
                                });
                            }, 1);


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
                    getExternalSources: function () {
                        return externalSources;
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


                var items = {};
                items['_nodes'] = {};
                items['_nodesOrdered'] = [];
                items['_nodesTurbo'] = {};
                items['_nodesByType'] = {};
                items['_nodesGroupedBy'] = {};


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

                    var ids = [];
                    var eachNodes = this.getNodes();

                    angular.forEach(eachNodes, function (node) {
                        ids.push(node.getIdentifier());
                    });


                    return Sha1.hash(JSON.stringify(ids));
                },
                /**
                 *
                 * Get uui of current search result instance
                 * @returns {string} uuid
                 */
                getIdentifier: function () {
                    return this.$$data.identifier;
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

                    //
                    // if (this.$$data.isrunningfirsttimestamp === 0) {
                    //     return false;
                    // } else {
                    //     if (this.$$data.isrunningfirsttimestamp > 0) {
                    //         if (Date.now() - this.$$data.isrunningfirsttimestamp < 100) {
                    //             //return false;
                    //         } else {
                    //             this.$$data.isrunningfirsttimestamp = -1;
                    //         }
                    //     }
                    // }

                    if (this.$$data.searchCounter === 0) {
                        return false;
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
                            var tsplit = s.split(" ");
                            angular.forEach(tsplit, function (term) {
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
                            } else {
                                if (this.getNodes(2)[1].getScore() / this.getNodes(1)[0].getScore() > 1) {
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
                 * @param {string} groupedBy group/distinct by property
                 * @returns {array} collection of {HybridsearchResultsNode}
                 */
                getNodes: function (limit, groupedBy) {

                    if (groupedBy == undefined) {
                        //
                    } else {
                        var ghash = Sha1.hash(groupedBy);

                        if (this.$$data.distinctsConfiguration[groupedBy] == undefined) {
                            this.$$data.distinctsConfiguration[groupedBy] = {
                                'limit': limit,
                                'distinctsFromGetResults': true
                            }
                        }

                        // if (this.$$data._nodesGroupedBy[ghash] !== undefined) {
                        //     return this.$$data._nodesGroupedBy[ghash].slice(0, limit);
                        // } else {
                        //     return [];
                        // }

                    }


                    return this.getData()._nodes === undefined ? null : (limit === undefined ? this.getData()._nodes : this.getData()._nodes.slice(0, limit) );


                },
                /**
                 * Get all nodes from current search result.
                 * @returns {array} collection of {HybridsearchResultsDataObject}
                 */
                getQuickNodes: function () {
                    return this.$$data.quicknodes;
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
                 * get auto complete
                 * @returns {array}
                 */
                getAutocomplete: function () {
                    return this.$$data.autocomplete;
                },
                /**
                 * get auto complete count
                 * @returns {integer}
                 */
                countAutocomplete: function () {
                    return this.$$data.autocomplete.length;
                },

                /**
                 * update auto complete
                 * @param {array}
                 * @param {string}
                 * @param caller
                 * @returns {HybridsearchResultsObject}
                 */
                updateAutocomplete: function (autocomplete, querysegment, caller) {

                    var self = this;

                    if (!autocomplete) {
                        autocomplete = {};
                    }

                    if (!querysegment) {
                        querysegment = '';
                    }

                    var query = self.getApp().getScope()['__query'] ? self.getApp().getScope()[self.getApp().getScope()['__query']] : querysegment;

                    angular.forEach(Object.keys(autocomplete), function (a) {
                        a = a.replace(/-/g, " ").trim();
                        if (self.$$data.autocompleteKeys[a] == undefined) {
                            self.$$data.autocompleteKeys[a] = true;
                        }
                    });

                    self.$$data.autocomplete = [];
                    var autocompleteTemp = {};

                    var counter = 0;
                    angular.forEach(Object.keys(self.$$data.autocompleteKeys).sort(), function (a) {
                        if (query.toLowerCase() !== a.toLowerCase() && a.indexOf(query) == 0 && autocompleteTemp[a.substr(0, a.length - 1)] == undefined && autocompleteTemp[a.substr(0, a.length - 2)] == undefined && autocompleteTemp[a] == undefined) {
                            self.$$data.autocomplete.push(a);
                            autocompleteTemp[a.substr(0, a.length - 1)] = true;
                            autocompleteTemp[a.substr(0, a.length - 2)] = true;
                            autocompleteTemp[a] = true;
                        }
                        counter++;
                    });

                    var foundinproperty = null;
                    angular.forEach(self.getNodes(20), function (node) {
                        if (foundinproperty === null) {
                            angular.forEach(node.getProperties(), function (value, property) {
                                if (foundinproperty === null && query && typeof value == 'string' && value.toLowerCase().substr(0, query.length) == query) {
                                    if (value.toLowerCase() !== query.toLowerCase() && value.indexOf(".") == -1 && value.indexOf(",") == -1) {
                                        foundinproperty = property;
                                    }
                                }
                            });
                        }
                    });

                    if (foundinproperty === null) {
                        foundinproperty = '_nodeLabel';
                    }


                    angular.forEach(self.getNodes(20), function (node) {

                        var a = node.getProperty(foundinproperty);

                        if (a.length < 50 && (caller == undefined || caller.isFiltered(node) == false)) {
                            var i = a.toLowerCase().indexOf(query.toLowerCase());
                            var b = a.substr(i).toLowerCase();
                            if (b == query.toLowerCase() && i >= 0) {
                                b = a.substr(0, i + query.length).toLowerCase();
                            }
                            if (b.length > query.length && query.toLowerCase() !== b && autocompleteTemp[b] == undefined && i >= -1 && i < 25) {
                                self.$$data.autocomplete.push(b);
                                autocompleteTemp[b] = true;
                            }
                        }
                    });

                    self.$$data.autocomplete.sort();

                    this.getApp().applyScope();
                    return this;
                },

                /**
                 * update distincts
                 * @param  {array} collection of {HybridsearchResultsNode} unfiltered result
                 * @returns {HybridsearchResultsObject}
                 */
                updateDistincts: function (unfilteredResultNodes) {

                    var self = this;
                    this.clearDistincts();

                    this.$$data.unfilteredResultNodes = unfilteredResultNodes;

                    angular.forEach(this.$$data.distincts, function (val, key) {
                        self.getDistinct(key);
                    });

                    return this;

                },

                /**
                 * update grouped nodes
                 * @param {string} groupedBy
                 * @param {integer} limit
                 * @returns {HybridsearchResultsObject}
                 */
                updateNodesGroupedBy: function (groupedBy, limit) {

                    var self = this;


                    if (self.$$data._nodesGroupedBy == undefined) {
                        self.$$data._nodesGroupedBy = {};
                    }


                    angular.forEach(self.$$data.distinctsConfiguration, function (distinct, property) {

                        if (distinct.distinctsFromGetResults !== undefined) {
                            if (groupedBy == undefined || groupedBy == property) {

                                if (self.$$data.distincts !== undefined) {
                                    delete self.$$data.distincts[property];
                                }

                                var ghash = Sha1.hash(property);
                                var n = [];

                                var d = self.getDistinct(property, false, true, false, self.$$data.distinctsConfiguration[property].limit, true);


                                angular.forEach(d, function (group, hash) {

                                    group.nodes[0].clearGroupedByNodeType();

                                    if (group.nodes[1] !== undefined && group.nodes[1].nodeType == group.nodes[0].nodeType) {
                                        // dont group nodes with same node type
                                        angular.forEach(group.nodes, function (node, h) {
                                            n.push(node);
                                        });
                                    } else {


                                        angular.forEach(group.nodes, function (groupnode, h) {
                                            if (h > 0) {
                                                group.nodes[0].addGroupedByNodeType(groupnode, ghash);
                                            }
                                        });
                                        n.push(group.nodes[0]);
                                    }

                                });

                                self.$$data._nodesGroupedBy[ghash] = n;

                            }
                        }

                    });

                    return this;

                },
                /**
                 * clear distincts
                 * @returns {void}
                 */
                clearDistincts: function () {

                    var self = this;

                    angular.forEach(self.$$data.distincts, function (distinct, property) {
                        if (self.$$data.distinctsConfiguration[property].affectedBySearchResult) {
                            delete self.$$data.distincts[property];
                        }

                    });

                    self.getApp().applyScope();

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
                 * @param {boolean} affectedBySearchResult dont affect current search result to distinct
                 * @returns {integer} count collection of property values
                 */
                getDistinctCount: function (property, affectedBySearchResult) {
                    return Object.keys(this.getDistinct(property, affectedBySearchResult)).length;
                },
                /**
                 * Check if given value string is in distinct result
                 * @param {string} property
                 * @param {value} string search for
                 * @returns {boolean} true if value is part of distinct property values
                 */
                isInDistinct: function (property, value) {

                    var found = false;
                    var foreachDistinct = this.getDistinct(property);
                    angular.forEach(foreachDistinct, function (o) {
                        if (o.value == value) {
                            found = true;
                            return found;
                        }
                    });

                    return found;


                }
                ,
                /**
                 * Get all different values and counter from given property
                 * @param {string} property
                 * @param {boolean} affectedBySearchResult dont affect current search result to distinct
                 * @param {boolean} counterGroupedByNode count existences grouped by node
                 * @param {boolean} valuesOnly return only values
                 * @param {integer} limit return only limit nodes
                 * @param {boolean} distinctsFromGetResults
                 * @returns {array} collection of property values
                 */
                getDistinct: function (property, affectedBySearchResult, counterGroupedByNode, valuesOnly, limit, distinctsFromGetResults) {


                    var self = this, variants = {}, variantsByNodes = {}, propvalue = '', variantsfinal = [];


                    if (self.$$data.distinctsConfiguration[property] == undefined) {
                        self.$$data.distinctsConfiguration[property] = {
                            counterGroupedByNode: counterGroupedByNode == undefined || counterGroupedByNode == null ? false : counterGroupedByNode,
                            valuesOnly: valuesOnly == undefined || valuesOnly == null ? false : valuesOnly,
                            affectedBySearchResult: affectedBySearchResult == undefined || affectedBySearchResult == null ? true : affectedBySearchResult,
                            limit: limit,
                            distinctsFromGetResults: distinctsFromGetResults
                        };
                    }

                    if (self.$$data.distincts == undefined) {
                        self.$$data.distincts = {};
                    }

                    if (self.$$data.distincts[property] == undefined) {
                        self.$$data.distincts[property] = {};
                    }


                    if (Object.keys(self.$$data.distincts[property]).length) {


                        if (limit == undefined) {
                            if (self.$$data.distinctsConfiguration[property].valuesOnly === false) {
                                return self.$$data.distincts[property];
                            } else {
                                var v = [];
                                angular.forEach(self.$$data.distincts[property], function (i) {
                                    v.push(i.value);
                                });
                                return v;
                            }
                        }

                    }


                    if (self.$$data.distinctsConfiguration[property].distinctsFromGetResults) {
                        var eachResultNodes = this.getNodes();
                        var storeGroupedNodes = true;
                    } else {
                        var eachResultNodes = self.$$data.unfilteredResultNodes.length == 0 ? this.getNodes() : self.$$data.unfilteredResultNodes;
                        var storeGroupedNodes = false;
                    }

                    angular.forEach(eachResultNodes, function (node) {

                        if (self.$$data.distinctsConfiguration[property]['affectedBySearchResult'] == false || node['_isfiltered'] == undefined || node['_isfiltered'][property] === false || node['_isfiltered'][property] === undefined) {
                            variantsByNodes[node.identifier] = {};
                            propvalue = self.getPropertyFromNode(node, property);


                            if (typeof propvalue == 'object') {

                                // force array
                                if (propvalue && propvalue.length === undefined) {
                                    propvalue = [propvalue];
                                }
                                angular.forEach(propvalue, function (v, k) {

                                    if (v !== undefined) {
                                        var k = Sha1.hash(JSON.stringify(v));

                                        variants[k] = {
                                            id: k,
                                            property: property,
                                            value: v,
                                            nodes: variants[k] == undefined ? [] : variants[k].nodes,
                                            maxScore: variants[k] === undefined ? node.getScore() : (variants[k].maxScore < node.getScore() ? node.getScore() : variants[k].maxScore),
                                            count: variants[k] === undefined ? 1 : (!self.$$data.distinctsConfiguration[property].counterGroupedByNode || variantsByNodes[node.identifier][k] === undefined ? variants[k].count + 1 : variants[k].count)
                                        };

                                        if (storeGroupedNodes) {
                                            variants[k].nodes.push(node);
                                        }


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
                                                id: k,
                                                property: property,
                                                value: valueJson,
                                                nodes: variants[k] == undefined ? [] : variants[k].nodes,
                                                maxScore: variants[k] === undefined ? node.getScore() : (variants[k].maxScore < node.getScore() ? node.getScore() : variants[k].maxScore),
                                                count: variants[k] === undefined ? 1 : (!self.$$data.distinctsConfiguration[property].counterGroupedByNode || variantsByNodes[node.identifier][k] === undefined ? variants[k].count + 1 : variants[k].count)
                                            };
                                            variantsByNodes[node.identifier][k] = true;
                                            if (storeGroupedNodes) {
                                                variants[k].nodes.push(node);
                                            }


                                        } else {
                                            // treat variants as array
                                            angular.forEach(valueJson, function (variant) {
                                                var k = Sha1.hash(JSON.stringify(variant));

                                                variants[k] = {
                                                    id: k,
                                                    property: property,
                                                    value: variant,
                                                    nodes: variants[k] == undefined ? [] : variants[k].nodes,
                                                    maxScore: variants[k] === undefined ? node.getScore() : (variants[k].maxScore < node.getScore() ? node.getScore() : variants[k].maxScore),
                                                    count: variants[k] === undefined ? 1 : (!self.$$data.distinctsConfiguration[property].counterGroupedByNode || variantsByNodes[node.identifier][k] === undefined ? variants[k].count + 1 : variants[k].count)
                                                };
                                                variantsByNodes[node.identifier][k] = true;
                                                if (storeGroupedNodes) {
                                                    variants[k].nodes.push(node);
                                                }
                                            });
                                        }


                                    } else {

                                        var k = Sha1.hash(JSON.stringify(propvalue));


                                        variants[k] = {
                                            id: k,
                                            property: property,
                                            value: propvalue,
                                            nodes: variants[k] == undefined ? [] : variants[k].nodes,
                                            maxScore: variants[k] === undefined ? node.getScore() : (variants[k].maxScore < node.getScore() ? node.getScore() : variants[k].maxScore),
                                            count: variants[k] === undefined ? 1 : (!self.$$data.distinctsConfiguration[property].counterGroupedByNode || variantsByNodes[node.identifier][k] === undefined ? variants[k].count + 1 : variants[k].count)
                                        };
                                        variantsByNodes[node.identifier][k] = true;
                                        if (storeGroupedNodes) {
                                            variants[k].nodes.push(node);
                                        }

                                    }


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


                    if (valuesOnly === undefined || valuesOnly === false) {
                        return self.$$data.distincts[property];
                    } else {

                        var v = [];
                        angular.forEach(self.$$data.distincts[property], function (i) {
                            v.push(i.value);
                        });
                        return v;
                    }


                }
                ,

                /**
                 * @private
                 * @param {object}
                 * @param {string} property
                 * @returns {mixed}
                 */
                getPropertyFromObject: function (object, property) {

                    return window.HybridsearchGetPropertyFromObject(object, property);


                }
                ,


                /**
                 * @private
                 * Get property.
                 * @param {string} property Get single property from node data.
                 * @returns {mixed}
                 */
                getPropertyFromNode: function (node, property) {

                    return window.HybridsearchGetPropertyFromNode(node, property);

                }
                ,

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
                    var eachGetDataNodesByType = this.getData()._nodesByType;
                    angular.forEach(eachGetDataNodesByType, function (result, key) {

                        if (Object.keys(result).length > 1) {
                            self.$$data.groups.addItem(result.group, result);
                        }

                    });


                    return self.$$data.groups;
                }
                ,


            };


            return HybridsearchResultsObject;
        }
    ])
    ;


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


                    var normalizeNodeType = function (nodetype) {
                        return nodetype.replace(/[:\.]/g, '-').toLowerCase();
                    }

                    if (typeof nodeType == 'object' && nodeType.length == 1) {
                        this.$$data.nodeType = normalizeNodeType(nodeType[0]);
                        return this;
                    }

                    if (typeof nodeType == 'object') {
                        angular.forEach(nodeType, function (val) {
                            val = normalizeNodeType(val);
                        });
                    }

                    if (typeof nodeType == 'string') {
                        nodeType = normalizeNodeType(nodeType);
                    }

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

                    if (this.$$data.scope == undefined && scope !== undefined) {
                        this.$$data.scope = scope;
                    }
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
                 * @param string identifier
                 * @returns scope
                 */
                getScope: function () {

                    return this.$$data.scope;
                },


                /**
                 * @param string identifier
                 * @returns scope
                 */
                isScopePropertyUsedAsFilter: function (property) {

                    var check = false;

                    angular.forEach(this.$$data.scopeProperties, function (values, keys) {
                        angular.forEach(values, function (value, key) {

                            if (property == key.substr(0, property.length)) {
                                check = true;
                                return check;
                            }

                        });

                    });

                    return check;


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
                 * @param boolean fulltextmode (true if search in fulltext mode)
                 * @returns HybridsearchObject
                 */
                addPropertyFilter: function (property, value, booleanmode, reverse, nodeType, fulltextmode) {


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
                        nodeType: nodeType,
                        fulltextmode: fulltextmode
                    };


                    return this;
                },


                /**
                 * @param integer value
                 * @returns HybridsearchObject
                 */
                setMaxResultsFilter: function (value) {
                    if (this.$$data.maxResultsFilter == undefined) {
                        this.$$data.maxResultsFilter = {};
                    }
                    this.$$data.maxResultsFilter = value;
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


                    if (this.getQuery() == '') {
                        return false;
                    }

                    var q = this.getQuery();
                    q = typeof q == 'string' ? q.trim() : q;

                    return q == undefined || q == 'undefined' ? false : q;

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
                    var self = this;

                    // get unique
                    var uniquarray = [];

                    if (lastSearchInstance.$$data !== undefined) {
                        angular.forEach(lastSearchInstance.$$data.keywords, function (q) {
                                if (q.term !== q.metaphone) {
                                    uniquarray.push(q.term);
                                }
                            }
                        );
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
                 * @returns string
                 */
                getQueryLogStoreHash: function () {

                    var a = this.getQuery().toLowerCase().replace(/[^\w()/%\-&üöäÜÖÄ]/gi, '');
                    var q = metaphone(a, 10);
                    q = a.substr(0, 5) + q;
                    return q.substr(0, 10).toUpperCase();

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
                    var t = s.replace(/([0-9-])( )/i, '$1').replace(/([0-9]{2})/gi, ' $1 ');

                    s = s + " " + t;
                    s = s.toLowerCase();

                    angular.forEach(s.split(" "), function (term) {
                        term = term.replace(filterReg, "");
                        if (term.length > 0) keywords[term] = true;
                    });

                    var finalkeywords = [];
                    angular.forEach(keywords, function (a, t) {
                        if (t.length > 1) {
                            finalkeywords.push(t);
                        }
                    });

                    return finalkeywords;

                }

            };


            return HybridsearchFilterObject;
        }
    ]);


})();

var generateUUID = function () {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
};


/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/* xxHash implementation in pure Javascript /*
 /*                                                                                  /*
 /* Copyright (C) 2013, Pierre Curto /*
 * MIT license                                                                                     /*
 /* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

var XXH = function (t) {
    function r(e) {
        if (i[e])return i[e].exports;
        var h = i[e] = {exports: {}, id: e, loaded: !1};
        return t[e].call(h.exports, h, h.exports, r), h.loaded = !0, h.exports
    }

    var i = {};
    return r.m = t, r.c = i, r.p = "", r(0)
}([function (t, r, i) {
    t.exports = {h32: i(1), h64: i(9)}
}, function (t, r, i) {
    (function (r) {
        function e(t) {
            for (var r = [], i = 0, e = t.length; e > i; i++) {
                var h = t.charCodeAt(i);
                128 > h ? r.push(h) : 2048 > h ? r.push(192 | h >> 6, 128 | 63 & h) : 55296 > h || h >= 57344 ? r.push(224 | h >> 12, 128 | h >> 6 & 63, 128 | 63 & h) : (i++, h = 65536 + ((1023 & h) << 10 | 1023 & t.charCodeAt(i)), r.push(240 | h >> 18, 128 | h >> 12 & 63, 128 | h >> 6 & 63, 128 | 63 & h))
            }
            return new Uint8Array(r)
        }

        function h() {
            return 2 == arguments.length ? new h(arguments[1]).update(arguments[0]).digest() : this instanceof h ? void o.call(this, arguments[0]) : new h(arguments[0])
        }

        function o(t) {
            return this.seed = t instanceof n ? t.clone() : n(t), this.v1 = this.seed.clone().add(s).add(a), this.v2 = this.seed.clone().add(a), this.v3 = this.seed.clone(), this.v4 = this.seed.clone().subtract(s), this.total_len = 0, this.memsize = 0, this.memory = null, this
        }

        var n = i(6).UINT32;
        n.prototype.xxh_update = function (t, r) {
            var i, e, h = a._low, o = a._high;
            e = t * h, i = e >>> 16, i += r * h, i &= 65535, i += t * o;
            var n = this._low + (65535 & e), u = n >>> 16;
            u += this._high + (65535 & i);
            var f = u << 16 | 65535 & n;
            f = f << 13 | f >>> 19, n = 65535 & f, u = f >>> 16, h = s._low, o = s._high, e = n * h, i = e >>> 16, i += u * h, i &= 65535, i += n * o, this._low = 65535 & e, this._high = 65535 & i
        };
        var s = n("2654435761"), a = n("2246822519"), u = n("3266489917"), f = n("668265263"), l = n("374761393");
        h.prototype.init = o, h.prototype.update = function (t) {
            var i, h = "string" == typeof t;
            h && (t = e(t), h = !1, i = !0), "undefined" != typeof ArrayBuffer && t instanceof ArrayBuffer && (i = !0, t = new Uint8Array(t));
            var o = 0, n = t.length, s = o + n;
            if (0 == n)return this;
            if (this.total_len += n, 0 == this.memsize && (this.memory = h ? "" : i ? new Uint8Array(16) : new r(16)), this.memsize + n < 16)return h ? this.memory += t : i ? this.memory.set(t.subarray(0, n), this.memsize) : t.copy(this.memory, this.memsize, 0, n), this.memsize += n, this;
            if (this.memsize > 0) {
                h ? this.memory += t.slice(0, 16 - this.memsize) : i ? this.memory.set(t.subarray(0, 16 - this.memsize), this.memsize) : t.copy(this.memory, this.memsize, 0, 16 - this.memsize);
                var a = 0;
                h ? (this.v1.xxh_update(this.memory.charCodeAt(a + 1) << 8 | this.memory.charCodeAt(a), this.memory.charCodeAt(a + 3) << 8 | this.memory.charCodeAt(a + 2)), a += 4, this.v2.xxh_update(this.memory.charCodeAt(a + 1) << 8 | this.memory.charCodeAt(a), this.memory.charCodeAt(a + 3) << 8 | this.memory.charCodeAt(a + 2)), a += 4, this.v3.xxh_update(this.memory.charCodeAt(a + 1) << 8 | this.memory.charCodeAt(a), this.memory.charCodeAt(a + 3) << 8 | this.memory.charCodeAt(a + 2)), a += 4, this.v4.xxh_update(this.memory.charCodeAt(a + 1) << 8 | this.memory.charCodeAt(a), this.memory.charCodeAt(a + 3) << 8 | this.memory.charCodeAt(a + 2))) : (this.v1.xxh_update(this.memory[a + 1] << 8 | this.memory[a], this.memory[a + 3] << 8 | this.memory[a + 2]), a += 4, this.v2.xxh_update(this.memory[a + 1] << 8 | this.memory[a], this.memory[a + 3] << 8 | this.memory[a + 2]), a += 4, this.v3.xxh_update(this.memory[a + 1] << 8 | this.memory[a], this.memory[a + 3] << 8 | this.memory[a + 2]), a += 4, this.v4.xxh_update(this.memory[a + 1] << 8 | this.memory[a], this.memory[a + 3] << 8 | this.memory[a + 2])), o += 16 - this.memsize, this.memsize = 0, h && (this.memory = "")
            }
            if (s - 16 >= o) {
                var u = s - 16;
                do h ? (this.v1.xxh_update(t.charCodeAt(o + 1) << 8 | t.charCodeAt(o), t.charCodeAt(o + 3) << 8 | t.charCodeAt(o + 2)), o += 4, this.v2.xxh_update(t.charCodeAt(o + 1) << 8 | t.charCodeAt(o), t.charCodeAt(o + 3) << 8 | t.charCodeAt(o + 2)), o += 4, this.v3.xxh_update(t.charCodeAt(o + 1) << 8 | t.charCodeAt(o), t.charCodeAt(o + 3) << 8 | t.charCodeAt(o + 2)), o += 4, this.v4.xxh_update(t.charCodeAt(o + 1) << 8 | t.charCodeAt(o), t.charCodeAt(o + 3) << 8 | t.charCodeAt(o + 2))) : (this.v1.xxh_update(t[o + 1] << 8 | t[o], t[o + 3] << 8 | t[o + 2]), o += 4, this.v2.xxh_update(t[o + 1] << 8 | t[o], t[o + 3] << 8 | t[o + 2]), o += 4, this.v3.xxh_update(t[o + 1] << 8 | t[o], t[o + 3] << 8 | t[o + 2]), o += 4, this.v4.xxh_update(t[o + 1] << 8 | t[o], t[o + 3] << 8 | t[o + 2])), o += 4; while (u >= o)
            }
            return s > o && (h ? this.memory += t.slice(o) : i ? this.memory.set(t.subarray(o, s), this.memsize) : t.copy(this.memory, this.memsize, o, s), this.memsize = s - o), this
        }, h.prototype.digest = function () {
            var t, r, i = this.memory, e = "string" == typeof i, h = 0, o = this.memsize, c = new n;
            for (t = this.total_len >= 16 ? this.v1.rotl(1).add(this.v2.rotl(7).add(this.v3.rotl(12).add(this.v4.rotl(18)))) : this.seed.clone().add(l), t.add(c.fromNumber(this.total_len)); o - 4 >= h;)e ? c.fromBits(i.charCodeAt(h + 1) << 8 | i.charCodeAt(h), i.charCodeAt(h + 3) << 8 | i.charCodeAt(h + 2)) : c.fromBits(i[h + 1] << 8 | i[h], i[h + 3] << 8 | i[h + 2]), t.add(c.multiply(u)).rotl(17).multiply(f), h += 4;
            for (; o > h;)c.fromBits(e ? i.charCodeAt(h++) : i[h++], 0), t.add(c.multiply(l)).rotl(11).multiply(s);
            return r = t.clone().shiftRight(15), t.xor(r).multiply(a), r = t.clone().shiftRight(13), t.xor(r).multiply(u), r = t.clone().shiftRight(16), t.xor(r), this.init(this.seed), t
        }, t.exports = h
    }).call(r, i(2).Buffer)
}, function (t, r, i) {
    (function (t, e) {
        "use strict";
        function h() {
            function t() {
            }

            try {
                var r = new Uint8Array(1);
                return r.foo = function () {
                    return 42
                }, r.constructor = t, 42 === r.foo() && r.constructor === t && "function" == typeof r.subarray && 0 === r.subarray(1, 1).byteLength
            } catch (i) {
                return !1
            }
        }

        function o() {
            return t.TYPED_ARRAY_SUPPORT ? 2147483647 : 1073741823
        }

        function t(r) {
            return this instanceof t ? (t.TYPED_ARRAY_SUPPORT || (this.length = 0, this.parent = void 0), "number" == typeof r ? n(this, r) : "string" == typeof r ? s(this, r, arguments.length > 1 ? arguments[1] : "utf8") : a(this, r)) : arguments.length > 1 ? new t(r, arguments[1]) : new t(r)
        }

        function n(r, i) {
            if (r = d(r, 0 > i ? 0 : 0 | _(i)), !t.TYPED_ARRAY_SUPPORT)for (var e = 0; i > e; e++)r[e] = 0;
            return r
        }

        function s(t, r, i) {
            ("string" != typeof i || "" === i) && (i = "utf8");
            var e = 0 | g(r, i);
            return t = d(t, e), t.write(r, i), t
        }

        function a(r, i) {
            if (t.isBuffer(i))return u(r, i);
            if (Q(i))return f(r, i);
            if (null == i)throw new TypeError("must start with number, buffer, array or string");
            if ("undefined" != typeof ArrayBuffer) {
                if (i.buffer instanceof ArrayBuffer)return l(r, i);
                if (i instanceof ArrayBuffer)return c(r, i)
            }
            return i.length ? m(r, i) : p(r, i)
        }

        function u(t, r) {
            var i = 0 | _(r.length);
            return t = d(t, i), r.copy(t, 0, 0, i), t
        }

        function f(t, r) {
            var i = 0 | _(r.length);
            t = d(t, i);
            for (var e = 0; i > e; e += 1)t[e] = 255 & r[e];
            return t
        }

        function l(t, r) {
            var i = 0 | _(r.length);
            t = d(t, i);
            for (var e = 0; i > e; e += 1)t[e] = 255 & r[e];
            return t
        }

        function c(r, i) {
            return t.TYPED_ARRAY_SUPPORT ? (i.byteLength, r = t._augment(new Uint8Array(i))) : r = l(r, new Uint8Array(i)), r
        }

        function m(t, r) {
            var i = 0 | _(r.length);
            t = d(t, i);
            for (var e = 0; i > e; e += 1)t[e] = 255 & r[e];
            return t
        }

        function p(t, r) {
            var i, e = 0;
            "Buffer" === r.type && Q(r.data) && (i = r.data, e = 0 | _(i.length)), t = d(t, e);
            for (var h = 0; e > h; h += 1)t[h] = 255 & i[h];
            return t
        }

        function d(r, i) {
            t.TYPED_ARRAY_SUPPORT ? (r = t._augment(new Uint8Array(i)), r.__proto__ = t.prototype) : (r.length = i, r._isBuffer = !0);
            var e = 0 !== i && i <= t.poolSize >>> 1;
            return e && (r.parent = V), r
        }

        function _(t) {
            if (t >= o())throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + o().toString(16) + " bytes");
            return 0 | t
        }

        function y(r, i) {
            if (!(this instanceof y))return new y(r, i);
            var e = new t(r, i);
            return delete e.parent, e
        }

        function g(t, r) {
            "string" != typeof t && (t = "" + t);
            var i = t.length;
            if (0 === i)return 0;
            for (var e = !1; ;)switch (r) {
                case"ascii":
                case"binary":
                case"raw":
                case"raws":
                    return i;
                case"utf8":
                case"utf-8":
                    return j(t).length;
                case"ucs2":
                case"ucs-2":
                case"utf16le":
                case"utf-16le":
                    return 2 * i;
                case"hex":
                    return i >>> 1;
                case"base64":
                    return H(t).length;
                default:
                    if (e)return j(t).length;
                    r = ("" + r).toLowerCase(), e = !0
            }
        }

        function w(t, r, i) {
            var e = !1;
            if (r = 0 | r, i = void 0 === i || i === 1 / 0 ? this.length : 0 | i, t || (t = "utf8"), 0 > r && (r = 0), i > this.length && (i = this.length), r >= i)return "";
            for (; ;)switch (t) {
                case"hex":
                    return T(this, r, i);
                case"utf8":
                case"utf-8":
                    return R(this, r, i);
                case"ascii":
                    return x(this, r, i);
                case"binary":
                    return P(this, r, i);
                case"base64":
                    return b(this, r, i);
                case"ucs2":
                case"ucs-2":
                case"utf16le":
                case"utf-16le":
                    return S(this, r, i);
                default:
                    if (e)throw new TypeError("Unknown encoding: " + t);
                    t = (t + "").toLowerCase(), e = !0
            }
        }

        function A(t, r, i, e) {
            i = Number(i) || 0;
            var h = t.length - i;
            e ? (e = Number(e), e > h && (e = h)) : e = h;
            var o = r.length;
            if (o % 2 !== 0)throw new Error("Invalid hex string");
            e > o / 2 && (e = o / 2);
            for (var n = 0; e > n; n++) {
                var s = parseInt(r.substr(2 * n, 2), 16);
                if (isNaN(s))throw new Error("Invalid hex string");
                t[i + n] = s
            }
            return n
        }

        function v(t, r, i, e) {
            return Z(j(r, t.length - i), t, i, e)
        }

        function E(t, r, i, e) {
            return Z(X(r), t, i, e)
        }

        function C(t, r, i, e) {
            return E(t, r, i, e)
        }

        function B(t, r, i, e) {
            return Z(H(r), t, i, e)
        }

        function I(t, r, i, e) {
            return Z(J(r, t.length - i), t, i, e)
        }

        function b(t, r, i) {
            return G.fromByteArray(0 === r && i === t.length ? t : t.slice(r, i))
        }

        function R(t, r, i) {
            i = Math.min(t.length, i);
            for (var e = [], h = r; i > h;) {
                var o = t[h], n = null, s = o > 239 ? 4 : o > 223 ? 3 : o > 191 ? 2 : 1;
                if (i >= h + s) {
                    var a, u, f, l;
                    switch (s) {
                        case 1:
                            128 > o && (n = o);
                            break;
                        case 2:
                            a = t[h + 1], 128 === (192 & a) && (l = (31 & o) << 6 | 63 & a, l > 127 && (n = l));
                            break;
                        case 3:
                            a = t[h + 1], u = t[h + 2], 128 === (192 & a) && 128 === (192 & u) && (l = (15 & o) << 12 | (63 & a) << 6 | 63 & u, l > 2047 && (55296 > l || l > 57343) && (n = l));
                            break;
                        case 4:
                            a = t[h + 1], u = t[h + 2], f = t[h + 3], 128 === (192 & a) && 128 === (192 & u) && 128 === (192 & f) && (l = (15 & o) << 18 | (63 & a) << 12 | (63 & u) << 6 | 63 & f, l > 65535 && 1114112 > l && (n = l))
                    }
                }
                null === n ? (n = 65533, s = 1) : n > 65535 && (n -= 65536, e.push(n >>> 10 & 1023 | 55296), n = 56320 | 1023 & n), e.push(n), h += s
            }
            return U(e)
        }

        function U(t) {
            var r = t.length;
            if (W >= r)return String.fromCharCode.apply(String, t);
            for (var i = "", e = 0; r > e;)i += String.fromCharCode.apply(String, t.slice(e, e += W));
            return i
        }

        function x(t, r, i) {
            var e = "";
            i = Math.min(t.length, i);
            for (var h = r; i > h; h++)e += String.fromCharCode(127 & t[h]);
            return e
        }

        function P(t, r, i) {
            var e = "";
            i = Math.min(t.length, i);
            for (var h = r; i > h; h++)e += String.fromCharCode(t[h]);
            return e
        }

        function T(t, r, i) {
            var e = t.length;
            (!r || 0 > r) && (r = 0), (!i || 0 > i || i > e) && (i = e);
            for (var h = "", o = r; i > o; o++)h += q(t[o]);
            return h
        }

        function S(t, r, i) {
            for (var e = t.slice(r, i), h = "", o = 0; o < e.length; o += 2)h += String.fromCharCode(e[o] + 256 * e[o + 1]);
            return h
        }

        function L(t, r, i) {
            if (t % 1 !== 0 || 0 > t)throw new RangeError("offset is not uint");
            if (t + r > i)throw new RangeError("Trying to access beyond buffer length")
        }

        function Y(r, i, e, h, o, n) {
            if (!t.isBuffer(r))throw new TypeError("buffer must be a Buffer instance");
            if (i > o || n > i)throw new RangeError("value is out of bounds");
            if (e + h > r.length)throw new RangeError("index out of range")
        }

        function z(t, r, i, e) {
            0 > r && (r = 65535 + r + 1);
            for (var h = 0, o = Math.min(t.length - i, 2); o > h; h++)t[i + h] = (r & 255 << 8 * (e ? h : 1 - h)) >>> 8 * (e ? h : 1 - h)
        }

        function M(t, r, i, e) {
            0 > r && (r = 4294967295 + r + 1);
            for (var h = 0, o = Math.min(t.length - i, 4); o > h; h++)t[i + h] = r >>> 8 * (e ? h : 3 - h) & 255
        }

        function D(t, r, i, e, h, o) {
            if (r > h || o > r)throw new RangeError("value is out of bounds");
            if (i + e > t.length)throw new RangeError("index out of range");
            if (0 > i)throw new RangeError("index out of range")
        }

        function O(t, r, i, e, h) {
            return h || D(t, r, i, 4, 3.4028234663852886e38, -3.4028234663852886e38), K.write(t, r, i, e, 23, 4), i + 4
        }

        function N(t, r, i, e, h) {
            return h || D(t, r, i, 8, 1.7976931348623157e308, -1.7976931348623157e308), K.write(t, r, i, e, 52, 8), i + 8
        }

        function F(t) {
            if (t = k(t).replace(tt, ""), t.length < 2)return "";
            for (; t.length % 4 !== 0;)t += "=";
            return t
        }

        function k(t) {
            return t.trim ? t.trim() : t.replace(/^\s+|\s+$/g, "")
        }

        function q(t) {
            return 16 > t ? "0" + t.toString(16) : t.toString(16)
        }

        function j(t, r) {
            r = r || 1 / 0;
            for (var i, e = t.length, h = null, o = [], n = 0; e > n; n++) {
                if (i = t.charCodeAt(n), i > 55295 && 57344 > i) {
                    if (!h) {
                        if (i > 56319) {
                            (r -= 3) > -1 && o.push(239, 191, 189);
                            continue
                        }
                        if (n + 1 === e) {
                            (r -= 3) > -1 && o.push(239, 191, 189);
                            continue
                        }
                        h = i;
                        continue
                    }
                    if (56320 > i) {
                        (r -= 3) > -1 && o.push(239, 191, 189), h = i;
                        continue
                    }
                    i = (h - 55296 << 10 | i - 56320) + 65536
                } else h && (r -= 3) > -1 && o.push(239, 191, 189);
                if (h = null, 128 > i) {
                    if ((r -= 1) < 0)break;
                    o.push(i)
                } else if (2048 > i) {
                    if ((r -= 2) < 0)break;
                    o.push(i >> 6 | 192, 63 & i | 128)
                } else if (65536 > i) {
                    if ((r -= 3) < 0)break;
                    o.push(i >> 12 | 224, i >> 6 & 63 | 128, 63 & i | 128)
                } else {
                    if (!(1114112 > i))throw new Error("Invalid code point");
                    if ((r -= 4) < 0)break;
                    o.push(i >> 18 | 240, i >> 12 & 63 | 128, i >> 6 & 63 | 128, 63 & i | 128)
                }
            }
            return o
        }

        function X(t) {
            for (var r = [], i = 0; i < t.length; i++)r.push(255 & t.charCodeAt(i));
            return r
        }

        function J(t, r) {
            for (var i, e, h, o = [], n = 0; n < t.length && !((r -= 2) < 0); n++)i = t.charCodeAt(n), e = i >> 8, h = i % 256, o.push(h), o.push(e);
            return o
        }

        function H(t) {
            return G.toByteArray(F(t))
        }

        function Z(t, r, i, e) {
            for (var h = 0; e > h && !(h + i >= r.length || h >= t.length); h++)r[h + i] = t[h];
            return h
        }

        var G = i(3), K = i(4), Q = i(5);
        r.Buffer = t, r.SlowBuffer = y, r.INSPECT_MAX_BYTES = 50, t.poolSize = 8192;
        var V = {};
        t.TYPED_ARRAY_SUPPORT = void 0 !== e.TYPED_ARRAY_SUPPORT ? e.TYPED_ARRAY_SUPPORT : h(), t.TYPED_ARRAY_SUPPORT ? (t.prototype.__proto__ = Uint8Array.prototype, t.__proto__ = Uint8Array) : (t.prototype.length = void 0, t.prototype.parent = void 0), t.isBuffer = function (t) {
            return !(null == t || !t._isBuffer)
        }, t.compare = function (r, i) {
            if (!t.isBuffer(r) || !t.isBuffer(i))throw new TypeError("Arguments must be Buffers");
            if (r === i)return 0;
            for (var e = r.length, h = i.length, o = 0, n = Math.min(e, h); n > o && r[o] === i[o];)++o;
            return o !== n && (e = r[o], h = i[o]), h > e ? -1 : e > h ? 1 : 0
        }, t.isEncoding = function (t) {
            switch (String(t).toLowerCase()) {
                case"hex":
                case"utf8":
                case"utf-8":
                case"ascii":
                case"binary":
                case"base64":
                case"raw":
                case"ucs2":
                case"ucs-2":
                case"utf16le":
                case"utf-16le":
                    return !0;
                default:
                    return !1
            }
        }, t.concat = function (r, i) {
            if (!Q(r))throw new TypeError("list argument must be an Array of Buffers.");
            if (0 === r.length)return new t(0);
            var e;
            if (void 0 === i)for (i = 0, e = 0; e < r.length; e++)i += r[e].length;
            var h = new t(i), o = 0;
            for (e = 0; e < r.length; e++) {
                var n = r[e];
                n.copy(h, o), o += n.length
            }
            return h
        }, t.byteLength = g, t.prototype.toString = function () {
            var t = 0 | this.length;
            return 0 === t ? "" : 0 === arguments.length ? R(this, 0, t) : w.apply(this, arguments)
        }, t.prototype.equals = function (r) {
            if (!t.isBuffer(r))throw new TypeError("Argument must be a Buffer");
            return this === r ? !0 : 0 === t.compare(this, r)
        }, t.prototype.inspect = function () {
            var t = "", i = r.INSPECT_MAX_BYTES;
            return this.length > 0 && (t = this.toString("hex", 0, i).match(/.{2}/g).join(" "), this.length > i && (t += " ... ")), "<Buffer " + t + ">"
        }, t.prototype.compare = function (r) {
            if (!t.isBuffer(r))throw new TypeError("Argument must be a Buffer");
            return this === r ? 0 : t.compare(this, r)
        }, t.prototype.indexOf = function (r, i) {
            function e(t, r, i) {
                for (var e = -1, h = 0; i + h < t.length; h++)if (t[i + h] === r[-1 === e ? 0 : h - e]) {
                    if (-1 === e && (e = h), h - e + 1 === r.length)return i + e
                } else e = -1;
                return -1
            }

            if (i > 2147483647 ? i = 2147483647 : -2147483648 > i && (i = -2147483648), i >>= 0, 0 === this.length)return -1;
            if (i >= this.length)return -1;
            if (0 > i && (i = Math.max(this.length + i, 0)), "string" == typeof r)return 0 === r.length ? -1 : String.prototype.indexOf.call(this, r, i);
            if (t.isBuffer(r))return e(this, r, i);
            if ("number" == typeof r)return t.TYPED_ARRAY_SUPPORT && "function" === Uint8Array.prototype.indexOf ? Uint8Array.prototype.indexOf.call(this, r, i) : e(this, [r], i);
            throw new TypeError("val must be string, number or Buffer")
        }, t.prototype.get = function (t) {
            return console.log(".get() is deprecated. Access using array indexes instead."), this.readUInt8(t)
        }, t.prototype.set = function (t, r) {
            return console.log(".set() is deprecated. Access using array indexes instead."), this.writeUInt8(t, r)
        }, t.prototype.write = function (t, r, i, e) {
            if (void 0 === r) e = "utf8", i = this.length, r = 0; else if (void 0 === i && "string" == typeof r) e = r, i = this.length, r = 0; else if (isFinite(r)) r = 0 | r, isFinite(i) ? (i = 0 | i, void 0 === e && (e = "utf8")) : (e = i, i = void 0); else {
                var h = e;
                e = r, r = 0 | i, i = h
            }
            var o = this.length - r;
            if ((void 0 === i || i > o) && (i = o), t.length > 0 && (0 > i || 0 > r) || r > this.length)throw new RangeError("attempt to write outside buffer bounds");
            e || (e = "utf8");
            for (var n = !1; ;)switch (e) {
                case"hex":
                    return A(this, t, r, i);
                case"utf8":
                case"utf-8":
                    return v(this, t, r, i);
                case"ascii":
                    return E(this, t, r, i);
                case"binary":
                    return C(this, t, r, i);
                case"base64":
                    return B(this, t, r, i);
                case"ucs2":
                case"ucs-2":
                case"utf16le":
                case"utf-16le":
                    return I(this, t, r, i);
                default:
                    if (n)throw new TypeError("Unknown encoding: " + e);
                    e = ("" + e).toLowerCase(), n = !0
            }
        }, t.prototype.toJSON = function () {
            return {type: "Buffer", data: Array.prototype.slice.call(this._arr || this, 0)}
        };
        var W = 4096;
        t.prototype.slice = function (r, i) {
            var e = this.length;
            r = ~~r, i = void 0 === i ? e : ~~i, 0 > r ? (r += e, 0 > r && (r = 0)) : r > e && (r = e), 0 > i ? (i += e, 0 > i && (i = 0)) : i > e && (i = e), r > i && (i = r);
            var h;
            if (t.TYPED_ARRAY_SUPPORT) h = t._augment(this.subarray(r, i)); else {
                var o = i - r;
                h = new t(o, void 0);
                for (var n = 0; o > n; n++)h[n] = this[n + r]
            }
            return h.length && (h.parent = this.parent || this), h
        }, t.prototype.readUIntLE = function (t, r, i) {
            t = 0 | t, r = 0 | r, i || L(t, r, this.length);
            for (var e = this[t], h = 1, o = 0; ++o < r && (h *= 256);)e += this[t + o] * h;
            return e
        }, t.prototype.readUIntBE = function (t, r, i) {
            t = 0 | t, r = 0 | r, i || L(t, r, this.length);
            for (var e = this[t + --r], h = 1; r > 0 && (h *= 256);)e += this[t + --r] * h;
            return e
        }, t.prototype.readUInt8 = function (t, r) {
            return r || L(t, 1, this.length), this[t]
        }, t.prototype.readUInt16LE = function (t, r) {
            return r || L(t, 2, this.length), this[t] | this[t + 1] << 8
        }, t.prototype.readUInt16BE = function (t, r) {
            return r || L(t, 2, this.length), this[t] << 8 | this[t + 1]
        }, t.prototype.readUInt32LE = function (t, r) {
            return r || L(t, 4, this.length), (this[t] | this[t + 1] << 8 | this[t + 2] << 16) + 16777216 * this[t + 3]
        }, t.prototype.readUInt32BE = function (t, r) {
            return r || L(t, 4, this.length), 16777216 * this[t] + (this[t + 1] << 16 | this[t + 2] << 8 | this[t + 3])
        }, t.prototype.readIntLE = function (t, r, i) {
            t = 0 | t, r = 0 | r, i || L(t, r, this.length);
            for (var e = this[t], h = 1, o = 0; ++o < r && (h *= 256);)e += this[t + o] * h;
            return h *= 128, e >= h && (e -= Math.pow(2, 8 * r)), e
        }, t.prototype.readIntBE = function (t, r, i) {
            t = 0 | t, r = 0 | r, i || L(t, r, this.length);
            for (var e = r, h = 1, o = this[t + --e]; e > 0 && (h *= 256);)o += this[t + --e] * h;
            return h *= 128, o >= h && (o -= Math.pow(2, 8 * r)), o
        }, t.prototype.readInt8 = function (t, r) {
            return r || L(t, 1, this.length), 128 & this[t] ? -1 * (255 - this[t] + 1) : this[t]
        }, t.prototype.readInt16LE = function (t, r) {
            r || L(t, 2, this.length);
            var i = this[t] | this[t + 1] << 8;
            return 32768 & i ? 4294901760 | i : i
        }, t.prototype.readInt16BE = function (t, r) {
            r || L(t, 2, this.length);
            var i = this[t + 1] | this[t] << 8;
            return 32768 & i ? 4294901760 | i : i
        }, t.prototype.readInt32LE = function (t, r) {
            return r || L(t, 4, this.length), this[t] | this[t + 1] << 8 | this[t + 2] << 16 | this[t + 3] << 24
        }, t.prototype.readInt32BE = function (t, r) {
            return r || L(t, 4, this.length), this[t] << 24 | this[t + 1] << 16 | this[t + 2] << 8 | this[t + 3]
        }, t.prototype.readFloatLE = function (t, r) {
            return r || L(t, 4, this.length), K.read(this, t, !0, 23, 4)
        }, t.prototype.readFloatBE = function (t, r) {
            return r || L(t, 4, this.length), K.read(this, t, !1, 23, 4)
        }, t.prototype.readDoubleLE = function (t, r) {
            return r || L(t, 8, this.length), K.read(this, t, !0, 52, 8)
        }, t.prototype.readDoubleBE = function (t, r) {
            return r || L(t, 8, this.length), K.read(this, t, !1, 52, 8)
        }, t.prototype.writeUIntLE = function (t, r, i, e) {
            t = +t, r = 0 | r, i = 0 | i, e || Y(this, t, r, i, Math.pow(2, 8 * i), 0);
            var h = 1, o = 0;
            for (this[r] = 255 & t; ++o < i && (h *= 256);)this[r + o] = t / h & 255;
            return r + i
        }, t.prototype.writeUIntBE = function (t, r, i, e) {
            t = +t, r = 0 | r, i = 0 | i, e || Y(this, t, r, i, Math.pow(2, 8 * i), 0);
            var h = i - 1, o = 1;
            for (this[r + h] = 255 & t; --h >= 0 && (o *= 256);)this[r + h] = t / o & 255;
            return r + i
        }, t.prototype.writeUInt8 = function (r, i, e) {
            return r = +r, i = 0 | i, e || Y(this, r, i, 1, 255, 0), t.TYPED_ARRAY_SUPPORT || (r = Math.floor(r)), this[i] = 255 & r, i + 1
        }, t.prototype.writeUInt16LE = function (r, i, e) {
            return r = +r, i = 0 | i, e || Y(this, r, i, 2, 65535, 0), t.TYPED_ARRAY_SUPPORT ? (this[i] = 255 & r, this[i + 1] = r >>> 8) : z(this, r, i, !0), i + 2
        }, t.prototype.writeUInt16BE = function (r, i, e) {
            return r = +r, i = 0 | i, e || Y(this, r, i, 2, 65535, 0), t.TYPED_ARRAY_SUPPORT ? (this[i] = r >>> 8, this[i + 1] = 255 & r) : z(this, r, i, !1), i + 2
        }, t.prototype.writeUInt32LE = function (r, i, e) {
            return r = +r, i = 0 | i, e || Y(this, r, i, 4, 4294967295, 0), t.TYPED_ARRAY_SUPPORT ? (this[i + 3] = r >>> 24, this[i + 2] = r >>> 16, this[i + 1] = r >>> 8, this[i] = 255 & r) : M(this, r, i, !0), i + 4
        }, t.prototype.writeUInt32BE = function (r, i, e) {
            return r = +r, i = 0 | i, e || Y(this, r, i, 4, 4294967295, 0), t.TYPED_ARRAY_SUPPORT ? (this[i] = r >>> 24, this[i + 1] = r >>> 16, this[i + 2] = r >>> 8, this[i + 3] = 255 & r) : M(this, r, i, !1), i + 4
        }, t.prototype.writeIntLE = function (t, r, i, e) {
            if (t = +t, r = 0 | r, !e) {
                var h = Math.pow(2, 8 * i - 1);
                Y(this, t, r, i, h - 1, -h)
            }
            var o = 0, n = 1, s = 0 > t ? 1 : 0;
            for (this[r] = 255 & t; ++o < i && (n *= 256);)this[r + o] = (t / n >> 0) - s & 255;
            return r + i
        }, t.prototype.writeIntBE = function (t, r, i, e) {
            if (t = +t, r = 0 | r, !e) {
                var h = Math.pow(2, 8 * i - 1);
                Y(this, t, r, i, h - 1, -h)
            }
            var o = i - 1, n = 1, s = 0 > t ? 1 : 0;
            for (this[r + o] = 255 & t; --o >= 0 && (n *= 256);)this[r + o] = (t / n >> 0) - s & 255;
            return r + i
        }, t.prototype.writeInt8 = function (r, i, e) {
            return r = +r, i = 0 | i, e || Y(this, r, i, 1, 127, -128), t.TYPED_ARRAY_SUPPORT || (r = Math.floor(r)), 0 > r && (r = 255 + r + 1), this[i] = 255 & r, i + 1
        }, t.prototype.writeInt16LE = function (r, i, e) {
            return r = +r, i = 0 | i, e || Y(this, r, i, 2, 32767, -32768), t.TYPED_ARRAY_SUPPORT ? (this[i] = 255 & r, this[i + 1] = r >>> 8) : z(this, r, i, !0), i + 2
        }, t.prototype.writeInt16BE = function (r, i, e) {
            return r = +r, i = 0 | i, e || Y(this, r, i, 2, 32767, -32768), t.TYPED_ARRAY_SUPPORT ? (this[i] = r >>> 8, this[i + 1] = 255 & r) : z(this, r, i, !1), i + 2
        }, t.prototype.writeInt32LE = function (r, i, e) {
            return r = +r, i = 0 | i, e || Y(this, r, i, 4, 2147483647, -2147483648), t.TYPED_ARRAY_SUPPORT ? (this[i] = 255 & r, this[i + 1] = r >>> 8, this[i + 2] = r >>> 16, this[i + 3] = r >>> 24) : M(this, r, i, !0), i + 4
        }, t.prototype.writeInt32BE = function (r, i, e) {
            return r = +r, i = 0 | i, e || Y(this, r, i, 4, 2147483647, -2147483648), 0 > r && (r = 4294967295 + r + 1), t.TYPED_ARRAY_SUPPORT ? (this[i] = r >>> 24, this[i + 1] = r >>> 16, this[i + 2] = r >>> 8, this[i + 3] = 255 & r) : M(this, r, i, !1), i + 4
        }, t.prototype.writeFloatLE = function (t, r, i) {
            return O(this, t, r, !0, i)
        }, t.prototype.writeFloatBE = function (t, r, i) {
            return O(this, t, r, !1, i)
        }, t.prototype.writeDoubleLE = function (t, r, i) {
            return N(this, t, r, !0, i)
        }, t.prototype.writeDoubleBE = function (t, r, i) {
            return N(this, t, r, !1, i)
        }, t.prototype.copy = function (r, i, e, h) {
            if (e || (e = 0), h || 0 === h || (h = this.length), i >= r.length && (i = r.length), i || (i = 0), h > 0 && e > h && (h = e), h === e)return 0;
            if (0 === r.length || 0 === this.length)return 0;
            if (0 > i)throw new RangeError("targetStart out of bounds");
            if (0 > e || e >= this.length)throw new RangeError("sourceStart out of bounds");
            if (0 > h)throw new RangeError("sourceEnd out of bounds");
            h > this.length && (h = this.length), r.length - i < h - e && (h = r.length - i + e);
            var o, n = h - e;
            if (this === r && i > e && h > i)for (o = n - 1; o >= 0; o--)r[o + i] = this[o + e]; else if (1e3 > n || !t.TYPED_ARRAY_SUPPORT)for (o = 0; n > o; o++)r[o + i] = this[o + e]; else r._set(this.subarray(e, e + n), i);
            return n
        }, t.prototype.fill = function (t, r, i) {
            if (t || (t = 0), r || (r = 0), i || (i = this.length), r > i)throw new RangeError("end < start");
            if (i !== r && 0 !== this.length) {
                if (0 > r || r >= this.length)throw new RangeError("start out of bounds");
                if (0 > i || i > this.length)throw new RangeError("end out of bounds");
                var e;
                if ("number" == typeof t)for (e = r; i > e; e++)this[e] = t; else {
                    var h = j(t.toString()), o = h.length;
                    for (e = r; i > e; e++)this[e] = h[e % o]
                }
                return this
            }
        }, t.prototype.toArrayBuffer = function () {
            if ("undefined" != typeof Uint8Array) {
                if (t.TYPED_ARRAY_SUPPORT)return new t(this).buffer;
                for (var r = new Uint8Array(this.length), i = 0, e = r.length; e > i; i += 1)r[i] = this[i];
                return r.buffer
            }
            throw new TypeError("Buffer.toArrayBuffer not supported in this browser")
        };
        var $ = t.prototype;
        t._augment = function (r) {
            return r.constructor = t, r._isBuffer = !0, r._set = r.set, r.get = $.get, r.set = $.set, r.write = $.write, r.toString = $.toString, r.toLocaleString = $.toString, r.toJSON = $.toJSON, r.equals = $.equals, r.compare = $.compare, r.indexOf = $.indexOf, r.copy = $.copy, r.slice = $.slice, r.readUIntLE = $.readUIntLE, r.readUIntBE = $.readUIntBE, r.readUInt8 = $.readUInt8, r.readUInt16LE = $.readUInt16LE, r.readUInt16BE = $.readUInt16BE, r.readUInt32LE = $.readUInt32LE, r.readUInt32BE = $.readUInt32BE, r.readIntLE = $.readIntLE, r.readIntBE = $.readIntBE, r.readInt8 = $.readInt8, r.readInt16LE = $.readInt16LE, r.readInt16BE = $.readInt16BE, r.readInt32LE = $.readInt32LE, r.readInt32BE = $.readInt32BE, r.readFloatLE = $.readFloatLE, r.readFloatBE = $.readFloatBE, r.readDoubleLE = $.readDoubleLE, r.readDoubleBE = $.readDoubleBE, r.writeUInt8 = $.writeUInt8, r.writeUIntLE = $.writeUIntLE, r.writeUIntBE = $.writeUIntBE, r.writeUInt16LE = $.writeUInt16LE, r.writeUInt16BE = $.writeUInt16BE, r.writeUInt32LE = $.writeUInt32LE, r.writeUInt32BE = $.writeUInt32BE, r.writeIntLE = $.writeIntLE, r.writeIntBE = $.writeIntBE, r.writeInt8 = $.writeInt8, r.writeInt16LE = $.writeInt16LE, r.writeInt16BE = $.writeInt16BE, r.writeInt32LE = $.writeInt32LE, r.writeInt32BE = $.writeInt32BE, r.writeFloatLE = $.writeFloatLE, r.writeFloatBE = $.writeFloatBE, r.writeDoubleLE = $.writeDoubleLE, r.writeDoubleBE = $.writeDoubleBE, r.fill = $.fill, r.inspect = $.inspect, r.toArrayBuffer = $.toArrayBuffer, r
        };
        var tt = /[^+\/0-9A-Za-z-_]/g
    }).call(r, i(2).Buffer, function () {
        return this
    }())
}, function (t, r) {
    var i = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    !function (t) {
        "use strict";
        function r(t) {
            var r = t.charCodeAt(0);
            return r === n || r === l ? 62 : r === s || r === c ? 63 : a > r ? -1 : a + 10 > r ? r - a + 26 + 26 : f + 26 > r ? r - f : u + 26 > r ? r - u + 26 : void 0
        }

        function e(t) {
            function i(t) {
                u[l++] = t
            }

            var e, h, n, s, a, u;
            if (t.length % 4 > 0)throw new Error("Invalid string. Length must be a multiple of 4");
            var f = t.length;
            a = "=" === t.charAt(f - 2) ? 2 : "=" === t.charAt(f - 1) ? 1 : 0, u = new o(3 * t.length / 4 - a), n = a > 0 ? t.length - 4 : t.length;
            var l = 0;
            for (e = 0, h = 0; n > e; e += 4, h += 3)s = r(t.charAt(e)) << 18 | r(t.charAt(e + 1)) << 12 | r(t.charAt(e + 2)) << 6 | r(t.charAt(e + 3)), i((16711680 & s) >> 16), i((65280 & s) >> 8), i(255 & s);
            return 2 === a ? (s = r(t.charAt(e)) << 2 | r(t.charAt(e + 1)) >> 4, i(255 & s)) : 1 === a && (s = r(t.charAt(e)) << 10 | r(t.charAt(e + 1)) << 4 | r(t.charAt(e + 2)) >> 2, i(s >> 8 & 255), i(255 & s)), u
        }

        function h(t) {
            function r(t) {
                return i.charAt(t)
            }

            function e(t) {
                return r(t >> 18 & 63) + r(t >> 12 & 63) + r(t >> 6 & 63) + r(63 & t)
            }

            var h, o, n, s = t.length % 3, a = "";
            for (h = 0, n = t.length - s; n > h; h += 3)o = (t[h] << 16) + (t[h + 1] << 8) + t[h + 2], a += e(o);
            switch (s) {
                case 1:
                    o = t[t.length - 1], a += r(o >> 2), a += r(o << 4 & 63), a += "==";
                    break;
                case 2:
                    o = (t[t.length - 2] << 8) + t[t.length - 1], a += r(o >> 10), a += r(o >> 4 & 63), a += r(o << 2 & 63), a += "="
            }
            return a
        }

        var o = "undefined" != typeof Uint8Array ? Uint8Array : Array, n = "+".charCodeAt(0), s = "/".charCodeAt(0),
            a = "0".charCodeAt(0), u = "a".charCodeAt(0), f = "A".charCodeAt(0), l = "-".charCodeAt(0),
            c = "_".charCodeAt(0);
        t.toByteArray = e, t.fromByteArray = h
    }(r)
}, function (t, r) {
    r.read = function (t, r, i, e, h) {
        var o, n, s = 8 * h - e - 1, a = (1 << s) - 1, u = a >> 1, f = -7, l = i ? h - 1 : 0, c = i ? -1 : 1,
            m = t[r + l];
        for (l += c, o = m & (1 << -f) - 1, m >>= -f, f += s; f > 0; o = 256 * o + t[r + l], l += c, f -= 8);
        for (n = o & (1 << -f) - 1, o >>= -f, f += e; f > 0; n = 256 * n + t[r + l], l += c, f -= 8);
        if (0 === o) o = 1 - u; else {
            if (o === a)return n ? 0 / 0 : (m ? -1 : 1) * (1 / 0);
            n += Math.pow(2, e), o -= u
        }
        return (m ? -1 : 1) * n * Math.pow(2, o - e)
    }, r.write = function (t, r, i, e, h, o) {
        var n, s, a, u = 8 * o - h - 1, f = (1 << u) - 1, l = f >> 1,
            c = 23 === h ? Math.pow(2, -24) - Math.pow(2, -77) : 0, m = e ? 0 : o - 1, p = e ? 1 : -1,
            d = 0 > r || 0 === r && 0 > 1 / r ? 1 : 0;
        for (r = Math.abs(r), isNaN(r) || r === 1 / 0 ? (s = isNaN(r) ? 1 : 0, n = f) : (n = Math.floor(Math.log(r) / Math.LN2), r * (a = Math.pow(2, -n)) < 1 && (n--, a *= 2), r += n + l >= 1 ? c / a : c * Math.pow(2, 1 - l), r * a >= 2 && (n++, a /= 2), n + l >= f ? (s = 0, n = f) : n + l >= 1 ? (s = (r * a - 1) * Math.pow(2, h), n += l) : (s = r * Math.pow(2, l - 1) * Math.pow(2, h), n = 0)); h >= 8; t[i + m] = 255 & s, m += p, s /= 256, h -= 8);
        for (n = n << h | s, u += h; u > 0; t[i + m] = 255 & n, m += p, n /= 256, u -= 8);
        t[i + m - p] |= 128 * d
    }
}, function (t) {
    var r = {}.toString;
    t.exports = Array.isArray || function (t) {
            return "[object Array]" == r.call(t)
        }
}, function (t, r, i) {
    r.UINT32 = i(7), r.UINT64 = i(8)
}, function (t, r) {
    var i, e;
    !function (h) {
        function o(t, r) {
            return this instanceof o ? (this._low = 0, this._high = 0, this.remainder = null, "undefined" == typeof r ? s.call(this, t) : "string" == typeof t ? a.call(this, t, r) : void n.call(this, t, r)) : new o(t, r)
        }

        function n(t, r) {
            return this._low = 0 | t, this._high = 0 | r, this
        }

        function s(t) {
            return this._low = 65535 & t, this._high = t >>> 16, this
        }

        function a(t, r) {
            var i = parseInt(t, r || 10);
            return this._low = 65535 & i, this._high = i >>> 16, this
        }

        var u = ({
            36: o(Math.pow(36, 5)),
            16: o(Math.pow(16, 7)),
            10: o(Math.pow(10, 9)),
            2: o(Math.pow(2, 30))
        }, {36: o(36), 16: o(16), 10: o(10), 2: o(2)});
        o.prototype.fromBits = n, o.prototype.fromNumber = s, o.prototype.fromString = a, o.prototype.toNumber = function () {
            return this._high << 16 | this._low
        }, o.prototype.toString = function (t) {
            t = t || 10;
            var r = u[t] || new o(t);
            if (!this.gt(r))return this.toNumber().toString(t);
            for (var i = this.clone(), e = new Array(32), h = 31; h >= 0 && (i.div(r), e[h] = i.remainder.toNumber().toString(t), i.gt(r)); h--);
            return e[h - 1] = i.toNumber().toString(t), e.join("")
        }, o.prototype.add = function (t) {
            var r = this._low + t._low, i = r >>> 16;
            return i += this._high + t._high, this._low = 65535 & r, this._high = 65535 & i, this
        }, o.prototype.subtract = function (t) {
            return this.add(t.clone().negate())
        }, o.prototype.multiply = function (t) {
            var r, i, e = this._high, h = this._low, o = t._high, n = t._low;
            return i = h * n, r = i >>> 16, r += e * n, r &= 65535, r += h * o, this._low = 65535 & i, this._high = 65535 & r, this
        }, o.prototype.div = function (t) {
            if (0 == t._low && 0 == t._high)throw Error("division by zero");
            if (0 == t._high && 1 == t._low)return this.remainder = new o(0), this;
            if (t.gt(this))return this.remainder = new o(0), this._low = 0, this._high = 0, this;
            if (this.eq(t))return this.remainder = new o(0), this._low = 1, this._high = 0, this;
            for (var r = t.clone(), i = -1; !this.lt(r);)r.shiftLeft(1, !0), i++;
            for (this.remainder = this.clone(), this._low = 0, this._high = 0; i >= 0; i--)r.shiftRight(1), this.remainder.lt(r) || (this.remainder.subtract(r), i >= 16 ? this._high |= 1 << i - 16 : this._low |= 1 << i);
            return this
        }, o.prototype.negate = o.prototype.not = function () {
            var t = (65535 & ~this._low) + 1;
            return this._low = 65535 & t, this._high = ~this._high + (t >>> 16) & 65535, this
        }, o.prototype.equals = o.prototype.eq = function (t) {
            return this._low == t._low && this._high == t._high
        }, o.prototype.greaterThan = o.prototype.gt = function (t) {
            return this._high > t._high ? !0 : this._high < t._high ? !1 : this._low > t._low
        }, o.prototype.lessThan = o.prototype.lt = function (t) {
            return this._high < t._high ? !0 : this._high > t._high ? !1 : this._low < t._low
        }, o.prototype.or = function (t) {
            return this._low |= t._low, this._high |= t._high, this
        }, o.prototype.and = function (t) {
            return this._low &= t._low, this._high &= t._high, this
        }, o.prototype.xor = function (t) {
            return this._low ^= t._low, this._high ^= t._high, this
        }, o.prototype.shiftRight = o.prototype.shiftr = function (t) {
            return t > 16 ? (this._low = this._high >> t - 16, this._high = 0) : 16 == t ? (this._low = this._high, this._high = 0) : (this._low = this._low >> t | this._high << 16 - t & 65535, this._high >>= t), this
        }, o.prototype.shiftLeft = o.prototype.shiftl = function (t, r) {
            return t > 16 ? (this._high = this._low << t - 16, this._low = 0, r || (this._high &= 65535)) : 16 == t ? (this._high = this._low, this._low = 0) : (this._high = this._high << t | this._low >> 16 - t, this._low = this._low << t & 65535, r || (this._high &= 65535)), this
        }, o.prototype.rotateLeft = o.prototype.rotl = function (t) {
            var r = this._high << 16 | this._low;
            return r = r << t | r >>> 32 - t, this._low = 65535 & r, this._high = r >>> 16, this
        }, o.prototype.rotateRight = o.prototype.rotr = function (t) {
            var r = this._high << 16 | this._low;
            return r = r >>> t | r << 32 - t, this._low = 65535 & r, this._high = r >>> 16, this
        }, o.prototype.clone = function () {
            return new o(this._low, this._high)
        }, i = [], e = function () {
            return o
        }.apply(r, i), !(void 0 !== e && (t.exports = e))
    }(this)
}, function (t, r) {
    var i, e;
    !function (h) {
        function o(t, r, i, e) {
            return this instanceof o ? (this.remainder = null, "string" == typeof t ? a.call(this, t, r) : "undefined" == typeof r ? s.call(this, t) : void n.apply(this, arguments)) : new o(t, r, i, e)
        }

        function n(t, r, i, e) {
            return "undefined" == typeof i ? (this._a00 = 65535 & t, this._a16 = t >>> 16, this._a32 = 65535 & r, this._a48 = r >>> 16, this) : (this._a00 = 0 | t, this._a16 = 0 | r, this._a32 = 0 | i, this._a48 = 0 | e, this)
        }

        function s(t) {
            return this._a00 = 65535 & t, this._a16 = t >>> 16, this._a32 = 0, this._a48 = 0, this
        }

        function a(t, r) {
            r = r || 10, this._a00 = 0, this._a16 = 0, this._a32 = 0, this._a48 = 0;
            for (var i = u[r] || new o(Math.pow(r, 5)), e = 0, h = t.length; h > e; e += 5) {
                var n = Math.min(5, h - e), s = parseInt(t.slice(e, e + n), r);
                this.multiply(5 > n ? new o(Math.pow(r, n)) : i).add(new o(s))
            }
            return this
        }

        var u = {16: o(Math.pow(16, 5)), 10: o(Math.pow(10, 5)), 2: o(Math.pow(2, 5))},
            f = {16: o(16), 10: o(10), 2: o(2)};
        o.prototype.fromBits = n, o.prototype.fromNumber = s, o.prototype.fromString = a, o.prototype.toNumber = function () {
            return this._a16 << 16 | this._a00
        }, o.prototype.toString = function (t) {
            t = t || 10;
            var r = f[t] || new o(t);
            if (!this.gt(r))return this.toNumber().toString(t);
            for (var i = this.clone(), e = new Array(64), h = 63; h >= 0 && (i.div(r), e[h] = i.remainder.toNumber().toString(t), i.gt(r)); h--);
            return e[h - 1] = i.toNumber().toString(t), e.join("")
        }, o.prototype.add = function (t) {
            var r = this._a00 + t._a00, i = r >>> 16;
            i += this._a16 + t._a16;
            var e = i >>> 16;
            e += this._a32 + t._a32;
            var h = e >>> 16;
            return h += this._a48 + t._a48, this._a00 = 65535 & r, this._a16 = 65535 & i, this._a32 = 65535 & e, this._a48 = 65535 & h, this
        }, o.prototype.subtract = function (t) {
            return this.add(t.clone().negate())
        }, o.prototype.multiply = function (t) {
            var r = this._a00, i = this._a16, e = this._a32, h = this._a48, o = t._a00, n = t._a16, s = t._a32,
                a = t._a48, u = r * o, f = u >>> 16;
            f += r * n;
            var l = f >>> 16;
            f &= 65535, f += i * o, l += f >>> 16, l += r * s;
            var c = l >>> 16;
            return l &= 65535, l += i * n, c += l >>> 16, l &= 65535, l += e * o, c += l >>> 16, c += r * a, c &= 65535, c += i * s, c &= 65535, c += e * n, c &= 65535, c += h * o, this._a00 = 65535 & u, this._a16 = 65535 & f, this._a32 = 65535 & l, this._a48 = 65535 & c, this
        }, o.prototype.div = function (t) {
            if (0 == t._a16 && 0 == t._a32 && 0 == t._a48) {
                if (0 == t._a00)throw Error("division by zero");
                if (1 == t._a00)return this.remainder = new o(0), this
            }
            if (t.gt(this))return this.remainder = new o(0), this._a00 = 0, this._a16 = 0, this._a32 = 0, this._a48 = 0, this;
            if (this.eq(t))return this.remainder = new o(0), this._a00 = 1, this._a16 = 0, this._a32 = 0, this._a48 = 0, this;
            for (var r = t.clone(), i = -1; !this.lt(r);)r.shiftLeft(1, !0), i++;
            for (this.remainder = this.clone(), this._a00 = 0, this._a16 = 0, this._a32 = 0, this._a48 = 0; i >= 0; i--)r.shiftRight(1), this.remainder.lt(r) || (this.remainder.subtract(r), i >= 48 ? this._a48 |= 1 << i - 48 : i >= 32 ? this._a32 |= 1 << i - 32 : i >= 16 ? this._a16 |= 1 << i - 16 : this._a00 |= 1 << i);
            return this
        }, o.prototype.negate = o.prototype.not = function () {
            var t = (65535 & ~this._a00) + 1;
            return this._a00 = 65535 & t, t = (65535 & ~this._a16) + (t >>> 16), this._a16 = 65535 & t, t = (65535 & ~this._a32) + (t >>> 16), this._a32 = 65535 & t,
                this._a48 = ~this._a48 + (t >>> 16) & 65535, this
        }, o.prototype.equals = o.prototype.eq = function (t) {
            return this._a48 == t._a48 && this._a00 == t._a00 && this._a32 == t._a32 && this._a16 == t._a16
        }, o.prototype.greaterThan = o.prototype.gt = function (t) {
            return this._a48 > t._a48 ? !0 : this._a48 < t._a48 ? !1 : this._a32 > t._a32 ? !0 : this._a32 < t._a32 ? !1 : this._a16 > t._a16 ? !0 : this._a16 < t._a16 ? !1 : this._a00 > t._a00
        }, o.prototype.lessThan = o.prototype.lt = function (t) {
            return this._a48 < t._a48 ? !0 : this._a48 > t._a48 ? !1 : this._a32 < t._a32 ? !0 : this._a32 > t._a32 ? !1 : this._a16 < t._a16 ? !0 : this._a16 > t._a16 ? !1 : this._a00 < t._a00
        }, o.prototype.or = function (t) {
            return this._a00 |= t._a00, this._a16 |= t._a16, this._a32 |= t._a32, this._a48 |= t._a48, this
        }, o.prototype.and = function (t) {
            return this._a00 &= t._a00, this._a16 &= t._a16, this._a32 &= t._a32, this._a48 &= t._a48, this
        }, o.prototype.xor = function (t) {
            return this._a00 ^= t._a00, this._a16 ^= t._a16, this._a32 ^= t._a32, this._a48 ^= t._a48, this
        }, o.prototype.shiftRight = o.prototype.shiftr = function (t) {
            return t %= 64, t >= 48 ? (this._a00 = this._a48 >> t - 48, this._a16 = 0, this._a32 = 0, this._a48 = 0) : t >= 32 ? (t -= 32, this._a00 = 65535 & (this._a32 >> t | this._a48 << 16 - t), this._a16 = this._a48 >> t & 65535, this._a32 = 0, this._a48 = 0) : t >= 16 ? (t -= 16, this._a00 = 65535 & (this._a16 >> t | this._a32 << 16 - t), this._a16 = 65535 & (this._a32 >> t | this._a48 << 16 - t), this._a32 = this._a48 >> t & 65535, this._a48 = 0) : (this._a00 = 65535 & (this._a00 >> t | this._a16 << 16 - t), this._a16 = 65535 & (this._a16 >> t | this._a32 << 16 - t), this._a32 = 65535 & (this._a32 >> t | this._a48 << 16 - t), this._a48 = this._a48 >> t & 65535), this
        }, o.prototype.shiftLeft = o.prototype.shiftl = function (t, r) {
            return t %= 64, t >= 48 ? (this._a48 = this._a00 << t - 48, this._a32 = 0, this._a16 = 0, this._a00 = 0) : t >= 32 ? (t -= 32, this._a48 = this._a16 << t | this._a00 >> 16 - t, this._a32 = this._a00 << t & 65535, this._a16 = 0, this._a00 = 0) : t >= 16 ? (t -= 16, this._a48 = this._a32 << t | this._a16 >> 16 - t, this._a32 = 65535 & (this._a16 << t | this._a00 >> 16 - t), this._a16 = this._a00 << t & 65535, this._a00 = 0) : (this._a48 = this._a48 << t | this._a32 >> 16 - t, this._a32 = 65535 & (this._a32 << t | this._a16 >> 16 - t), this._a16 = 65535 & (this._a16 << t | this._a00 >> 16 - t), this._a00 = this._a00 << t & 65535), r || (this._a48 &= 65535), this
        }, o.prototype.rotateLeft = o.prototype.rotl = function (t) {
            if (t %= 64, 0 == t)return this;
            if (t >= 32) {
                var r = this._a00;
                if (this._a00 = this._a32, this._a32 = r, r = this._a48, this._a48 = this._a16, this._a16 = r, 32 == t)return this;
                t -= 32
            }
            var i = this._a48 << 16 | this._a32, e = this._a16 << 16 | this._a00, h = i << t | e >>> 32 - t,
                o = e << t | i >>> 32 - t;
            return this._a00 = 65535 & o, this._a16 = o >>> 16, this._a32 = 65535 & h, this._a48 = h >>> 16, this
        }, o.prototype.rotateRight = o.prototype.rotr = function (t) {
            if (t %= 64, 0 == t)return this;
            if (t >= 32) {
                var r = this._a00;
                if (this._a00 = this._a32, this._a32 = r, r = this._a48, this._a48 = this._a16, this._a16 = r, 32 == t)return this;
                t -= 32
            }
            var i = this._a48 << 16 | this._a32, e = this._a16 << 16 | this._a00, h = i >>> t | e << 32 - t,
                o = e >>> t | i << 32 - t;
            return this._a00 = 65535 & o, this._a16 = o >>> 16, this._a32 = 65535 & h, this._a48 = h >>> 16, this
        }, o.prototype.clone = function () {
            return new o(this._a00, this._a16, this._a32, this._a48)
        }, i = [], e = function () {
            return o
        }.apply(r, i), !(void 0 !== e && (t.exports = e))
    }(this)
}, function (t, r, i) {
    (function (r) {
        function e(t) {
            for (var r = [], i = 0, e = t.length; e > i; i++) {
                var h = t.charCodeAt(i);
                128 > h ? r.push(h) : 2048 > h ? r.push(192 | h >> 6, 128 | 63 & h) : 55296 > h || h >= 57344 ? r.push(224 | h >> 12, 128 | h >> 6 & 63, 128 | 63 & h) : (i++, h = 65536 + ((1023 & h) << 10 | 1023 & t.charCodeAt(i)), r.push(240 | h >> 18, 128 | h >> 12 & 63, 128 | h >> 6 & 63, 128 | 63 & h))
            }
            return new Uint8Array(r)
        }

        function h() {
            return 2 == arguments.length ? new h(arguments[1]).update(arguments[0]).digest() : this instanceof h ? void o.call(this, arguments[0]) : new h(arguments[0])
        }

        function o(t) {
            return this.seed = t instanceof n ? t.clone() : n(t), this.v1 = this.seed.clone().add(s).add(a), this.v2 = this.seed.clone().add(a), this.v3 = this.seed.clone(), this.v4 = this.seed.clone().subtract(s), this.total_len = 0, this.memsize = 0, this.memory = null, this
        }

        var n = i(6).UINT64, s = n("11400714785074694791"), a = n("14029467366897019727"), u = n("1609587929392839161"),
            f = n("9650029242287828579"), l = n("2870177450012600261");
        h.prototype.init = o, h.prototype.update = function (t) {
            var i, h = "string" == typeof t;
            h && (t = e(t), h = !1, i = !0), "undefined" != typeof ArrayBuffer && t instanceof ArrayBuffer && (i = !0, t = new Uint8Array(t));
            var o = 0, u = t.length, f = o + u;
            if (0 == u)return this;
            if (this.total_len += u, 0 == this.memsize && (this.memory = h ? "" : i ? new Uint8Array(32) : new r(32)), this.memsize + u < 32)return h ? this.memory += t : i ? this.memory.set(t.subarray(0, u), this.memsize) : t.copy(this.memory, this.memsize, 0, u), this.memsize += u, this;
            if (this.memsize > 0) {
                h ? this.memory += t.slice(0, 32 - this.memsize) : i ? this.memory.set(t.subarray(0, 32 - this.memsize), this.memsize) : t.copy(this.memory, this.memsize, 0, 32 - this.memsize);
                var l = 0;
                if (h) {
                    var c;
                    c = n(this.memory.charCodeAt(l + 1) << 8 | this.memory.charCodeAt(l), this.memory.charCodeAt(l + 3) << 8 | this.memory.charCodeAt(l + 2), this.memory.charCodeAt(l + 5) << 8 | this.memory.charCodeAt(l + 4), this.memory.charCodeAt(l + 7) << 8 | this.memory.charCodeAt(l + 6)), this.v1.add(c.multiply(a)).rotl(31).multiply(s), l += 8, c = n(this.memory.charCodeAt(l + 1) << 8 | this.memory.charCodeAt(l), this.memory.charCodeAt(l + 3) << 8 | this.memory.charCodeAt(l + 2), this.memory.charCodeAt(l + 5) << 8 | this.memory.charCodeAt(l + 4), this.memory.charCodeAt(l + 7) << 8 | this.memory.charCodeAt(l + 6)), this.v2.add(c.multiply(a)).rotl(31).multiply(s), l += 8, c = n(this.memory.charCodeAt(l + 1) << 8 | this.memory.charCodeAt(l), this.memory.charCodeAt(l + 3) << 8 | this.memory.charCodeAt(l + 2), this.memory.charCodeAt(l + 5) << 8 | this.memory.charCodeAt(l + 4), this.memory.charCodeAt(l + 7) << 8 | this.memory.charCodeAt(l + 6)), this.v3.add(c.multiply(a)).rotl(31).multiply(s), l += 8, c = n(this.memory.charCodeAt(l + 1) << 8 | this.memory.charCodeAt(l), this.memory.charCodeAt(l + 3) << 8 | this.memory.charCodeAt(l + 2), this.memory.charCodeAt(l + 5) << 8 | this.memory.charCodeAt(l + 4), this.memory.charCodeAt(l + 7) << 8 | this.memory.charCodeAt(l + 6)), this.v4.add(c.multiply(a)).rotl(31).multiply(s)
                } else {
                    var c;
                    c = n(this.memory[l + 1] << 8 | this.memory[l], this.memory[l + 3] << 8 | this.memory[l + 2], this.memory[l + 5] << 8 | this.memory[l + 4], this.memory[l + 7] << 8 | this.memory[l + 6]), this.v1.add(c.multiply(a)).rotl(31).multiply(s), l += 8, c = n(this.memory[l + 1] << 8 | this.memory[l], this.memory[l + 3] << 8 | this.memory[l + 2], this.memory[l + 5] << 8 | this.memory[l + 4], this.memory[l + 7] << 8 | this.memory[l + 6]), this.v2.add(c.multiply(a)).rotl(31).multiply(s), l += 8, c = n(this.memory[l + 1] << 8 | this.memory[l], this.memory[l + 3] << 8 | this.memory[l + 2], this.memory[l + 5] << 8 | this.memory[l + 4], this.memory[l + 7] << 8 | this.memory[l + 6]), this.v3.add(c.multiply(a)).rotl(31).multiply(s), l += 8, c = n(this.memory[l + 1] << 8 | this.memory[l], this.memory[l + 3] << 8 | this.memory[l + 2], this.memory[l + 5] << 8 | this.memory[l + 4], this.memory[l + 7] << 8 | this.memory[l + 6]), this.v4.add(c.multiply(a)).rotl(31).multiply(s)
                }
                o += 32 - this.memsize, this.memsize = 0, h && (this.memory = "")
            }
            if (f - 32 >= o) {
                var m = f - 32;
                do {
                    if (h) {
                        var c;
                        c = n(t.charCodeAt(o + 1) << 8 | t.charCodeAt(o), t.charCodeAt(o + 3) << 8 | t.charCodeAt(o + 2), t.charCodeAt(o + 5) << 8 | t.charCodeAt(o + 4), t.charCodeAt(o + 7) << 8 | t.charCodeAt(o + 6)), this.v1.add(c.multiply(a)).rotl(31).multiply(s), o += 8, c = n(t.charCodeAt(o + 1) << 8 | t.charCodeAt(o), t.charCodeAt(o + 3) << 8 | t.charCodeAt(o + 2), t.charCodeAt(o + 5) << 8 | t.charCodeAt(o + 4), t.charCodeAt(o + 7) << 8 | t.charCodeAt(o + 6)), this.v2.add(c.multiply(a)).rotl(31).multiply(s), o += 8, c = n(t.charCodeAt(o + 1) << 8 | t.charCodeAt(o), t.charCodeAt(o + 3) << 8 | t.charCodeAt(o + 2), t.charCodeAt(o + 5) << 8 | t.charCodeAt(o + 4), t.charCodeAt(o + 7) << 8 | t.charCodeAt(o + 6)), this.v3.add(c.multiply(a)).rotl(31).multiply(s), o += 8, c = n(t.charCodeAt(o + 1) << 8 | t.charCodeAt(o), t.charCodeAt(o + 3) << 8 | t.charCodeAt(o + 2), t.charCodeAt(o + 5) << 8 | t.charCodeAt(o + 4), t.charCodeAt(o + 7) << 8 | t.charCodeAt(o + 6)), this.v4.add(c.multiply(a)).rotl(31).multiply(s)
                    } else {
                        var c;
                        c = n(t[o + 1] << 8 | t[o], t[o + 3] << 8 | t[o + 2], t[o + 5] << 8 | t[o + 4], t[o + 7] << 8 | t[o + 6]), this.v1.add(c.multiply(a)).rotl(31).multiply(s), o += 8, c = n(t[o + 1] << 8 | t[o], t[o + 3] << 8 | t[o + 2], t[o + 5] << 8 | t[o + 4], t[o + 7] << 8 | t[o + 6]), this.v2.add(c.multiply(a)).rotl(31).multiply(s), o += 8, c = n(t[o + 1] << 8 | t[o], t[o + 3] << 8 | t[o + 2], t[o + 5] << 8 | t[o + 4], t[o + 7] << 8 | t[o + 6]), this.v3.add(c.multiply(a)).rotl(31).multiply(s), o += 8, c = n(t[o + 1] << 8 | t[o], t[o + 3] << 8 | t[o + 2], t[o + 5] << 8 | t[o + 4], t[o + 7] << 8 | t[o + 6]), this.v4.add(c.multiply(a)).rotl(31).multiply(s)
                    }
                    o += 8
                } while (m >= o)
            }
            return f > o && (h ? this.memory += t.slice(o) : i ? this.memory.set(t.subarray(o, f), this.memsize) : t.copy(this.memory, this.memsize, o, f), this.memsize = f - o), this
        }, h.prototype.digest = function () {
            var t, r, i = this.memory, e = "string" == typeof i, h = 0, o = this.memsize, c = new n;
            for (this.total_len >= 32 ? (t = this.v1.clone().rotl(1), t.add(this.v2.clone().rotl(7)), t.add(this.v3.clone().rotl(12)), t.add(this.v4.clone().rotl(18)), t.xor(this.v1.multiply(a).rotl(31).multiply(s)), t.multiply(s).add(f), t.xor(this.v2.multiply(a).rotl(31).multiply(s)), t.multiply(s).add(f), t.xor(this.v3.multiply(a).rotl(31).multiply(s)), t.multiply(s).add(f), t.xor(this.v4.multiply(a).rotl(31).multiply(s)), t.multiply(s).add(f)) : t = this.seed.clone().add(l), t.add(c.fromNumber(this.total_len)); o - 8 >= h;)e ? c.fromBits(i.charCodeAt(h + 1) << 8 | i.charCodeAt(h), i.charCodeAt(h + 3) << 8 | i.charCodeAt(h + 2), i.charCodeAt(h + 5) << 8 | i.charCodeAt(h + 4), i.charCodeAt(h + 7) << 8 | i.charCodeAt(h + 6)) : c.fromBits(i[h + 1] << 8 | i[h], i[h + 3] << 8 | i[h + 2], i[h + 5] << 8 | i[h + 4], i[h + 7] << 8 | i[h + 6]), c.multiply(a).rotl(31).multiply(s), t.xor(c).rotl(27).multiply(s).add(f), h += 8;
            for (o >= h + 4 && (e ? c.fromBits(i.charCodeAt(h + 1) << 8 | i.charCodeAt(h), i.charCodeAt(h + 3) << 8 | i.charCodeAt(h + 2), 0, 0) : c.fromBits(i[h + 1] << 8 | i[h], i[h + 3] << 8 | i[h + 2], 0, 0), t.xor(c.multiply(s)).rotl(23).multiply(a).add(u), h += 4); o > h;)c.fromBits(e ? i.charCodeAt(h++) : i[h++], 0, 0, 0), t.xor(c.multiply(l)).rotl(11).multiply(s);
            return r = t.clone().shiftRight(33), t.xor(r).multiply(a), r = t.clone().shiftRight(29), t.xor(r).multiply(u), r = t.clone().shiftRight(32), t.xor(r), this.init(this.seed), t
        }, t.exports = h
    }).call(r, i(2).Buffer)
}]);


var Sha1 = {
    'hash': function (data) {
        return XXH.h32(data, 0).toString(32);
    }
}

/**
 *  extends object prototype
 *  getRecursiveTree
 */
Object.defineProperty(Object.prototype, 'getRecursiveStrings', {
    value: function () {

        var r = [];
        Object.traverse(this, function (node, value, key, path, depth) {
            if (typeof value === 'string') {
                r.push({'key': path.join('.'), val: value});
            }
        });


        return r;


    },
    enumerable: false
});

/*
 object-traverse v0.1.1
 https://github.com/nervgh/object-traverse
 */
!function (a) {
    "use strict";
    function b(a) {
        return a instanceof Object
    }

    function c(a) {
        return "number" == typeof a && !h(a)
    }

    function d(a, c, d, e, f, h) {
        var i = [[], 0, g(a).sort(), a], j = [];
        do {
            var k = i.pop(), l = i.pop(), m = i.pop(), n = i.pop();
            for (j.push(k); l[0];) {
                var o = l.shift(), p = k[o], q = n.concat(o), r = c.call(d, k, p, o, q, m);
                if (r !== !0) {
                    if (r === !1) {
                        i.length = 0;
                        break
                    }
                    if (!(m >= h) && b(p)) {
                        if (-1 !== j.indexOf(p)) {
                            if (f)continue;
                            throw new Error("Circular reference")
                        }
                        if (!e) {
                            i.push(n, m, l, k), i.push(q, m + 1, g(p).sort(), p);
                            break
                        }
                        i.unshift(q, m + 1, g(p).sort(), p)
                    }
                }
            }
        } while (i[0]);
        return a
    }

    function e(a, b, e, g, h, i) {
        var j = b, k = e, l = 1 === g, m = !!h, n = c(i) ? i : f;
        return d(a, j, k, l, m, n)
    }

    var f = 100, g = Object.keys, h = a.isNaN;
    Object.traverse = e
}(window);


/*
 https://github.com/kvz/locutus
 */

function metaphone(word, maxPhonemes) {
    //  discuss at: http://locutus.io/php/metaphone/
    // original by: Greg Frazier
    // improved by: Brett Zamir (http://brett-zamir.me)
    // improved by: Rafał Kukawski (http://blog.kukawski.pl)
    //   example 1: metaphone('Gnu')
    //   returns 1: 'N'
    //   example 2: metaphone('bigger')
    //   returns 2: 'BKR'
    //   example 3: metaphone('accuracy')
    //   returns 3: 'AKKRS'
    //   example 4: metaphone('batch batcher')
    //   returns 4: 'BXBXR'

    var type = typeof word

    if (type === 'undefined' || type === 'object' && word !== null) {
        // weird!
        return null
    }

    // infinity and NaN values are treated as strings
    if (type === 'number') {
        if (isNaN(word)) {
            word = 'NAN'
        } else if (!isFinite(word)) {
            word = 'INF'
        }
    }

    if (maxPhonemes < 0) {
        return false
    }

    maxPhonemes = Math.floor(+maxPhonemes) || 0

    // alpha depends on locale, so this var might need an update
    // or should be turned into a regex
    // for now assuming pure a-z
    var alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    var vowel = 'AEIOU'
    var soft = 'EIY'
    var leadingNonAlpha = new RegExp('^[^' + alpha + ']+')

    word = typeof word === 'string' ? word : ''
    word = word.toUpperCase().replace(leadingNonAlpha, '')

    if (!word) {
        return ''
    }

    var is = function (p, c) {
        return c !== '' && p.indexOf(c) !== -1
    }

    var i = 0
    var cc = word.charAt(0) // current char. Short name because it's used all over the function
    var nc = word.charAt(1)  // next char
    var nnc // after next char
    var pc // previous char
    var l = word.length
    var meta = ''
    // traditional is an internal param that could be exposed for now let it be a local var
    var traditional = true

    switch (cc) {
        case 'A':
            meta += nc === 'E' ? nc : cc
            i += 1
            break
        case 'G':
        case 'K':
        case 'P':
            if (nc === 'N') {
                meta += nc
                i += 2
            }
            break
        case 'W':
            if (nc === 'R') {
                meta += nc
                i += 2
            } else if (nc === 'H' || is(vowel, nc)) {
                meta += 'W'
                i += 2
            }
            break
        case 'X':
            meta += 'S'
            i += 1
            break
        case 'E':
        case 'I':
        case 'O':
        case 'U':
            meta += cc
            i++
            break
    }

    for (; i < l && (maxPhonemes === 0 || meta.length < maxPhonemes); i += 1) { // eslint-disable-line no-unmodified-loop-condition,max-len
        cc = word.charAt(i)
        nc = word.charAt(i + 1)
        pc = word.charAt(i - 1)
        nnc = word.charAt(i + 2)

        if (cc === pc && cc !== 'C') {
            continue
        }

        switch (cc) {
            case 'B':
                if (pc !== 'M') {
                    meta += cc
                }
                break
            case 'C':
                if (is(soft, nc)) {
                    if (nc === 'I' && nnc === 'A') {
                        meta += 'X'
                    } else if (pc !== 'S') {
                        meta += 'S'
                    }
                } else if (nc === 'H') {
                    meta += !traditional && (nnc === 'R' || pc === 'S') ? 'K' : 'X'
                    i += 1
                } else {
                    meta += 'K'
                }
                break
            case 'D':
                if (nc === 'G' && is(soft, nnc)) {
                    meta += 'J'
                    i += 1
                } else {
                    meta += 'T'
                }
                break
            case 'G':
                if (nc === 'H') {
                    if (!(is('BDH', word.charAt(i - 3)) || word.charAt(i - 4) === 'H')) {
                        meta += 'F'
                        i += 1
                    }
                } else if (nc === 'N') {
                    if (is(alpha, nnc) && word.substr(i + 1, 3) !== 'NED') {
                        meta += 'K'
                    }
                } else if (is(soft, nc) && pc !== 'G') {
                    meta += 'J'
                } else {
                    meta += 'K'
                }
                break
            case 'H':
                if (is(vowel, nc) && !is('CGPST', pc)) {
                    meta += cc
                }
                break
            case 'K':
                if (pc !== 'C') {
                    meta += 'K'
                }
                break
            case 'P':
                meta += nc === 'H' ? 'F' : cc
                break
            case 'Q':
                meta += 'K'
                break
            case 'S':
                if (nc === 'I' && is('AO', nnc)) {
                    meta += 'X'
                } else if (nc === 'H') {
                    meta += 'X'
                    i += 1
                } else if (!traditional && word.substr(i + 1, 3) === 'CHW') {
                    meta += 'X'
                    i += 2
                } else {
                    meta += 'S'
                }
                break
            case 'T':
                if (nc === 'I' && is('AO', nnc)) {
                    meta += 'X'
                } else if (nc === 'H') {
                    meta += '0'
                    i += 1
                } else if (word.substr(i + 1, 2) !== 'CH') {
                    meta += 'T'
                }
                break
            case 'V':
                meta += 'F'
                break
            case 'W':
            case 'Y':
                if (is(vowel, nc)) {
                    meta += cc
                }
                break
            case 'X':
                meta += 'KS'
                break
            case 'Z':
                meta += 'S'
                break
            case 'F':
            case 'J':
            case 'L':
            case 'M':
            case 'N':
            case 'R':
                meta += cc
                break
        }
    }

    return meta
}

/*
 * https://raw.githubusercontent.com/dandean/guid/master/guid.js
 */
(function () {
    var validator = new RegExp("^[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}$", "i");

    function gen(count) {
        var out = "";
        for (var i = 0; i < count; i++) {
            out += (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        }
        return out;
    }

    function Guid(guid) {
        if (!guid) throw new TypeError("Invalid argument; `value` has no value.");

        this.value = Guid.EMPTY;

        if (guid && guid instanceof Guid) {
            this.value = guid.toString();

        } else if (guid && Object.prototype.toString.call(guid) === "[object String]" && Guid.isGuid(guid)) {
            this.value = guid;
        }

        this.equals = function (other) {
            // Comparing string `value` against provided `guid` will auto-call
            // toString on `guid` for comparison
            return Guid.isGuid(other) && this.value == other;
        };

        this.isEmpty = function () {
            return this.value === Guid.EMPTY;
        };

        this.toString = function () {
            return this.value;
        };

        this.toJSON = function () {
            return this.value;
        };
    };

    Guid.EMPTY = "00000000-0000-0000-0000-000000000000";

    Guid.isGuid = function (value) {
        return value && (value instanceof Guid || validator.test(value.toString()));
    };

    Guid.create = function () {
        return new Guid([gen(2), gen(1), gen(1), gen(1), gen(3)].join("-"));
    };

    Guid.raw = function () {
        return [gen(2), gen(1), gen(1), gen(1), gen(3)].join("-");
    };

    if (typeof module != 'undefined' && module.exports) {
        module.exports = Guid;
    }
    else if (typeof window != 'undefined') {
        window.Guid = Guid;
    }
})();


/*
 * https://github.com/abdmob/x2js
 */
(function (a, b) {
    if (typeof define === "function" && define.amd) {
        define([], b);
    } else {
        if (typeof exports === "object") {
            module.exports = b();
        } else {
            a.X2JS = b();
        }
    }
}(this, function () {
    return function (z) {
        var t = "1.2.0";
        z = z || {};
        i();
        u();
        function i() {
            if (z.escapeMode === undefined) {
                z.escapeMode = true;
            }
            z.attributePrefix = z.attributePrefix || "_";
            z.arrayAccessForm = z.arrayAccessForm || "none";
            z.emptyNodeForm = z.emptyNodeForm || "text";
            if (z.enableToStringFunc === undefined) {
                z.enableToStringFunc = true;
            }
            z.arrayAccessFormPaths = z.arrayAccessFormPaths || [];
            if (z.skipEmptyTextNodesForObj === undefined) {
                z.skipEmptyTextNodesForObj = true;
            }
            if (z.stripWhitespaces === undefined) {
                z.stripWhitespaces = true;
            }
            z.datetimeAccessFormPaths = z.datetimeAccessFormPaths || [];
            if (z.useDoubleQuotes === undefined) {
                z.useDoubleQuotes = false;
            }
            z.xmlElementsFilter = z.xmlElementsFilter || [];
            z.jsonPropertiesFilter = z.jsonPropertiesFilter || [];
            if (z.keepCData === undefined) {
                z.keepCData = false;
            }
        }

        var h = {ELEMENT_NODE: 1, TEXT_NODE: 3, CDATA_SECTION_NODE: 4, COMMENT_NODE: 8, DOCUMENT_NODE: 9};

        function u() {
        }

        function x(B) {
            var C = B.localName;
            if (C == null) {
                C = B.baseName;
            }
            if (C == null || C == "") {
                C = B.nodeName;
            }
            return C;
        }

        function r(B) {
            return B.prefix;
        }

        function s(B) {
            if (typeof(B) == "string") {
                return B.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
            } else {
                return B;
            }
        }

        function k(B) {
            return B.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
        }

        function w(C, F, D, E) {
            var B = 0;
            for (; B < C.length; B++) {
                var G = C[B];
                if (typeof G === "string") {
                    if (G == E) {
                        break;
                    }
                } else {
                    if (G instanceof RegExp) {
                        if (G.test(E)) {
                            break;
                        }
                    } else {
                        if (typeof G === "function") {
                            if (G(F, D, E)) {
                                break;
                            }
                        }
                    }
                }
            }
            return B != C.length;
        }

        function n(D, B, C) {
            switch (z.arrayAccessForm) {
                case"property":
                    if (!(D[B] instanceof Array)) {
                        D[B + "_asArray"] = [D[B]];
                    } else {
                        D[B + "_asArray"] = D[B];
                    }
                    break;
            }
            if (!(D[B] instanceof Array) && z.arrayAccessFormPaths.length > 0) {
                if (w(z.arrayAccessFormPaths, D, B, C)) {
                    D[B] = [D[B]];
                }
            }
        }

        function a(G) {
            var E = G.split(/[-T:+Z]/g);
            var F = new Date(E[0], E[1] - 1, E[2]);
            var D = E[5].split(".");
            F.setHours(E[3], E[4], D[0]);
            if (D.length > 1) {
                F.setMilliseconds(D[1]);
            }
            if (E[6] && E[7]) {
                var C = E[6] * 60 + Number(E[7]);
                var B = /\d\d-\d\d:\d\d$/.test(G) ? "-" : "+";
                C = 0 + (B == "-" ? -1 * C : C);
                F.setMinutes(F.getMinutes() - C - F.getTimezoneOffset());
            } else {
                if (G.indexOf("Z", G.length - 1) !== -1) {
                    F = new Date(Date.UTC(F.getFullYear(), F.getMonth(), F.getDate(), F.getHours(), F.getMinutes(), F.getSeconds(), F.getMilliseconds()));
                }
            }
            return F;
        }

        function q(D, B, C) {
            if (z.datetimeAccessFormPaths.length > 0) {
                var E = C.split(".#")[0];
                if (w(z.datetimeAccessFormPaths, D, B, E)) {
                    return a(D);
                } else {
                    return D;
                }
            } else {
                return D;
            }
        }

        function b(E, C, B, D) {
            if (C == h.ELEMENT_NODE && z.xmlElementsFilter.length > 0) {
                return w(z.xmlElementsFilter, E, B, D);
            } else {
                return true;
            }
        }

        function A(D, J) {
            if (D.nodeType == h.DOCUMENT_NODE) {
                var K = new Object;
                var B = D.childNodes;
                for (var L = 0; L < B.length; L++) {
                    var C = B.item(L);
                    if (C.nodeType == h.ELEMENT_NODE) {
                        var I = x(C);
                        K[I] = A(C, I);
                    }
                }
                return K;
            } else {
                if (D.nodeType == h.ELEMENT_NODE) {
                    var K = new Object;
                    K.__cnt = 0;
                    var B = D.childNodes;
                    for (var L = 0; L < B.length; L++) {
                        var C = B.item(L);
                        var I = x(C);
                        if (C.nodeType != h.COMMENT_NODE) {
                            var H = J + "." + I;
                            if (b(K, C.nodeType, I, H)) {
                                K.__cnt++;
                                if (K[I] == null) {
                                    K[I] = A(C, H);
                                    n(K, I, H);
                                } else {
                                    if (K[I] != null) {
                                        if (!(K[I] instanceof Array)) {
                                            K[I] = [K[I]];
                                            n(K, I, H);
                                        }
                                    }
                                    (K[I])[K[I].length] = A(C, H);
                                }
                            }
                        }
                    }
                    for (var E = 0; E < D.attributes.length; E++) {
                        var F = D.attributes.item(E);
                        K.__cnt++;
                        K[z.attributePrefix + F.name] = F.value;
                    }
                    var G = r(D);
                    if (G != null && G != "") {
                        K.__cnt++;
                        K.__prefix = G;
                    }
                    if (K["#text"] != null) {
                        K.__text = K["#text"];
                        if (K.__text instanceof Array) {
                            K.__text = K.__text.join("\n");
                        }
                        if (z.stripWhitespaces) {
                            K.__text = K.__text.trim();
                        }
                        delete K["#text"];
                        if (z.arrayAccessForm == "property") {
                            delete K["#text_asArray"];
                        }
                        K.__text = q(K.__text, I, J + "." + I);
                    }
                    if (K["#cdata-section"] != null) {
                        K.__cdata = K["#cdata-section"];
                        delete K["#cdata-section"];
                        if (z.arrayAccessForm == "property") {
                            delete K["#cdata-section_asArray"];
                        }
                    }
                    if (K.__cnt == 0 && z.emptyNodeForm == "text") {
                        K = "";
                    } else {
                        if (K.__cnt == 1 && K.__text != null) {
                            K = K.__text;
                        } else {
                            if (K.__cnt == 1 && K.__cdata != null && !z.keepCData) {
                                K = K.__cdata;
                            } else {
                                if (K.__cnt > 1 && K.__text != null && z.skipEmptyTextNodesForObj) {
                                    if ((z.stripWhitespaces && K.__text == "") || (K.__text.trim() == "")) {
                                        delete K.__text;
                                    }
                                }
                            }
                        }
                    }
                    delete K.__cnt;
                    if (z.enableToStringFunc && (K.__text != null || K.__cdata != null)) {
                        K.toString = function () {
                            return (this.__text != null ? this.__text : "") + (this.__cdata != null ? this.__cdata : "");
                        };
                    }
                    return K;
                } else {
                    if (D.nodeType == h.TEXT_NODE || D.nodeType == h.CDATA_SECTION_NODE) {
                        return D.nodeValue;
                    }
                }
            }
        }

        function o(I, F, H, C) {
            var E = "<" + ((I != null && I.__prefix != null) ? (I.__prefix + ":") : "") + F;
            if (H != null) {
                for (var G = 0; G < H.length; G++) {
                    var D = H[G];
                    var B = I[D];
                    if (z.escapeMode) {
                        B = s(B);
                    }
                    E += " " + D.substr(z.attributePrefix.length) + "=";
                    if (z.useDoubleQuotes) {
                        E += '"' + B + '"';
                    } else {
                        E += "'" + B + "'";
                    }
                }
            }
            if (!C) {
                E += ">";
            } else {
                E += "/>";
            }
            return E;
        }

        function j(C, B) {
            return "</" + (C.__prefix != null ? (C.__prefix + ":") : "") + B + ">";
        }

        function v(C, B) {
            return C.indexOf(B, C.length - B.length) !== -1;
        }

        function y(C, B) {
            if ((z.arrayAccessForm == "property" && v(B.toString(), ("_asArray"))) || B.toString().indexOf(z.attributePrefix) == 0 || B.toString().indexOf("__") == 0 || (C[B] instanceof Function)) {
                return true;
            } else {
                return false;
            }
        }

        function m(D) {
            var C = 0;
            if (D instanceof Object) {
                for (var B in D) {
                    if (y(D, B)) {
                        continue;
                    }
                    C++;
                }
            }
            return C;
        }

        function l(D, B, C) {
            return z.jsonPropertiesFilter.length == 0 || C == "" || w(z.jsonPropertiesFilter, D, B, C);
        }

        function c(D) {
            var C = [];
            if (D instanceof Object) {
                for (var B in D) {
                    if (B.toString().indexOf("__") == -1 && B.toString().indexOf(z.attributePrefix) == 0) {
                        C.push(B);
                    }
                }
            }
            return C;
        }

        function g(C) {
            var B = "";
            if (C.__cdata != null) {
                B += "<![CDATA[" + C.__cdata + "]]>";
            }
            if (C.__text != null) {
                if (z.escapeMode) {
                    B += s(C.__text);
                } else {
                    B += C.__text;
                }
            }
            return B;
        }

        function d(C) {
            var B = "";
            if (C instanceof Object) {
                B += g(C);
            } else {
                if (C != null) {
                    if (z.escapeMode) {
                        B += s(C);
                    } else {
                        B += C;
                    }
                }
            }
            return B;
        }

        function p(C, B) {
            if (C === "") {
                return B;
            } else {
                return C + "." + B;
            }
        }

        function f(D, G, F, E) {
            var B = "";
            if (D.length == 0) {
                B += o(D, G, F, true);
            } else {
                for (var C = 0; C < D.length; C++) {
                    B += o(D[C], G, c(D[C]), false);
                    B += e(D[C], p(E, G));
                    B += j(D[C], G);
                }
            }
            return B;
        }

        function e(I, H) {
            var B = "";
            var F = m(I);
            if (F > 0) {
                for (var E in I) {
                    if (y(I, E) || (H != "" && !l(I, E, p(H, E)))) {
                        continue;
                    }
                    var D = I[E];
                    var G = c(D);
                    if (D == null || D == undefined) {
                        B += o(D, E, G, true);
                    } else {
                        if (D instanceof Object) {
                            if (D instanceof Array) {
                                B += f(D, E, G, H);
                            } else {
                                if (D instanceof Date) {
                                    B += o(D, E, G, false);
                                    B += D.toISOString();
                                    B += j(D, E);
                                } else {
                                    var C = m(D);
                                    if (C > 0 || D.__text != null || D.__cdata != null) {
                                        B += o(D, E, G, false);
                                        B += e(D, p(H, E));
                                        B += j(D, E);
                                    } else {
                                        B += o(D, E, G, true);
                                    }
                                }
                            }
                        } else {
                            B += o(D, E, G, false);
                            B += d(D);
                            B += j(D, E);
                        }
                    }
                }
            }
            B += d(I);
            return B;
        }

        this.parseXmlString = function (D) {
            var F = window.ActiveXObject || "ActiveXObject" in window;
            if (D === undefined) {
                return null;
            }
            var E;
            if (window.DOMParser) {
                var G = new window.DOMParser();
                var B = null;
                if (!F) {
                    try {
                        B = G.parseFromString("INVALID", "text/xml").getElementsByTagName("parsererror")[0].namespaceURI;
                    } catch (C) {
                        B = null;
                    }
                }
                try {
                    E = G.parseFromString(D, "text/xml");
                    if (B != null && E.getElementsByTagNameNS(B, "parsererror").length > 0) {
                        E = null;
                    }
                } catch (C) {
                    E = null;
                }
            } else {
                if (D.indexOf("<?") == 0) {
                    D = D.substr(D.indexOf("?>") + 2);
                }
                E = new ActiveXObject("Microsoft.XMLDOM");
                E.async = "false";
                E.loadXML(D);
            }
            return E;
        };
        this.asArray = function (B) {
            if (B === undefined || B == null) {
                return [];
            } else {
                if (B instanceof Array) {
                    return B;
                } else {
                    return [B];
                }
            }
        };
        this.toXmlDateTime = function (B) {
            if (B instanceof Date) {
                return B.toISOString();
            } else {
                if (typeof(B) === "number") {
                    return new Date(B).toISOString();
                } else {
                    return null;
                }
            }
        };
        this.asDateTime = function (B) {
            if (typeof(B) == "string") {
                return a(B);
            } else {
                return B;
            }
        };
        this.xml2json = function (B) {
            return A(B);
        };
        this.xml_str2json = function (B) {
            var C = this.parseXmlString(B);
            if (C != null) {
                return this.xml2json(C);
            } else {
                return null;
            }
        };
        this.json2xml_str = function (B) {
            return e(B, "");
        };
        this.json2xml = function (C) {
            var B = this.json2xml_str(C);
            return this.parseXmlString(B);
        };
        this.getVersion = function () {
            return t;
        };
    };
}));
