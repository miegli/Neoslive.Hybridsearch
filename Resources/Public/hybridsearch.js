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

                        if (property == '_index') {
                            return 0.05;
                        }

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

                        if (self.getFilter().getNodeType() === false) {
                            // skipp
                            return null;
                        }

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
                                            expand: false
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


                        }, 5);

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


                        if (this.getFilter().getNodePath().length > 0 && node.uri !== undefined && (node.uri.path && node.uri.path.substr(0, this.getFilter().getNodePath().length) != this.getFilter().getNodePath())) {
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
                                }, 2);
                            }, 2);

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

                                                                    if (ref.isLoadingAllFromNodeType == undefined || ref.isLoadingAllFromNodeType == false) {
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
                                                                    } else {
                                                                        // load all nodes from node type
                                                                        execute(keyword, data, ref);
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
                        return Sha1.hash({nodes: nodes, q: this.getFilter().getQuery()});
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
                        //var hasDistinct = self.getResults().hasDistincts();
                        var boost = {};
                        var length = data.length;
                        var cachedindex = true;


                        if (keyword !== undefined && keywords == undefined) {
                            // skip
                            return null;
                        }
                        angular.forEach(data, function (value, key) {

                                if (value && nodesIndexed[value.node.hash] == undefined) {
                                    var doc = {};
                                    cachedindex = false;

                                    //if (hasDistinct == true || self.isFiltered(value.node) === false) {

                                    nodes[value.node.identifier] = value.node;

                                    if (value.node != undefined && value.node.properties != undefined) {
                                        //angular.forEach(JSON.parse(JSON.stringify(value.node.properties)), function (propvalue, property) {

                                        if (length > 50 && keyword !== undefined) {

                                            if (value.node.properties['_nodeLabel'] == undefined) {
                                                value.node.properties['_nodeLabel'] = '';
                                            }
                                            if (value.node.properties['__google'] == undefined) {
                                                value.node.properties['__google'] = '';
                                            }
                                            if (value.node.properties[value.nodeType + '-neoslivehybridsearchkeywords'] == undefined) {
                                                value.node.properties[value.nodeType + '-neoslivehybridsearchkeywords'] = '';
                                            }

                                            var p = value.node.properties[value.nodeType + '-neoslivehybridsearchkeywords'] + " " + value.node.properties['_nodeLabel'] + " " + value.node.properties['__google'];
                                            var s = "";

                                            if (keyword.length > 4) {
                                                angular.forEach(value.node.properties, function (propvalue, property) {
                                                    if (self.getBoost(property) > 0 && typeof propvalue == 'string') {
                                                        s = s + " " + propvalue.toLowerCase()
                                                    }
                                                });
                                                angular.forEach(keywords, function (k) {
                                                    if (k.length > 3) {
                                                        var i = s.indexOf(k.toLowerCase());
                                                        if (i >= 0) {
                                                            p = p + " " + s.substr(i - 16, i + 16);
                                                        }
                                                    }
                                                });
                                            }
                                            doc['_index'] = p;
                                        } else {

                                            angular.forEach(value.node.properties, function (propvalue, property) {
                                                if (self.getBoost(property) > 0) {
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
                                                                    doc[property] = propvalue.replace(/(<([^>]+)>)/ig, " ").substr(0, 1024);
                                                                }
                                                            }

                                                        }
                                                    }
                                                }
                                            });
                                        }

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
                                            if (cachedindex) {
                                                nodesIndexed[value.node.hash] = true;
                                            }

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


                    return Sha1.hash(ids);
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
                                b = b.trim();
                            }
                            b = b.trim();
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

                                        var k = Sha1.hash(v);

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

                                            var k = Sha1.hash(valueJson);

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
                                                var k = Sha1.hash(variant);

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

                                        var k = Sha1.hash(propvalue);


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

                    return Sha1.hash(hash);
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
/* https://github.com/puleos/object-hash /*
/*                                                                                                /*
/* Copyright (c) 2014 object-hash contributors
* MIT license                                                                                     /*
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var t;"undefined"!=typeof window?t=window:"undefined"!=typeof global?t=global:"undefined"!=typeof self&&(t=self),t.objectHash=e()}}(function(){return function e(t,n,r){function o(u,a){if(!n[u]){if(!t[u]){var f="function"==typeof require&&require;if(!a&&f)return f(u,!0);if(i)return i(u,!0);throw new Error("Cannot find module '"+u+"'")}var s=n[u]={exports:{}};t[u][0].call(s.exports,function(e){var n=t[u][1][e];return o(n?n:e)},s,s.exports,e,t,n,r)}return n[u].exports}for(var i="function"==typeof require&&require,u=0;u<r.length;u++)o(r[u]);return o}({1:[function(e,t,n){(function(r,o,i,u,a,f,s,c,l){"use strict";function d(e,t){return t=h(e,t),g(e,t)}function h(e,t){if(t=t||{},t.algorithm=t.algorithm||"sha1",t.encoding=t.encoding||"hex",t.excludeValues=!!t.excludeValues,t.algorithm=t.algorithm.toLowerCase(),t.encoding=t.encoding.toLowerCase(),t.ignoreUnknown=t.ignoreUnknown===!0,t.respectType=t.respectType!==!1,t.respectFunctionNames=t.respectFunctionNames!==!1,t.respectFunctionProperties=t.respectFunctionProperties!==!1,t.unorderedArrays=t.unorderedArrays===!0,t.unorderedSets=t.unorderedSets!==!1,t.replacer=t.replacer||void 0,"undefined"==typeof e)throw new Error("Object argument required.");for(var n=0;n<v.length;++n)v[n].toLowerCase()===t.algorithm.toLowerCase()&&(t.algorithm=v[n]);if(v.indexOf(t.algorithm)===-1)throw new Error('Algorithm "'+t.algorithm+'"  not supported. supported values: '+v.join(", "));if(m.indexOf(t.encoding)===-1&&"passthrough"!==t.algorithm)throw new Error('Encoding "'+t.encoding+'"  not supported. supported values: '+m.join(", "));return t}function p(e){if("function"!=typeof e)return!1;var t=/^function\s+\w*\s*\(\s*\)\s*{\s+\[native code\]\s+}$/i;return null!=t.exec(Function.prototype.toString.call(e))}function g(e,t){var n;n="passthrough"!==t.algorithm?b.createHash(t.algorithm):new w,"undefined"==typeof n.write&&(n.write=n.update,n.end=n.update);var r=y(t,n);if(r.dispatch(e),n.update||n.end(""),n.digest)return n.digest("buffer"===t.encoding?void 0:t.encoding);var o=n.read();return"buffer"===t.encoding?o:o.toString(t.encoding)}function y(e,t,n){n=n||[];var r=function(e){return t.update?t.update(e,"utf8"):t.write(e,"utf8")};return{dispatch:function(t){e.replacer&&(t=e.replacer(t));var n=typeof t;return null===t&&(n="null"),this["_"+n](t)},_object:function(t){var o=/\[object (.*)\]/i,u=Object.prototype.toString.call(t),a=o.exec(u);a=a?a[1]:"unknown:["+u+"]",a=a.toLowerCase();var f=null;if((f=n.indexOf(t))>=0)return this.dispatch("[CIRCULAR:"+f+"]");if(n.push(t),"undefined"!=typeof i&&i.isBuffer&&i.isBuffer(t))return r("buffer:"),r(t);if("object"===a||"function"===a){var s=Object.keys(t).sort();e.respectType===!1||p(t)||s.splice(0,0,"prototype","__proto__","constructor"),r("object:"+s.length+":");var c=this;return s.forEach(function(n){c.dispatch(n),r(":"),e.excludeValues||c.dispatch(t[n]),r(",")})}if(!this["_"+a]){if(e.ignoreUnknown)return r("["+a+"]");throw new Error('Unknown object type "'+a+'"')}this["_"+a](t)},_array:function(t,o){o="undefined"!=typeof o?o:e.unorderedArrays!==!1;var i=this;if(r("array:"+t.length+":"),!o||t.length<=1)return t.forEach(function(e){return i.dispatch(e)});var u=[],a=t.map(function(t){var r=new w,o=n.slice(),i=y(e,r,o);return i.dispatch(t),u=u.concat(o.slice(n.length)),r.read().toString()});return n=n.concat(u),a.sort(),this._array(a,!1)},_date:function(e){return r("date:"+e.toJSON())},_symbol:function(e){return r("symbol:"+e.toString())},_error:function(e){return r("error:"+e.toString())},_boolean:function(e){return r("bool:"+e.toString())},_string:function(e){r("string:"+e.length+":"),r(e)},_function:function(t){r("fn:"),p(t)?this.dispatch("[native]"):this.dispatch(t.toString()),e.respectFunctionNames!==!1&&this.dispatch("function-name:"+String(t.name)),e.respectFunctionProperties&&this._object(t)},_number:function(e){return r("number:"+e.toString())},_xml:function(e){return r("xml:"+e.toString())},_null:function(){return r("Null")},_undefined:function(){return r("Undefined")},_regexp:function(e){return r("regex:"+e.toString())},_uint8array:function(e){return r("uint8array:"),this.dispatch(Array.prototype.slice.call(e))},_uint8clampedarray:function(e){return r("uint8clampedarray:"),this.dispatch(Array.prototype.slice.call(e))},_int8array:function(e){return r("uint8array:"),this.dispatch(Array.prototype.slice.call(e))},_uint16array:function(e){return r("uint16array:"),this.dispatch(Array.prototype.slice.call(e))},_int16array:function(e){return r("uint16array:"),this.dispatch(Array.prototype.slice.call(e))},_uint32array:function(e){return r("uint32array:"),this.dispatch(Array.prototype.slice.call(e))},_int32array:function(e){return r("uint32array:"),this.dispatch(Array.prototype.slice.call(e))},_float32array:function(e){return r("float32array:"),this.dispatch(Array.prototype.slice.call(e))},_float64array:function(e){return r("float64array:"),this.dispatch(Array.prototype.slice.call(e))},_arraybuffer:function(e){return r("arraybuffer:"),this.dispatch(new Uint8Array(e))},_url:function(e){return r("url:"+e.toString(),"utf8")},_map:function(t){r("map:");var n=Array.from(t);return this._array(n,e.unorderedSets!==!1)},_set:function(t){r("set:");var n=Array.from(t);return this._array(n,e.unorderedSets!==!1)},_blob:function(){if(e.ignoreUnknown)return r("[blob]");throw Error('Hashing Blob objects is currently not supported\n(see https://github.com/puleos/object-hash/issues/26)\nUse "options.replacer" or "options.ignoreUnknown"\n')},_domwindow:function(){return r("domwindow")},_process:function(){return r("process")},_timer:function(){return r("timer")},_pipe:function(){return r("pipe")},_tcp:function(){return r("tcp")},_udp:function(){return r("udp")},_tty:function(){return r("tty")},_statwatcher:function(){return r("statwatcher")},_securecontext:function(){return r("securecontext")},_connection:function(){return r("connection")},_zlib:function(){return r("zlib")},_context:function(){return r("context")},_nodescript:function(){return r("nodescript")},_httpparser:function(){return r("httpparser")},_dataview:function(){return r("dataview")},_signal:function(){return r("signal")},_fsevent:function(){return r("fsevent")},_tlswrap:function(){return r("tlswrap")}}}function w(){return{buf:"",write:function(e){this.buf+=e},end:function(e){this.buf+=e},read:function(){return this.buf}}}var b=e("crypto");n=t.exports=d,n.sha1=function(e){return d(e)},n.keys=function(e){return d(e,{excludeValues:!0,algorithm:"sha1",encoding:"hex"})},n.MD5=function(e){return d(e,{algorithm:"md5",encoding:"hex"})},n.keysMD5=function(e){return d(e,{algorithm:"md5",encoding:"hex",excludeValues:!0})};var v=b.getHashes?b.getHashes().slice():["sha1","md5"];v.push("passthrough");var m=["buffer","hex","binary","base64"];n.writeToStream=function(e,t,n){return"undefined"==typeof n&&(n=t,t={}),t=h(e,t),y(t,n).dispatch(e)}}).call(this,e("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_8c3adc78.js","/")},{buffer:3,crypto:5,lYpoI2:10}],2:[function(e,t,n){(function(e,t,r,o,i,u,a,f,s){var c="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";!function(e){"use strict";function t(e){var t=e.charCodeAt(0);return t===i||t===l?62:t===u||t===d?63:t<a?-1:t<a+10?t-a+26+26:t<s+26?t-s:t<f+26?t-f+26:void 0}function n(e){function n(e){s[l++]=e}var r,i,u,a,f,s;if(e.length%4>0)throw new Error("Invalid string. Length must be a multiple of 4");var c=e.length;f="="===e.charAt(c-2)?2:"="===e.charAt(c-1)?1:0,s=new o(3*e.length/4-f),u=f>0?e.length-4:e.length;var l=0;for(r=0,i=0;r<u;r+=4,i+=3)a=t(e.charAt(r))<<18|t(e.charAt(r+1))<<12|t(e.charAt(r+2))<<6|t(e.charAt(r+3)),n((16711680&a)>>16),n((65280&a)>>8),n(255&a);return 2===f?(a=t(e.charAt(r))<<2|t(e.charAt(r+1))>>4,n(255&a)):1===f&&(a=t(e.charAt(r))<<10|t(e.charAt(r+1))<<4|t(e.charAt(r+2))>>2,n(a>>8&255),n(255&a)),s}function r(e){function t(e){return c.charAt(e)}function n(e){return t(e>>18&63)+t(e>>12&63)+t(e>>6&63)+t(63&e)}var r,o,i,u=e.length%3,a="";for(r=0,i=e.length-u;r<i;r+=3)o=(e[r]<<16)+(e[r+1]<<8)+e[r+2],a+=n(o);switch(u){case 1:o=e[e.length-1],a+=t(o>>2),a+=t(o<<4&63),a+="==";break;case 2:o=(e[e.length-2]<<8)+e[e.length-1],a+=t(o>>10),a+=t(o>>4&63),a+=t(o<<2&63),a+="="}return a}var o="undefined"!=typeof Uint8Array?Uint8Array:Array,i="+".charCodeAt(0),u="/".charCodeAt(0),a="0".charCodeAt(0),f="a".charCodeAt(0),s="A".charCodeAt(0),l="-".charCodeAt(0),d="_".charCodeAt(0);e.toByteArray=n,e.fromByteArray=r}("undefined"==typeof n?this.base64js={}:n)}).call(this,e("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/base64-js/lib/b64.js","/node_modules/gulp-browserify/node_modules/base64-js/lib")},{buffer:3,lYpoI2:10}],3:[function(e,t,n){(function(t,r,o,i,u,a,f,s,c){function o(e,t,n){if(!(this instanceof o))return new o(e,t,n);var r=typeof e;if("base64"===t&&"string"===r)for(e=N(e);e.length%4!==0;)e+="=";var i;if("number"===r)i=F(e);else if("string"===r)i=o.byteLength(e,t);else{if("object"!==r)throw new Error("First argument needs to be a number, array or string.");i=F(e.length)}var u;o._useTypedArrays?u=o._augment(new Uint8Array(i)):(u=this,u.length=i,u._isBuffer=!0);var a;if(o._useTypedArrays&&"number"==typeof e.byteLength)u._set(e);else if(O(e))for(a=0;a<i;a++)o.isBuffer(e)?u[a]=e.readUInt8(a):u[a]=e[a];else if("string"===r)u.write(e,0,t);else if("number"===r&&!o._useTypedArrays&&!n)for(a=0;a<i;a++)u[a]=0;return u}function l(e,t,n,r){n=Number(n)||0;var i=e.length-n;r?(r=Number(r),r>i&&(r=i)):r=i;var u=t.length;G(u%2===0,"Invalid hex string"),r>u/2&&(r=u/2);for(var a=0;a<r;a++){var f=parseInt(t.substr(2*a,2),16);G(!isNaN(f),"Invalid hex string"),e[n+a]=f}return o._charsWritten=2*a,a}function d(e,t,n,r){var i=o._charsWritten=W(V(t),e,n,r);return i}function h(e,t,n,r){var i=o._charsWritten=W(q(t),e,n,r);return i}function p(e,t,n,r){return h(e,t,n,r)}function g(e,t,n,r){var i=o._charsWritten=W(R(t),e,n,r);return i}function y(e,t,n,r){var i=o._charsWritten=W(P(t),e,n,r);return i}function w(e,t,n){return 0===t&&n===e.length?K.fromByteArray(e):K.fromByteArray(e.slice(t,n))}function b(e,t,n){var r="",o="";n=Math.min(e.length,n);for(var i=t;i<n;i++)e[i]<=127?(r+=J(o)+String.fromCharCode(e[i]),o=""):o+="%"+e[i].toString(16);return r+J(o)}function v(e,t,n){var r="";n=Math.min(e.length,n);for(var o=t;o<n;o++)r+=String.fromCharCode(e[o]);return r}function m(e,t,n){return v(e,t,n)}function _(e,t,n){var r=e.length;(!t||t<0)&&(t=0),(!n||n<0||n>r)&&(n=r);for(var o="",i=t;i<n;i++)o+=H(e[i]);return o}function E(e,t,n){for(var r=e.slice(t,n),o="",i=0;i<r.length;i+=2)o+=String.fromCharCode(r[i]+256*r[i+1]);return o}function I(e,t,n,r){r||(G("boolean"==typeof n,"missing or invalid endian"),G(void 0!==t&&null!==t,"missing offset"),G(t+1<e.length,"Trying to read beyond buffer length"));var o=e.length;if(!(t>=o)){var i;return n?(i=e[t],t+1<o&&(i|=e[t+1]<<8)):(i=e[t]<<8,t+1<o&&(i|=e[t+1])),i}}function A(e,t,n,r){r||(G("boolean"==typeof n,"missing or invalid endian"),G(void 0!==t&&null!==t,"missing offset"),G(t+3<e.length,"Trying to read beyond buffer length"));var o=e.length;if(!(t>=o)){var i;return n?(t+2<o&&(i=e[t+2]<<16),t+1<o&&(i|=e[t+1]<<8),i|=e[t],t+3<o&&(i+=e[t+3]<<24>>>0)):(t+1<o&&(i=e[t+1]<<16),t+2<o&&(i|=e[t+2]<<8),t+3<o&&(i|=e[t+3]),i+=e[t]<<24>>>0),i}}function B(e,t,n,r){r||(G("boolean"==typeof n,"missing or invalid endian"),G(void 0!==t&&null!==t,"missing offset"),G(t+1<e.length,"Trying to read beyond buffer length"));var o=e.length;if(!(t>=o)){var i=I(e,t,n,!0),u=32768&i;return u?(65535-i+1)*-1:i}}function L(e,t,n,r){r||(G("boolean"==typeof n,"missing or invalid endian"),G(void 0!==t&&null!==t,"missing offset"),G(t+3<e.length,"Trying to read beyond buffer length"));var o=e.length;if(!(t>=o)){var i=A(e,t,n,!0),u=2147483648&i;return u?(4294967295-i+1)*-1:i}}function U(e,t,n,r){return r||(G("boolean"==typeof n,"missing or invalid endian"),G(t+3<e.length,"Trying to read beyond buffer length")),Q.read(e,t,n,23,4)}function x(e,t,n,r){return r||(G("boolean"==typeof n,"missing or invalid endian"),G(t+7<e.length,"Trying to read beyond buffer length")),Q.read(e,t,n,52,8)}function S(e,t,n,r,o){o||(G(void 0!==t&&null!==t,"missing value"),G("boolean"==typeof r,"missing or invalid endian"),G(void 0!==n&&null!==n,"missing offset"),G(n+1<e.length,"trying to write beyond buffer length"),z(t,65535));var i=e.length;if(!(n>=i))for(var u=0,a=Math.min(i-n,2);u<a;u++)e[n+u]=(t&255<<8*(r?u:1-u))>>>8*(r?u:1-u)}function C(e,t,n,r,o){o||(G(void 0!==t&&null!==t,"missing value"),G("boolean"==typeof r,"missing or invalid endian"),G(void 0!==n&&null!==n,"missing offset"),G(n+3<e.length,"trying to write beyond buffer length"),z(t,4294967295));var i=e.length;if(!(n>=i))for(var u=0,a=Math.min(i-n,4);u<a;u++)e[n+u]=t>>>8*(r?u:3-u)&255}function j(e,t,n,r,o){o||(G(void 0!==t&&null!==t,"missing value"),G("boolean"==typeof r,"missing or invalid endian"),G(void 0!==n&&null!==n,"missing offset"),G(n+1<e.length,"Trying to write beyond buffer length"),X(t,32767,-32768));var i=e.length;n>=i||(t>=0?S(e,t,n,r,o):S(e,65535+t+1,n,r,o))}function k(e,t,n,r,o){o||(G(void 0!==t&&null!==t,"missing value"),G("boolean"==typeof r,"missing or invalid endian"),G(void 0!==n&&null!==n,"missing offset"),G(n+3<e.length,"Trying to write beyond buffer length"),X(t,2147483647,-2147483648));var i=e.length;n>=i||(t>=0?C(e,t,n,r,o):C(e,4294967295+t+1,n,r,o))}function T(e,t,n,r,o){o||(G(void 0!==t&&null!==t,"missing value"),G("boolean"==typeof r,"missing or invalid endian"),G(void 0!==n&&null!==n,"missing offset"),G(n+3<e.length,"Trying to write beyond buffer length"),$(t,3.4028234663852886e38,-3.4028234663852886e38));var i=e.length;n>=i||Q.write(e,t,n,r,23,4)}function M(e,t,n,r,o){o||(G(void 0!==t&&null!==t,"missing value"),G("boolean"==typeof r,"missing or invalid endian"),G(void 0!==n&&null!==n,"missing offset"),G(n+7<e.length,"Trying to write beyond buffer length"),$(t,1.7976931348623157e308,-1.7976931348623157e308));var i=e.length;n>=i||Q.write(e,t,n,r,52,8)}function N(e){return e.trim?e.trim():e.replace(/^\s+|\s+$/g,"")}function Y(e,t,n){return"number"!=typeof e?n:(e=~~e,e>=t?t:e>=0?e:(e+=t,e>=0?e:0))}function F(e){return e=~~Math.ceil(+e),e<0?0:e}function D(e){return(Array.isArray||function(e){return"[object Array]"===Object.prototype.toString.call(e)})(e)}function O(e){return D(e)||o.isBuffer(e)||e&&"object"==typeof e&&"number"==typeof e.length}function H(e){return e<16?"0"+e.toString(16):e.toString(16)}function V(e){for(var t=[],n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<=127)t.push(e.charCodeAt(n));else{var o=n;r>=55296&&r<=57343&&n++;for(var i=encodeURIComponent(e.slice(o,n+1)).substr(1).split("%"),u=0;u<i.length;u++)t.push(parseInt(i[u],16))}}return t}function q(e){for(var t=[],n=0;n<e.length;n++)t.push(255&e.charCodeAt(n));return t}function P(e){for(var t,n,r,o=[],i=0;i<e.length;i++)t=e.charCodeAt(i),n=t>>8,r=t%256,o.push(r),o.push(n);return o}function R(e){return K.toByteArray(e)}function W(e,t,n,r){for(var o=0;o<r&&!(o+n>=t.length||o>=e.length);o++)t[o+n]=e[o];return o}function J(e){try{return decodeURIComponent(e)}catch(t){return String.fromCharCode(65533)}}function z(e,t){G("number"==typeof e,"cannot write a non-number as a number"),G(e>=0,"specified a negative value for writing an unsigned value"),G(e<=t,"value is larger than maximum value for type"),G(Math.floor(e)===e,"value has a fractional component")}function X(e,t,n){G("number"==typeof e,"cannot write a non-number as a number"),G(e<=t,"value larger than maximum allowed value"),G(e>=n,"value smaller than minimum allowed value"),G(Math.floor(e)===e,"value has a fractional component")}function $(e,t,n){G("number"==typeof e,"cannot write a non-number as a number"),G(e<=t,"value larger than maximum allowed value"),G(e>=n,"value smaller than minimum allowed value")}function G(e,t){if(!e)throw new Error(t||"Failed assertion")}var K=e("base64-js"),Q=e("ieee754");n.Buffer=o,n.SlowBuffer=o,n.INSPECT_MAX_BYTES=50,o.poolSize=8192,o._useTypedArrays=function(){try{var e=new ArrayBuffer(0),t=new Uint8Array(e);return t.foo=function(){return 42},42===t.foo()&&"function"==typeof t.subarray}catch(n){return!1}}(),o.isEncoding=function(e){switch(String(e).toLowerCase()){case"hex":case"utf8":case"utf-8":case"ascii":case"binary":case"base64":case"raw":case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return!0;default:return!1}},o.isBuffer=function(e){return!(null===e||void 0===e||!e._isBuffer)},o.byteLength=function(e,t){var n;switch(e+="",t||"utf8"){case"hex":n=e.length/2;break;case"utf8":case"utf-8":n=V(e).length;break;case"ascii":case"binary":case"raw":n=e.length;break;case"base64":n=R(e).length;break;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":n=2*e.length;break;default:throw new Error("Unknown encoding")}return n},o.concat=function(e,t){if(G(D(e),"Usage: Buffer.concat(list, [totalLength])\nlist should be an Array."),0===e.length)return new o(0);if(1===e.length)return e[0];var n;if("number"!=typeof t)for(t=0,n=0;n<e.length;n++)t+=e[n].length;var r=new o(t),i=0;for(n=0;n<e.length;n++){var u=e[n];u.copy(r,i),i+=u.length}return r},o.prototype.write=function(e,t,n,r){if(isFinite(t))isFinite(n)||(r=n,n=void 0);else{var o=r;r=t,t=n,n=o}t=Number(t)||0;var i=this.length-t;n?(n=Number(n),n>i&&(n=i)):n=i,r=String(r||"utf8").toLowerCase();var u;switch(r){case"hex":u=l(this,e,t,n);break;case"utf8":case"utf-8":u=d(this,e,t,n);break;case"ascii":u=h(this,e,t,n);break;case"binary":u=p(this,e,t,n);break;case"base64":u=g(this,e,t,n);break;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":u=y(this,e,t,n);break;default:throw new Error("Unknown encoding")}return u},o.prototype.toString=function(e,t,n){var r=this;if(e=String(e||"utf8").toLowerCase(),t=Number(t)||0,n=void 0!==n?Number(n):n=r.length,n===t)return"";var o;switch(e){case"hex":o=_(r,t,n);break;case"utf8":case"utf-8":o=b(r,t,n);break;case"ascii":o=v(r,t,n);break;case"binary":o=m(r,t,n);break;case"base64":o=w(r,t,n);break;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":o=E(r,t,n);break;default:throw new Error("Unknown encoding")}return o},o.prototype.toJSON=function(){return{type:"Buffer",data:Array.prototype.slice.call(this._arr||this,0)}},o.prototype.copy=function(e,t,n,r){var i=this;if(n||(n=0),r||0===r||(r=this.length),t||(t=0),r!==n&&0!==e.length&&0!==i.length){G(r>=n,"sourceEnd < sourceStart"),G(t>=0&&t<e.length,"targetStart out of bounds"),G(n>=0&&n<i.length,"sourceStart out of bounds"),G(r>=0&&r<=i.length,"sourceEnd out of bounds"),r>this.length&&(r=this.length),e.length-t<r-n&&(r=e.length-t+n);var u=r-n;if(u<100||!o._useTypedArrays)for(var a=0;a<u;a++)e[a+t]=this[a+n];else e._set(this.subarray(n,n+u),t)}},o.prototype.slice=function(e,t){var n=this.length;if(e=Y(e,n,0),t=Y(t,n,n),o._useTypedArrays)return o._augment(this.subarray(e,t));for(var r=t-e,i=new o(r,(void 0),(!0)),u=0;u<r;u++)i[u]=this[u+e];return i},o.prototype.get=function(e){return console.log(".get() is deprecated. Access using array indexes instead."),this.readUInt8(e)},o.prototype.set=function(e,t){return console.log(".set() is deprecated. Access using array indexes instead."),this.writeUInt8(e,t)},o.prototype.readUInt8=function(e,t){if(t||(G(void 0!==e&&null!==e,"missing offset"),G(e<this.length,"Trying to read beyond buffer length")),!(e>=this.length))return this[e]},o.prototype.readUInt16LE=function(e,t){return I(this,e,!0,t)},o.prototype.readUInt16BE=function(e,t){return I(this,e,!1,t)},o.prototype.readUInt32LE=function(e,t){return A(this,e,!0,t)},o.prototype.readUInt32BE=function(e,t){return A(this,e,!1,t)},o.prototype.readInt8=function(e,t){if(t||(G(void 0!==e&&null!==e,"missing offset"),G(e<this.length,"Trying to read beyond buffer length")),!(e>=this.length)){var n=128&this[e];return n?(255-this[e]+1)*-1:this[e]}},o.prototype.readInt16LE=function(e,t){return B(this,e,!0,t)},o.prototype.readInt16BE=function(e,t){return B(this,e,!1,t)},o.prototype.readInt32LE=function(e,t){return L(this,e,!0,t)},o.prototype.readInt32BE=function(e,t){return L(this,e,!1,t)},o.prototype.readFloatLE=function(e,t){return U(this,e,!0,t)},o.prototype.readFloatBE=function(e,t){return U(this,e,!1,t)},o.prototype.readDoubleLE=function(e,t){return x(this,e,!0,t)},o.prototype.readDoubleBE=function(e,t){return x(this,e,!1,t)},o.prototype.writeUInt8=function(e,t,n){n||(G(void 0!==e&&null!==e,"missing value"),G(void 0!==t&&null!==t,"missing offset"),G(t<this.length,"trying to write beyond buffer length"),z(e,255)),t>=this.length||(this[t]=e)},o.prototype.writeUInt16LE=function(e,t,n){S(this,e,t,!0,n)},o.prototype.writeUInt16BE=function(e,t,n){S(this,e,t,!1,n)},o.prototype.writeUInt32LE=function(e,t,n){C(this,e,t,!0,n)},o.prototype.writeUInt32BE=function(e,t,n){C(this,e,t,!1,n)},o.prototype.writeInt8=function(e,t,n){n||(G(void 0!==e&&null!==e,"missing value"),G(void 0!==t&&null!==t,"missing offset"),G(t<this.length,"Trying to write beyond buffer length"),X(e,127,-128)),t>=this.length||(e>=0?this.writeUInt8(e,t,n):this.writeUInt8(255+e+1,t,n))},o.prototype.writeInt16LE=function(e,t,n){j(this,e,t,!0,n)},o.prototype.writeInt16BE=function(e,t,n){j(this,e,t,!1,n)},o.prototype.writeInt32LE=function(e,t,n){k(this,e,t,!0,n)},o.prototype.writeInt32BE=function(e,t,n){k(this,e,t,!1,n)},o.prototype.writeFloatLE=function(e,t,n){T(this,e,t,!0,n)},o.prototype.writeFloatBE=function(e,t,n){T(this,e,t,!1,n)},o.prototype.writeDoubleLE=function(e,t,n){M(this,e,t,!0,n)},o.prototype.writeDoubleBE=function(e,t,n){M(this,e,t,!1,n)},o.prototype.fill=function(e,t,n){if(e||(e=0),t||(t=0),n||(n=this.length),"string"==typeof e&&(e=e.charCodeAt(0)),G("number"==typeof e&&!isNaN(e),"value is not a number"),G(n>=t,"end < start"),n!==t&&0!==this.length){G(t>=0&&t<this.length,"start out of bounds"),G(n>=0&&n<=this.length,"end out of bounds");for(var r=t;r<n;r++)this[r]=e}},o.prototype.inspect=function(){for(var e=[],t=this.length,r=0;r<t;r++)if(e[r]=H(this[r]),r===n.INSPECT_MAX_BYTES){e[r+1]="...";break}return"<Buffer "+e.join(" ")+">"},o.prototype.toArrayBuffer=function(){if("undefined"!=typeof Uint8Array){if(o._useTypedArrays)return new o(this).buffer;for(var e=new Uint8Array(this.length),t=0,n=e.length;t<n;t+=1)e[t]=this[t];return e.buffer}throw new Error("Buffer.toArrayBuffer not supported in this browser")};var Z=o.prototype;o._augment=function(e){return e._isBuffer=!0,e._get=e.get,e._set=e.set,e.get=Z.get,e.set=Z.set,e.write=Z.write,e.toString=Z.toString,e.toLocaleString=Z.toString,e.toJSON=Z.toJSON,e.copy=Z.copy,e.slice=Z.slice,e.readUInt8=Z.readUInt8,e.readUInt16LE=Z.readUInt16LE,e.readUInt16BE=Z.readUInt16BE,e.readUInt32LE=Z.readUInt32LE,e.readUInt32BE=Z.readUInt32BE,e.readInt8=Z.readInt8,e.readInt16LE=Z.readInt16LE,e.readInt16BE=Z.readInt16BE,e.readInt32LE=Z.readInt32LE,e.readInt32BE=Z.readInt32BE,e.readFloatLE=Z.readFloatLE,e.readFloatBE=Z.readFloatBE,e.readDoubleLE=Z.readDoubleLE,e.readDoubleBE=Z.readDoubleBE,e.writeUInt8=Z.writeUInt8,e.writeUInt16LE=Z.writeUInt16LE,e.writeUInt16BE=Z.writeUInt16BE,e.writeUInt32LE=Z.writeUInt32LE,e.writeUInt32BE=Z.writeUInt32BE,e.writeInt8=Z.writeInt8,e.writeInt16LE=Z.writeInt16LE,e.writeInt16BE=Z.writeInt16BE,e.writeInt32LE=Z.writeInt32LE,e.writeInt32BE=Z.writeInt32BE,e.writeFloatLE=Z.writeFloatLE,e.writeFloatBE=Z.writeFloatBE,e.writeDoubleLE=Z.writeDoubleLE,e.writeDoubleBE=Z.writeDoubleBE,e.fill=Z.fill,e.inspect=Z.inspect,e.toArrayBuffer=Z.toArrayBuffer,e}}).call(this,e("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/buffer/index.js","/node_modules/gulp-browserify/node_modules/buffer")},{"base64-js":2,buffer:3,ieee754:11,lYpoI2:10}],4:[function(e,t,n){(function(n,r,o,i,u,a,f,s,c){function l(e,t){if(e.length%p!==0){var n=e.length+(p-e.length%p);e=o.concat([e,g],n)}for(var r=[],i=t?e.readInt32BE:e.readInt32LE,u=0;u<e.length;u+=p)r.push(i.call(e,u));return r}function d(e,t,n){for(var r=new o(t),i=n?r.writeInt32BE:r.writeInt32LE,u=0;u<e.length;u++)i.call(r,e[u],4*u,!0);return r}function h(e,t,n,r){o.isBuffer(e)||(e=new o(e));var i=t(l(e,r),e.length*y);return d(i,n,r)}var o=e("buffer").Buffer,p=4,g=new o(p);g.fill(0);var y=8;t.exports={hash:h}}).call(this,e("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/crypto-browserify/helpers.js","/node_modules/gulp-browserify/node_modules/crypto-browserify")},{buffer:3,lYpoI2:10}],5:[function(e,t,n){(function(t,r,o,i,u,a,f,s,c){function l(e,t,n){o.isBuffer(t)||(t=new o(t)),o.isBuffer(n)||(n=new o(n)),t.length>m?t=e(t):t.length<m&&(t=o.concat([t,_],m));for(var r=new o(m),i=new o(m),u=0;u<m;u++)r[u]=54^t[u],i[u]=92^t[u];var a=e(o.concat([r,n]));return e(o.concat([i,a]))}function d(e,t){e=e||"sha1";var n=v[e],r=[],i=0;return n||h("algorithm:",e,"is not yet supported"),{update:function(e){return o.isBuffer(e)||(e=new o(e)),r.push(e),i+=e.length,this},digest:function(e){var i=o.concat(r),u=t?l(n,t,i):n(i);return r=null,e?u.toString(e):u}}}function h(){var e=[].slice.call(arguments).join(" ");throw new Error([e,"we accept pull requests","http://github.com/dominictarr/crypto-browserify"].join("\n"))}function p(e,t){for(var n in e)t(e[n],n)}var o=e("buffer").Buffer,g=e("./sha"),y=e("./sha256"),w=e("./rng"),b=e("./md5"),v={sha1:g,sha256:y,md5:b},m=64,_=new o(m);_.fill(0),n.createHash=function(e){return d(e)},n.createHmac=function(e,t){return d(e,t)},n.randomBytes=function(e,t){if(!t||!t.call)return new o(w(e));try{t.call(this,void 0,new o(w(e)))}catch(n){t(n)}},p(["createCredentials","createCipher","createCipheriv","createDecipher","createDecipheriv","createSign","createVerify","createDiffieHellman","pbkdf2"],function(e){n[e]=function(){h("sorry,",e,"is not implemented yet")}})}).call(this,e("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/crypto-browserify/index.js","/node_modules/gulp-browserify/node_modules/crypto-browserify")},{"./md5":6,"./rng":7,"./sha":8,"./sha256":9,buffer:3,lYpoI2:10}],6:[function(e,t,n){(function(n,r,o,i,u,a,f,s,c){function l(e,t){e[t>>5]|=128<<t%32,e[(t+64>>>9<<4)+14]=t;for(var n=1732584193,r=-271733879,o=-1732584194,i=271733878,u=0;u<e.length;u+=16){var a=n,f=r,s=o,c=i;n=h(n,r,o,i,e[u+0],7,-680876936),i=h(i,n,r,o,e[u+1],12,-389564586),o=h(o,i,n,r,e[u+2],17,606105819),r=h(r,o,i,n,e[u+3],22,-1044525330),n=h(n,r,o,i,e[u+4],7,-176418897),i=h(i,n,r,o,e[u+5],12,1200080426),o=h(o,i,n,r,e[u+6],17,-1473231341),r=h(r,o,i,n,e[u+7],22,-45705983),n=h(n,r,o,i,e[u+8],7,1770035416),i=h(i,n,r,o,e[u+9],12,-1958414417),o=h(o,i,n,r,e[u+10],17,-42063),r=h(r,o,i,n,e[u+11],22,-1990404162),n=h(n,r,o,i,e[u+12],7,1804603682),i=h(i,n,r,o,e[u+13],12,-40341101),o=h(o,i,n,r,e[u+14],17,-1502002290),r=h(r,o,i,n,e[u+15],22,1236535329),n=p(n,r,o,i,e[u+1],5,-165796510),i=p(i,n,r,o,e[u+6],9,-1069501632),o=p(o,i,n,r,e[u+11],14,643717713),r=p(r,o,i,n,e[u+0],20,-373897302),n=p(n,r,o,i,e[u+5],5,-701558691),i=p(i,n,r,o,e[u+10],9,38016083),o=p(o,i,n,r,e[u+15],14,-660478335),r=p(r,o,i,n,e[u+4],20,-405537848),n=p(n,r,o,i,e[u+9],5,568446438),i=p(i,n,r,o,e[u+14],9,-1019803690),o=p(o,i,n,r,e[u+3],14,-187363961),r=p(r,o,i,n,e[u+8],20,1163531501),n=p(n,r,o,i,e[u+13],5,-1444681467),i=p(i,n,r,o,e[u+2],9,-51403784),o=p(o,i,n,r,e[u+7],14,1735328473),r=p(r,o,i,n,e[u+12],20,-1926607734),n=g(n,r,o,i,e[u+5],4,-378558),i=g(i,n,r,o,e[u+8],11,-2022574463),o=g(o,i,n,r,e[u+11],16,1839030562),r=g(r,o,i,n,e[u+14],23,-35309556),n=g(n,r,o,i,e[u+1],4,-1530992060),i=g(i,n,r,o,e[u+4],11,1272893353),o=g(o,i,n,r,e[u+7],16,-155497632),r=g(r,o,i,n,e[u+10],23,-1094730640),n=g(n,r,o,i,e[u+13],4,681279174),i=g(i,n,r,o,e[u+0],11,-358537222),o=g(o,i,n,r,e[u+3],16,-722521979),r=g(r,o,i,n,e[u+6],23,76029189),n=g(n,r,o,i,e[u+9],4,-640364487),i=g(i,n,r,o,e[u+12],11,-421815835),o=g(o,i,n,r,e[u+15],16,530742520),r=g(r,o,i,n,e[u+2],23,-995338651),n=y(n,r,o,i,e[u+0],6,-198630844),i=y(i,n,r,o,e[u+7],10,1126891415),o=y(o,i,n,r,e[u+14],15,-1416354905),r=y(r,o,i,n,e[u+5],21,-57434055),n=y(n,r,o,i,e[u+12],6,1700485571),i=y(i,n,r,o,e[u+3],10,-1894986606),o=y(o,i,n,r,e[u+10],15,-1051523),r=y(r,o,i,n,e[u+1],21,-2054922799),n=y(n,r,o,i,e[u+8],6,1873313359),i=y(i,n,r,o,e[u+15],10,-30611744),o=y(o,i,n,r,e[u+6],15,-1560198380),r=y(r,o,i,n,e[u+13],21,1309151649),n=y(n,r,o,i,e[u+4],6,-145523070),i=y(i,n,r,o,e[u+11],10,-1120210379),o=y(o,i,n,r,e[u+2],15,718787259),r=y(r,o,i,n,e[u+9],21,-343485551),n=w(n,a),r=w(r,f),o=w(o,s),i=w(i,c)}return Array(n,r,o,i)}function d(e,t,n,r,o,i){return w(b(w(w(t,e),w(r,i)),o),n)}function h(e,t,n,r,o,i,u){return d(t&n|~t&r,e,t,o,i,u)}function p(e,t,n,r,o,i,u){return d(t&r|n&~r,e,t,o,i,u)}function g(e,t,n,r,o,i,u){return d(t^n^r,e,t,o,i,u)}function y(e,t,n,r,o,i,u){return d(n^(t|~r),e,t,o,i,u)}function w(e,t){var n=(65535&e)+(65535&t),r=(e>>16)+(t>>16)+(n>>16);return r<<16|65535&n}function b(e,t){return e<<t|e>>>32-t}var v=e("./helpers");t.exports=function(e){return v.hash(e,l,16)}}).call(this,e("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/crypto-browserify/md5.js","/node_modules/gulp-browserify/node_modules/crypto-browserify")},{"./helpers":4,buffer:3,lYpoI2:10}],7:[function(e,t,n){(function(e,n,r,o,i,u,a,f,s){!function(){var e,n,r=this;e=function(e){for(var t,t,n=new Array(e),r=0;r<e;r++)0==(3&r)&&(t=4294967296*Math.random()),n[r]=t>>>((3&r)<<3)&255;return n},r.crypto&&crypto.getRandomValues&&(n=function(e){var t=new Uint8Array(e);return crypto.getRandomValues(t),t}),t.exports=n||e}()}).call(this,e("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/crypto-browserify/rng.js","/node_modules/gulp-browserify/node_modules/crypto-browserify")},{buffer:3,lYpoI2:10}],8:[function(e,t,n){(function(n,r,o,i,u,a,f,s,c){function l(e,t){e[t>>5]|=128<<24-t%32,e[(t+64>>9<<4)+15]=t;for(var n=Array(80),r=1732584193,o=-271733879,i=-1732584194,u=271733878,a=-1009589776,f=0;f<e.length;f+=16){for(var s=r,c=o,l=i,y=u,w=a,b=0;b<80;b++){b<16?n[b]=e[f+b]:n[b]=g(n[b-3]^n[b-8]^n[b-14]^n[b-16],1);var v=p(p(g(r,5),d(b,o,i,u)),p(p(a,n[b]),h(b)));a=u,u=i,i=g(o,30),o=r,r=v}r=p(r,s),o=p(o,c),i=p(i,l),u=p(u,y),a=p(a,w)}return Array(r,o,i,u,a)}function d(e,t,n,r){return e<20?t&n|~t&r:e<40?t^n^r:e<60?t&n|t&r|n&r:t^n^r}function h(e){return e<20?1518500249:e<40?1859775393:e<60?-1894007588:-899497514}function p(e,t){var n=(65535&e)+(65535&t),r=(e>>16)+(t>>16)+(n>>16);return r<<16|65535&n}function g(e,t){return e<<t|e>>>32-t}var y=e("./helpers");t.exports=function(e){return y.hash(e,l,20,!0)}}).call(this,e("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/crypto-browserify/sha.js","/node_modules/gulp-browserify/node_modules/crypto-browserify")},{"./helpers":4,buffer:3,lYpoI2:10}],9:[function(e,t,n){(function(n,r,o,i,u,a,f,s,c){var l=e("./helpers"),d=function(e,t){var n=(65535&e)+(65535&t),r=(e>>16)+(t>>16)+(n>>16);return r<<16|65535&n},h=function(e,t){return e>>>t|e<<32-t},p=function(e,t){return e>>>t},g=function(e,t,n){return e&t^~e&n},y=function(e,t,n){return e&t^e&n^t&n},w=function(e){return h(e,2)^h(e,13)^h(e,22)},b=function(e){return h(e,6)^h(e,11)^h(e,25)},v=function(e){return h(e,7)^h(e,18)^p(e,3)},m=function(e){return h(e,17)^h(e,19)^p(e,10)},_=function(e,t){var n,r,o,i,u,a,f,s,c,l,h,p,_=new Array(1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298),E=new Array(1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225),I=new Array(64);
    e[t>>5]|=128<<24-t%32,e[(t+64>>9<<4)+15]=t;for(var c=0;c<e.length;c+=16){n=E[0],r=E[1],o=E[2],i=E[3],u=E[4],a=E[5],f=E[6],s=E[7];for(var l=0;l<64;l++)l<16?I[l]=e[l+c]:I[l]=d(d(d(m(I[l-2]),I[l-7]),v(I[l-15])),I[l-16]),h=d(d(d(d(s,b(u)),g(u,a,f)),_[l]),I[l]),p=d(w(n),y(n,r,o)),s=f,f=a,a=u,u=d(i,h),i=o,o=r,r=n,n=d(h,p);E[0]=d(n,E[0]),E[1]=d(r,E[1]),E[2]=d(o,E[2]),E[3]=d(i,E[3]),E[4]=d(u,E[4]),E[5]=d(a,E[5]),E[6]=d(f,E[6]),E[7]=d(s,E[7])}return E};t.exports=function(e){return l.hash(e,_,32,!0)}}).call(this,e("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/crypto-browserify/sha256.js","/node_modules/gulp-browserify/node_modules/crypto-browserify")},{"./helpers":4,buffer:3,lYpoI2:10}],10:[function(e,t,n){(function(e,n,r,o,i,u,a,f,s){function c(){}var e=t.exports={};e.nextTick=function(){var e="undefined"!=typeof window&&window.setImmediate,t="undefined"!=typeof window&&window.postMessage&&window.addEventListener;if(e)return function(e){return window.setImmediate(e)};if(t){var n=[];return window.addEventListener("message",function(e){var t=e.source;if((t===window||null===t)&&"process-tick"===e.data&&(e.stopPropagation(),n.length>0)){var r=n.shift();r()}},!0),function(e){n.push(e),window.postMessage("process-tick","*")}}return function(e){setTimeout(e,0)}}(),e.title="browser",e.browser=!0,e.env={},e.argv=[],e.on=c,e.addListener=c,e.once=c,e.off=c,e.removeListener=c,e.removeAllListeners=c,e.emit=c,e.binding=function(e){throw new Error("process.binding is not supported")},e.cwd=function(){return"/"},e.chdir=function(e){throw new Error("process.chdir is not supported")}}).call(this,e("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/gulp-browserify/node_modules/process/browser.js","/node_modules/gulp-browserify/node_modules/process")},{buffer:3,lYpoI2:10}],11:[function(e,t,n){(function(e,t,r,o,i,u,a,f,s){n.read=function(e,t,n,r,o){var i,u,a=8*o-r-1,f=(1<<a)-1,s=f>>1,c=-7,l=n?o-1:0,d=n?-1:1,h=e[t+l];for(l+=d,i=h&(1<<-c)-1,h>>=-c,c+=a;c>0;i=256*i+e[t+l],l+=d,c-=8);for(u=i&(1<<-c)-1,i>>=-c,c+=r;c>0;u=256*u+e[t+l],l+=d,c-=8);if(0===i)i=1-s;else{if(i===f)return u?NaN:(h?-1:1)*(1/0);u+=Math.pow(2,r),i-=s}return(h?-1:1)*u*Math.pow(2,i-r)},n.write=function(e,t,n,r,o,i){var u,a,f,s=8*i-o-1,c=(1<<s)-1,l=c>>1,d=23===o?Math.pow(2,-24)-Math.pow(2,-77):0,h=r?0:i-1,p=r?1:-1,g=t<0||0===t&&1/t<0?1:0;for(t=Math.abs(t),isNaN(t)||t===1/0?(a=isNaN(t)?1:0,u=c):(u=Math.floor(Math.log(t)/Math.LN2),t*(f=Math.pow(2,-u))<1&&(u--,f*=2),t+=u+l>=1?d/f:d*Math.pow(2,1-l),t*f>=2&&(u++,f/=2),u+l>=c?(a=0,u=c):u+l>=1?(a=(t*f-1)*Math.pow(2,o),u+=l):(a=t*Math.pow(2,l-1)*Math.pow(2,o),u=0));o>=8;e[n+h]=255&a,h+=p,a/=256,o-=8);for(u=u<<o|a,s+=o;s>0;e[n+h]=255&u,h+=p,u/=256,s-=8);e[n+h-p]|=128*g}}).call(this,e("lYpoI2"),"undefined"!=typeof self?self:"undefined"!=typeof window?window:{},e("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/ieee754/index.js","/node_modules/ieee754")},{buffer:3,lYpoI2:10}]},{},[1])(1)});

var Sha1 = {
    'hash': function (data) {
        return objectHash.sha1(data);
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
