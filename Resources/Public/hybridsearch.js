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
    angular.module('hybridsearch').factory('$hybridsearch', ['$hybridsearchObject',

        function ($hybridsearchObject) {

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
                setLastSync: function (lastsync) {
                    this.$$conf.lastsync = lastsync;

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
                },

                /**
                 * @private
                 * @returns Firebase App
                 */
                getLastSync: function () {

                    if (this.$$conf.lastsync === undefined || this.$$conf.lastsync == null) {
                        this.$$conf.lastsync = 0;
                    }
                    return this.$$conf.lastsync;
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
                    nodesIndexed, nodesLastCount, nodes, nodesLastHash, nodeTypeLabels, emojis, resultGroupedBy,
                    resultCategorizedBy,
                    resultOrderBy, propertiesBoost, NodeTypeBoostFactor, ParentNodeTypeBoostFactor, NodeUrlBoostFactor,
                    isRunning,
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
                emojis = {};
                propertiesBoost = {};
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

                        if (val !== null && typeof val == 'object' && val.node !== undefined && val.nodeType !== undefined && val.identifier !== undefined) {
                            self.properties[key] = new HybridsearchResultsNode(val);
                        } else {
                            if (val !== null && typeof val == 'object' && val[0] !== undefined && val[0].node !== undefined && val[0].nodeType !== undefined && val[0].identifier !== undefined) {
                                var tv = [];
                                angular.forEach(self.properties[key], function (v, k) {
                                    tv.push(new HybridsearchResultsNode(self.properties[key][k].node, k));
                                });
                                self.properties[key] = tv;
                            }
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

                                    var branch = snapshot.val();


                                    /**
                                     * watch last sync
                                     */
                                    var q = hybridsearch.$firebase().database().ref("lastsync" + "/" + hybridsearch.$$conf.workspace + "/" + branch);
                                    q.on("value", function (snapshot) {
                                        hybridsearch.setLastSync(snapshot.val());
                                        hybridsearch.setBranch(branch);
                                        isRunning = true;
                                    });


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
                                if (found > 0 && self.getFilter().getNodeType().length == found) {
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

                        if (property == '_nodeLabel') {
                            return 1;
                        }

                        if (propertiesBoost[property] !== undefined) {
                            return propertiesBoost[property];
                        }

                        if (propertiesBoost !== undefined && propertiesBoost[property] == undefined && property.indexOf(".") > -1) {
                            property = property.substr(0, property.indexOf("."));

                            if (property == '') {
                                return 1;
                            }

                        }

                        if (propertiesBoost[property] === undefined && nodetype !== undefined) {
                            if (propertiesBoost[property.substr(nodetype.length + 1)]) {
                                propertiesBoost[property] = propertiesBoost[property.substr(nodetype.length + 1)];
                            }
                        }


                        if (nodetype !== undefined && nodetype.length > property.length) {
                            property = nodetype + "-" + property;
                        }

                        var pb = propertiesBoost !== undefined && propertiesBoost[property] !== undefined ? propertiesBoost[property] : property == 'breadcrumb' ? 50 : property.substr(-28) == 'neoslivehybridsearchkeywords' ? 500 : 10;
                        propertiesBoost[property] = pb;

                        return pb;


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

                        if (node.grandParentNode != undefined && ParentNodeTypeBoostFactor !== undefined) {
                            if (ParentNodeTypeBoostFactor[node.grandParentNode.nodeType] != undefined) {
                                return ParentNodeTypeBoostFactor[node.grandParentNode.nodeType];
                            }
                        }

                        return 1;

                    },

                    /**
                     * @private
                     * @param {node}
                     * @returns {number}
                     */
                    getNodeTypeBoostFactor: function (node) {

                        if (node.nodeType != undefined && NodeTypeBoostFactor !== undefined) {
                            if (NodeTypeBoostFactor[node.nodeType] != undefined) {
                                return NodeTypeBoostFactor[node.nodeType];
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
                                }
                            });

                        }


                        if (typeof b == 'object') {

                            if (b[node.nodeType] !== undefined) {
                                return b[node.nodeType];
                            }

                            if (b['*'] !== undefined) {
                                return b['*'];
                            }

                            return 1;


                        } else {
                            return b;
                        }


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
                    setEmojis: function (e) {
                        emojis = e;
                    },
                    /**
                     * @private
                     * @param emmoji
                     */
                    getEmoji: function (emoji) {
                        return emojis[emoji] == undefined ? emoji : emojis[emoji];
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
                    setNodeTypeBoostFactor: function (boost) {

                        angular.forEach(boost, function (k, b) {
                            boost[b.replace(/[:\.]/g, '-').toLowerCase()] = k;
                        });
                        NodeTypeBoostFactor = boost;
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


                                    // check if result has filtered results

                                    if (result.length) {
                                        var filteredNodes = 0;
                                        angular.forEach(result, function (item) {
                                            if (self.isFiltered(nodes[item.ref]) === true) {
                                                filteredNodes++;
                                            }
                                        });
                                        if (result.length - filteredNodes === 0) {
                                            result = lunrSearch.search(self.getFilter().getQuery(), {
                                                fields: fields,
                                                bool: "OR",
                                                expand: true
                                            });
                                        }

                                    }


                                    if (result.length > 0) {

                                        if (hasDistinct) {
                                            angular.forEach(result, function (item) {
                                                    if (nodes[item.ref] !== undefined) {
                                                        unfilteredResult.push(nodes[item.ref]);
                                                    }
                                                }
                                            );
                                        }

                                        var resultByNodeType = {};
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


                                                }

                                            }
                                        );


                                    }


                                }


                                var preOrdered = $filter('orderBy')(preOrdered, function (item) {

                                    item.score = Math.floor((item.score * self.getParentNodeTypeBoostFactor(nodes[item.ref]) * self.getNodeTypeBoostFactor(nodes[item.ref]) * self.getNodeUrlBoostFactor(nodes[item.ref])));


                                    if (nodes[item.ref]['__algoliaranking'] !== undefined) {
                                        item.score = item.score - (2 * nodes[item.ref]['__algoliaranking']);
                                        if (item.score < 1) {
                                            item.score = 1;
                                        }
                                    }

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
                                var hasdistinctfilters = false;
                                angular.forEach(self.getResults().$$data.distincts, function (distinct, property) {
                                    if (self.getResults().$$data.distinctsConfiguration[property].affectedBySearchResult == true) {
                                        nodeObject['_isfiltered'][property] = self.isFiltered(nodeObject, property);
                                        hasdistinctfilters = true;
                                    }
                                });
                                if (hasdistinctfilters) {
                                    unfilteredResultNodes.push(nodeObject);
                                }
                            });

                            results.updateDistincts(unfilteredResultNodes);

                        }


                        if (wasloadedfromInput == false) {

                            results.getApp().setResults(items, nodes, self, customquery == undefined ? false : true, self);
                            lastSearchApplyTimeout = null;
                        }


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


                            var keywords = self.getFilter().getQueryKeywords();


                            // fetch index from given keywords
                            if (!self.getConfig('algolia') || keywords.length == 0) {
                                var searchIndex = new this.SearchIndexInstance(self, keywords);
                                lastSearchInstance = searchIndex.getIndex();
                                var counter = 0;
                                clearInterval(searchInstancesInterval);
                                searchInstancesInterval = setInterval(function () {
                                    counter++;
                                    if (lastSearchInstance.$$data.canceled === true || counter > 55000 || lastSearchInstance.$$data.proceeded.length >= lastSearchInstance.$$data.running) {
                                        clearInterval(searchInstancesInterval);
                                        lastSearchInstance.execute(self, lastSearchInstance);
                                        self.search(nodes);
                                    }
                                }, 25);


                            } else {

                                window.clearTimeout(getIndexTimeout);

                                // algolia mode

                                var config = self.getConfig('algolia');
                                var hybridconfig = self.getHybridsearch().$$conf;
                                var client = algoliasearch(config.applicationID, config.apiKey);
                                var index = client.initIndex(hybridconfig.site + '-' + hybridconfig.workspace + '-' + hybridconfig.dimension);

                                self.clearLocalIndex();

                                index.search(self.getFilter().getQuery(), {
                                    hitsPerPage: 250
                                }, function searchDone(err, content) {
                                    if (err) {
                                        return;
                                    }
                                    self.addLocalIndex(content.hits);
                                    self.search();
                                });


                            }


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


                                    if (uniquarrayfinal === undefined) {
                                        var uniquarrayfinal = [null];
                                    }

                                    clearTimeout(self.getIndexInterval());

                                    angular.forEach(uniquarrayfinal, function (keyword) {

                                        var refs = self.getIndex(keyword);
                                        if (refs !== undefined && refs && refs.length == undefined) {
                                            var refs = [refs];
                                        }

                                        if (refs !== null && refs.length) {
                                            angular.forEach(refs, function (ref) {


                                                    if (self.isLoadedAll(ref.socket.toString()) == false && self.isLoadedAll(JSON.stringify(self.getFilter().getNodeType())) == false) {

                                                        var canceller = $q.defer();

                                                        if (self.getConfig('realtime') === null && ref.socket !== undefined) {
                                                            staticCachedNodes = {};
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
                                                                            if (staticCachedNodes !== undefined && staticCachedNodes[nodetype] == undefined) {
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
                                                                                        headers: {'cache-control': 'public, immutable, max-age=' + self.getConfig('cache')},
                                                                                        timeout: canceller.promise,
                                                                                        cancel: function (reason) {
                                                                                            canceller.resolve(reason);
                                                                                        }
                                                                                    };

                                                                                } else {
                                                                                    var req = {
                                                                                        method: 'get',
                                                                                        url: group.ref.http,
                                                                                        timeout: canceller.promise,
                                                                                        cancel: function (reason) {
                                                                                            canceller.resolve(reason);
                                                                                        }
                                                                                    };
                                                                                }

                                                                                self.addPendingRequest($http(req).success(function (data) {
                                                                                    if (data) {
                                                                                        angular.forEach(groupedByNodeType[nodetype].nodes, function (node, identifier) {
                                                                                            groupedByNodeTypeNodes.push(data[identifier]);
                                                                                        });
                                                                                        requestCountDone++;
                                                                                        if (staticCachedNodes[nodetype] == undefined) {
                                                                                            staticCachedNodes[nodetype] = data;
                                                                                        }
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


                                    });


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
                     * @param string emoiy
                     * @returns {string}
                     */
                    getEmoijQuery: function (wemoji) {
                        return this.getEmoji(wemoji);
                    },

                    /**
                     * @private
                     * @param string query
                     * @returns {string}
                     */
                    getMetaphone: function (querysegment) {

                        querysegment = this.getEmoijQuery(querysegment);

                        var m = metaphone(querysegment.replace(/\./g, "")).toUpperCase();
                        if (m == '0000') {
                            return querysegment.replace(/^0-9/, "");
                        }

                        return m.length > 0 ? m : null;

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

                        if (!q) {
                            return self;
                        }

                        var query = self.getFilter().getQuery();


                        instance.$$data.running++;

                        var ref = {};
                        ref.socket = hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "keywords/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/" + q);
                        ref.http = (hybridsearch.$$conf.cdnDatabaseURL == undefined ? hybridsearch.$$conf.databaseURL : hybridsearch.$$conf.cdnDatabaseURL) + ("/sites/" + hybridsearch.$$conf.site + "/" + "keywords/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/" + q + ".json");

                        instance.$$data.keywords.push({term: query, metaphone: q});

                        ref.socket.once("value", function (data) {
                            if (data.val()) {
                                self.setAutocomplete(data.val(), querysegment);
                                var kwds = [];

                                angular.forEach(data.val(), function (v, k) {
                                    kwds.push({term: k, metaphone: q});
                                });

                                var ismatch = false;

                                angular.forEach(kwds, function (v, k) {
                                    if (ismatch == false && v.term == query) {
                                        ismatch = true;
                                    }
                                });

                                if (ismatch == false) {
                                    angular.forEach(kwds, function (v, k) {
                                        if (query.indexOf(v.term.substr(0, 3)) >= 0) {
                                            instance.$$data.keywords.push({term: v.term, metaphone: q});
                                            ismatch = true;
                                        }
                                    });
                                }

                                if (ismatch == false) {
                                    angular.forEach(kwds, function (v, k) {
                                        instance.$$data.keywords.push({term: v.term, metaphone: q});
                                    });
                                }


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


                        if (nodeType !== undefined || (nodeType == undefined && keyword === null)) {

                            var nodetypes = [];

                            if (keyword == null && nodeType == undefined && typeof this.getFilter().getNodeType() == 'object') {
                                angular.forEach(this.getFilter().getNodeType(), function (nodeType) {
                                    if (typeof nodeType == 'string') {
                                        nodetypes.push(nodeType);
                                    }
                                });
                            } else {
                                var n = nodeType !== undefined ? nodeType : this.getFilter().getNodeType();
                                if (typeof n == 'string') {
                                    nodetypes.push(n);
                                }
                            }

                            angular.forEach(nodetypes, function (nodeType) {

                                if (nodeType !== undefined) {
                                    var query = {
                                        isLoadingAllFromNodeType: true,
                                        socket: hybridsearch.$firebase().database().ref("sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/__" + nodeType),
                                        http: (self.getConfig('cache') ? (hybridsearch.$$conf.cdnStaticURL == undefined ? '/_Hybridsearch' : hybridsearch.$$conf.cdnStaticURL + '/_Hybridsearch') : (hybridsearch.$$conf.cdnDatabaseURL == undefined ? hybridsearch.$$conf.databaseURL : hybridsearch.$$conf.cdnDatabaseURL)) + "/sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/__" + nodeType + ".json" + (self.getConfig('cache') ? "?ls=" + hybridsearch.getLastSync() : "")
                                    };
                                    queries.push(query);
                                }
                            });

                            if (queries.length == 1) {
                                return queries[0];
                            }

                            return queries;

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
                                            http: (self.getConfig('cache') ? (hybridsearch.$$conf.cdnStaticURL == undefined ? '/_Hybridsearch' : hybridsearch.$$conf.cdnStaticURL + '/_Hybridsearch') : (hybridsearch.$$conf.cdnDatabaseURL == undefined ? hybridsearch.$$conf.databaseURL : hybridsearch.$$conf.cdnDatabaseURL)) + "/sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/__" + this.getFilter().getNodeType() + ".json" + (self.getConfig('cache') ? "?ls=" + hybridsearch.getLastSync() : "")
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
                                                http: (self.getConfig('cache') ? '/_Hybridsearch' : (hybridsearch.$$conf.cdnDatabaseURL == undefined ? hybridsearch.$$conf.databaseURL : hybridsearch.$$conf.cdnDatabaseURL)) + "/sites/" + hybridsearch.$$conf.site + "/" + "index/" + hybridsearch.$$conf.workspace + "/" + hybridsearch.$$conf.branch + "/" + hybridsearch.$$conf.dimension + "/__" + nodeType + ".json" + (self.getConfig('cache') ? "?ls=" + hybridsearch.getLastSync() : "")
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

                            if (keyword.length < 1) {
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


                    },


                    /**
                     * @private
                     * @param string keyword
                     * @returns mixed
                     */
                    clearLocalIndex: function () {
                        lunrSearch = null;
                        lunrSearch = elasticlunr(function () {
                            this.setRef('id');
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
                        var boost = {};
                        var cachedindex = true;
                        var querySegmentsCount = self.getFilter().getQuery().lastIndexOf(" ");


                        if (JSON.stringify(keywords).length > 7 || querySegmentsCount > 9) {
                            var fastline = data.length > 5000 ? true : false;
                        } else {
                            var fastline = data.length > 500 ? true : false;
                        }


                        if (keyword !== undefined && keywords == undefined) {
                            // skip
                            return null;
                        }

                        cachedindex = fastline ? false : true;

                        angular.forEach(data, function (value, key) {


                                if (value && (nodesIndexed[value.node.hash] == undefined || value.objectID !== undefined)) {
                                    var doc = {};

                                    nodes[value.node.identifier] = value.node;

                                    if (value.node != undefined && value.node.properties != undefined) {

                                        //angular.forEach(JSON.parse(JSON.stringify(value.node.properties)), function (propvalue, property) {
                                        if (value.objectID) {
                                            // algolia mode
                                            nodes[value.node.identifier]['__algoliaranking'] = key;
                                        }


                                        if (fastline == false) {
                                            // index full slow way
                                            angular.forEach(value.node.properties, function (propvalue, property) {

                                                if (self.getBoost(property, value.node.nodeType) > 0) {

                                                    if (property.length > 1 && property !== 'lastmodified' && property !== 'sorting' && property !== 'uri' && propvalue && propvalue.getProperty == undefined) {


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
                                                            } else {
                                                                doc[property] = propvalue;
                                                            }
                                                        }


                                                    }
                                                }
                                            });
                                        }


                                        if (value.node.properties['_nodeLabel'] != undefined) {
                                            doc['_nodeLabel'] = value.node.properties['_nodeLabel'];
                                        }


                                        if (Object.keys(doc).length) {

                                            if (value.node.breadcrumb !== undefined) {
                                                doc.breadcrumb = value.node.breadcrumb.replace(/(<([^>]+)>)/ig, "").replace(/\r?\n|\r/g, "");
                                            }

                                            if (value.node.properties['__google'] != undefined) {
                                                doc['__google'] = value.node.properties['__google'];
                                            }

                                            if (value.node.properties[value.nodeType + '-neoslivehybridsearchkeywords'] != undefined) {
                                                doc[value.nodeType + '-neoslivehybridsearchkeywords'] = value.node.properties[value.nodeType + '-neoslivehybridsearchkeywords'];
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
                    this.$$app.setConfig('cache', expires == undefined ? 3600000 : expires);
                    this.$$app.setConfig('realtime', false);
                    return this;
                },

                /**
                 * Disable realtime search, use algolia search engine
                 * @returns {HybridsearchObject}
                 */
                enableAlgolia: function (applicationID, apiKey) {
                    this.$$app.setConfig('algolia', {'applicationID': applicationID, 'apiKey': apiKey});
                    this.$$app.setConfig('cache', 3600000);
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
                 * Sets node type labels.
                 * @param {object} nodetypelabels
                 * @example var emoijs = {
                 *        '😀': 'Smile',
                 *        '🍈': 'Melon'
                 *    }
                 * @returns {$hybridsearchResultsObject|*}
                 */
                setEmojis: function (emoijs) {
                    var self = this;
                    self.$$app.setEmojis(emoijs);
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
                 * Sets  node type boost.
                 * @param {object} NodeTypeBoostFactor
                 * @example var NodeTypeBoostFactor = {
                 *        'corporate-contact': 1.5
                 *    }
                 * @returns {$hybridsearchResultsObject|*}
                 */
                setNodeTypeBoostFactor: function (NodeTypeBoostFactor) {
                    var self = this;
                    self.$$app.setNodeTypeBoostFactor(NodeTypeBoostFactor);
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
                 * Get properties of group.
                 * @returns array
                 */
                getProperties: function () {
                    return this._nodes[0].getProperties();

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

                        var object = this;


                        if (self.$$data._updateTimeout !== undefined) {
                            window.clearTimeout(self.$$data._updateTimeout);
                        }
                        if (self.isStarted()) {
                            self.$$data._updateTimeout = window.setTimeout(function () {
                                self.getApp().setNotFound(false);
                                self.updateNodesGroupedBy();
                                object.executeCallbackMethod(self);
                                if (skipAutocompleteUpdate !== true) {
                                    self.updateAutocomplete(null, null, caller);
                                }
                            }, 5);

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
                            selfthis.getScope().$digest(function () {
                            });
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

                            // self.getScope().$digest(function () {
                            // });

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
                getNodes: function (limit, filter, groupedBy) {

                    var ns = [];

                    if (groupedBy != undefined) {
                        var ghash = Sha1.hash(groupedBy);
                        if (this.$$data.distinctsConfiguration[groupedBy] == undefined) {
                            this.$$data.distinctsConfiguration[groupedBy] = {
                                'limit': limit,
                                'distinctsFromGetResults': true
                            }
                        }
                    }


                    if (filter !== undefined) {

                        angular.forEach(this.getData()._nodes, function (node) {
                            if (filter(node)) {
                                ns.push(node);
                            }
                        });

                    } else {
                        ns = this.getData()._nodes;
                    }

                    return ns === undefined ? null : (limit === undefined ? ns : ns.slice(0, limit) );


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
                    this.$$data.hasautocomplete = true;
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

                    if (self.$$data.hasautocomplete === undefined || self.$$data.hasautocomplete == false) {
                        return null;
                    }

                    if (self.count() == 1) {
                        return null;
                    }

                    if (!autocomplete) {
                        autocomplete = {};
                    }

                    if (!querysegment) {
                        querysegment = '';
                    }


                    var query = self.getApp().getScope()['__query'] ? self.getApp().getScope()[self.getApp().getScope()['__query']] : querysegment;
                    query = query.toLowerCase();

                    angular.forEach(Object.keys(autocomplete), function (a) {
                        a = a.replace(/-/g, " ").trim().split(" ", 6).join(" ");
                        if (self.$$data.autocompleteKeys[a] == undefined) {
                            self.$$data.autocompleteKeys[a] = true;
                        }
                    });


                    self.$$data.autocomplete = [];
                    var autocompleteTemp = {};


                    var foundinproperty = null;
                    var foundinpropertyLength = 0;

                    if (self.count() > 1) {
                        angular.forEach(self.getNodes(16), function (node) {
                            if (node.getScore() > 10) {
                                if (foundinproperty === null) {
                                    angular.forEach(node.getProperties(), function (value, property) {
                                        if (query && typeof value == 'string' && value.toLowerCase().substr(0, query.length + 1) == query + " ") {
                                            if (foundinpropertyLength == 0 || value.length < foundinpropertyLength) {
                                                foundinproperty = property;
                                            }
                                            foundinpropertyLength = value.length;
                                        }
                                    });
                                }
                            }
                        });
                    }

                    if (foundinproperty === null) {
                        foundinproperty = '_nodeLabel';
                    }


                    angular.forEach(self.getNodes(16), function (node) {
                        if (node.getScore() > 10) {
                            var a = node.getProperty(foundinproperty);

                            if (typeof a == 'string' && a != '') {
                                if (a.length < 50 && (caller == undefined || caller.isFiltered(node) == false)) {
                                    var i = a.toLowerCase().indexOf(query);
                                    var b = a.substr(i).toLowerCase();
                                    if (b == query && i >= 0) {
                                        b = a.substr(0, i + query.length).toLowerCase();
                                        b = b.trim();
                                    }
                                    b = b.trim();
                                    if (b.length > query.length && query !== b && autocompleteTemp[b] == undefined && i >= -1 && i < 64) {
                                        self.$$data.autocomplete.push(b);
                                        autocompleteTemp[b] = true;
                                    }
                                }

                            }
                        }

                    });


                    var counter = 0;
                    angular.forEach(Object.keys(self.$$data.autocompleteKeys).sort(), function (a) {
                        if (query !== a.toLowerCase() && a.indexOf(query) == 0 && autocompleteTemp[a] == undefined) {
                            self.$$data.autocomplete.push(a);
                            autocompleteTemp[a] = true;
                        }
                        counter++;
                    });


                    var autocompleteTempPostProcessed = [];
                    autocompleteTemp = {};


                    if (self.$$data.autocomplete.length > 32) {
                        angular.forEach(self.$$data.autocomplete, function (a) {
                            if (autocompleteTemp[a] == undefined) {
                                var m = metaphone(a.substr(0, a.length - 3));
                                if (autocompleteTemp[m] == undefined) {
                                    autocompleteTempPostProcessed.push(a);
                                }
                                autocompleteTemp[m] = true;

                            }
                            autocompleteTemp[a] = true;
                        });
                        self.$$data.autocomplete = autocompleteTempPostProcessed;
                    } else {

                        angular.forEach(self.$$data.autocomplete, function (a) {
                            if (autocompleteTemp[a] == undefined) {

                                if (a.substr(0, 1).isNaN == true) {
                                    var m1 = a.substr(0, a.length - 1);
                                    var m2 = a.substr(0, a.length - 2);
                                    if (autocompleteTemp[m1] == undefined) {
                                        autocompleteTempPostProcessed.push(a);
                                        autocompleteTemp[m1] = true;
                                        autocompleteTemp[m2] = true;
                                    }
                                } else {
                                    autocompleteTempPostProcessed.push(a);
                                    autocompleteTemp[a] = true;
                                }

                            }
                            autocompleteTemp[a] = true
                            ;
                        });
                        self.$$data.autocomplete = autocompleteTempPostProcessed;
                    }

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

                    this.$$data.unfilteredResultNodes = unfilteredResultNodes == undefined ? {} : unfilteredResultNodes;

                    angular.forEach(this.$$data.distincts, function (val, key) {
                        if (self.$$data.distinctsConfiguration[key].affectedBySearchResult) {
                            if (self.$$data.distincts[key] !== undefined) {
                                delete self.$$data.distincts[key];
                            }
                            self.getDistinct(key);
                        }

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
                 * @param {object} postprocessor applying property
                 * @returns {boolean} true if value is part of distinct property values
                 */
                isInDistinct: function (property, value, postprocessor) {

                    var found = false;
                    var foreachDistinct = this.getDistinct(property);
                    angular.forEach(foreachDistinct, function (o) {


                        if (postprocessor == undefined) {
                            if (o.value == value) {
                                found = true;
                                return found;
                            }
                        } else {
                            var p = postprocessor(o.value);
                            if (p == value) {
                                found = true;
                                return found;
                            }
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

                    if (property == undefined) {
                        return [];
                    }

                    if (self.$$data.distinctsConfiguration[property] == undefined) {
                        self.$$data.distinctsConfiguration[property] = {
                            counterGroupedByNode: counterGroupedByNode == undefined || counterGroupedByNode == null ? false : counterGroupedByNode,
                            valuesOnly: valuesOnly == undefined || valuesOnly == null ? false : valuesOnly,
                            affectedBySearchResult: affectedBySearchResult == undefined || affectedBySearchResult == null ? true : affectedBySearchResult,
                            affectedBySearchResultWasApplied: 0,
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


                    if ((affectedBySearchResult == undefined || affectedBySearchResult == false) && self.$$data.isStartedFirstTime == false) {
                        return this;
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


                    if (self.$$data.distinctsConfiguration[property]['affectedBySearchResultWasApplied'] == true) {
                        return this;
                    }


                    if (self.$$data.distinctsConfiguration[property].distinctsFromGetResults !== undefined) {
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

                                    if (v !== undefined && v !== null) {

                                        var hashs = {};
                                        if (typeof v == 'object') {
                                            var hashk = Object.keys(v).sort();
                                            angular.forEach(hashk, function (a) {
                                                hashs[a] = v[a];
                                            });
                                            var k = Sha1.hash(JSON.stringify(hashs));
                                        } else {
                                            k = v;
                                        }

                                        variants[k] = {
                                            id: k,
                                            property: property,
                                            value: v,
                                            node: node,
                                            nodes: variants[k] == undefined ? [] : variants[k].nodes,
                                            maxScore: variants[k] === undefined ? node.getScore() : (variants[k].maxScore < node.getScore() ? node.getScore() : variants[k].maxScore),
                                            count: variants[k] === undefined ? 1 : (!self.$$data.distinctsConfiguration[property].counterGroupedByNode || variantsByNodes[node.identifier][k] === undefined ? variants[k].count + 1 : variants[k].count)
                                        };

                                        variants[k].node.score = variants[k].maxScore;

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


                    if (self.$$data.distinctsConfiguration[property]['affectedBySearchResult'] === false && Object.keys(self.$$data.distincts[property]).length) {
                        self.$$data.distinctsConfiguration[property]['affectedBySearchResultWasApplied'] = true;
                    }


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


            var filterReg = /[-]/g;


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

                    if (this.getPropertyFilters()) {
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

                    keywords[this.$$data.query] = true;

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

/*! js-emoji 2017-05-05 */
"use strict";
(function () {
    var a = this, b = a.EmojiConvertor, c = function () {
        var a = this;
        return a.img_set = "apple", a.img_sets = {
            apple: {
                path: "/emoji-data/img-apple-64/",
                sheet: "/emoji-data/sheet_apple_64.png",
                mask: 1
            },
            google: {path: "/emoji-data/img-google-64/", sheet: "/emoji-data/sheet_google_64.png", mask: 2},
            twitter: {path: "/emoji-data/img-twitter-64/", sheet: "/emoji-data/sheet_twitter_64.png", mask: 4},
            emojione: {path: "/emoji-data/img-emojione-64/", sheet: "/emoji-data/sheet_emojione_64.png", mask: 8},
            facebook: {path: "/emoji-data/img-facebook-64/", sheet: "/emoji-data/sheet_facebook_64.png", mask: 16},
            messenger: {path: "/emoji-data/img-messenger-64/", sheet: "/emoji-data/sheet_messenger_64.png", mask: 32}
        }, a.use_css_imgs = !1, a.colons_mode = !1, a.text_mode = !1, a.include_title = !1, a.include_text = !1, a.allow_native = !0, a.use_sheet = !1, a.avoid_ms_emoji = !0, a.allow_caps = !1, a.img_suffix = "", a.inits = {}, a.map = {}, a.init_env(), a
    };
    c.prototype.noConflict = function () {
        return a.EmojiConvertor = b, c
    }, c.prototype.replace_emoticons = function (a) {
        var b = this, c = b.replace_emoticons_with_colons(a);
        return b.replace_colons(c)
    }, c.prototype.replace_emoticons_with_colons = function (a) {
        var b = this;
        b.init_emoticons();
        var c = 0, d = [], e = a.replace(b.rx_emoticons, function (e, f, g, h) {
            var i = c;
            c = h + e.length;
            var j = g.indexOf("(") !== -1, k = g.indexOf(")") !== -1;
            if ((j || k) && d.indexOf(g) == -1 && d.push(g), k && !j) {
                var l = a.substring(i, h);
                if (l.indexOf("(") !== -1 && l.indexOf(")") === -1) return e
            }
            if ("\n8)" === e) {
                var m = a.substring(0, h);
                if (/\n?(6\)|7\))/.test(m)) return e
            }
            var n = b.data[b.map.emoticons[g]][3][0];
            return n ? f + ":" + n + ":" : e
        });
        if (d.length) {
            var f = d.map(b.escape_rx), g = new RegExp("(\\(.+)(" + f.join("|") + ")(.+\\))", "g");
            e = e.replace(g, function (a, c, d, e) {
                var f = b.data[b.map.emoticons[d]][3][0];
                return f ? c + ":" + f + ":" + e : a
            })
        }
        return e
    }, c.prototype.replace_colons = function (a) {
        var b = this;
        return b.init_colons(), a.replace(b.rx_colons, function (a) {
            var c = a.substr(1, a.length - 2);
            if (b.allow_caps && (c = c.toLowerCase()), c.indexOf("::skin-tone-") > -1) {
                var d = c.substr(-1, 1), e = "skin-tone-" + d, f = b.map.colons[e];
                c = c.substr(0, c.length - 13);
                var g = b.map.colons[c];
                return g ? b.replacement(g, c, ":", {
                    idx: f,
                    actual: e,
                    wrapper: ":"
                }) : ":" + c + ":" + b.replacement(f, e, ":")
            }
            var g = b.map.colons[c];
            return g ? b.replacement(g, c, ":") : a
        })
    }, c.prototype.replace_unified = function (a) {
        var b = this;
        return b.init_unified(), a.replace(b.rx_unified, function (a, c, d) {
            var e = b.map.unified[c];
            if (e) {
                var f = null;
                return "\ud83c\udffb" == d && (f = "1f3fb"), "\ud83c\udffc" == d && (f = "1f3fc"), "\ud83c\udffd" == d && (f = "1f3fd"), "\ud83c\udffe" == d && (f = "1f3fe"), "\ud83c\udfff" == d && (f = "1f3ff"), f ? b.replacement(e, null, null, {
                    idx: f,
                    actual: d,
                    wrapper: ""
                }) : b.replacement(e)
            }
            return e = b.map.unified_vars[c], e ? b.replacement(e[0], null, null, {
                idx: e[1],
                actual: "",
                wrapper: ""
            }) : a
        })
    }, c.prototype.addAliases = function (a) {
        var b = this;
        b.init_colons();
        for (var c in a) b.map.colons[c] = a[c]
    }, c.prototype.removeAliases = function (a) {
        for (var b = this, c = 0; c < a.length; c++) {
            var d = a[c];
            delete b.map.colons[d];
            a:for (var e in b.data) for (var f = 0; f < b.data[e][3].length; f++) if (d == b.data[e][3][f]) {
                b.map.colons[d] = e;
                break a
            }
        }
    }, c.prototype.replacement = function (a, b, c, d) {
        var e = this, f = "", g = null;
        if ("object" == typeof d && (f = e.replacement(d.idx, d.actual, d.wrapper), g = d.idx), c = c || "", e.colons_mode) return ":" + e.data[a][3][0] + ":" + f;
        var h = b ? c + b + c : e.data[a][8] || c + e.data[a][3][0] + c;
        if (e.text_mode) return h + f;
        if (e.init_env(), "unified" == e.replace_mode && e.allow_native && e.data[a][0][0]) return e.data[a][0][0] + f;
        if ("softbank" == e.replace_mode && e.allow_native && e.data[a][1]) return e.data[a][1] + f;
        if ("google" == e.replace_mode && e.allow_native && e.data[a][2]) return e.data[a][2] + f;
        var i = e.find_image(a, g), j = e.include_title ? ' title="' + (b || e.data[a][3][0]) + '"' : "",
            k = e.include_text ? c + (b || e.data[a][3][0]) + c : "";
        if (e.data[a][7] && (i.path = e.data[a][7], i.px = null, i.py = null, i.is_var = !1), i.is_var && (f = "", e.include_text && d && d.actual && d.wrapper && (k += d.wrapper + d.actual + d.wrapper)), e.supports_css) {
            if (e.use_sheet && null != i.px && null != i.py) {
                var l = 100 / (e.sheet_size - 1),
                    m = "background: url(" + i.sheet + ");background-position:" + l * i.px + "% " + l * i.py + "%;background-size:" + e.sheet_size + "00%";
                return '<span class="emoji-outer emoji-sizer"><span class="emoji-inner" style="' + m + '"' + j + ' data-codepoints="' + i.full_idx + '">' + k + "</span></span>" + f
            }
            return e.use_css_imgs ? '<span class="emoji emoji-' + a + '"' + j + ' data-codepoints="' + i.full_idx + '">' + k + "</span>" + f : '<span class="emoji emoji-sizer" style="background-image:url(' + i.path + ')"' + j + ' data-codepoints="' + i.full_idx + '">' + k + "</span>" + f
        }
        return '<img src="' + i.path + '" class="emoji" data-codepoints="' + i.full_idx + '" ' + j + "/>" + f
    }, c.prototype.find_image = function (a, b) {
        var c = this, d = {path: "", sheet: "", px: c.data[a][4], py: c.data[a][5], full_idx: a, is_var: !1},
            e = c.data[a][6];
        if (b && c.variations_data[a] && c.variations_data[a][b]) {
            var f = c.variations_data[a][b];
            d.px = f[1], d.py = f[2], d.full_idx = f[0], d.is_var = !0, e = f[3]
        }
        for (var g = [c.img_set, "apple", "emojione", "google", "twitter", "facebook", "messenger"], h = 0; h < g.length; h++) {
            if (e & c.img_sets[g[h]].mask) return d.path = c.img_sets[g[h]].path + d.full_idx + ".png" + c.img_suffix, d.sheet = c.img_sets[c.img_set].sheet, d;
            if (c.obsoletes_data[d.full_idx]) {
                var i = c.obsoletes_data[d.full_idx];
                if (i[3] & c.img_sets[g[h]].mask) return d.path = c.img_sets[g[h]].path + i[0] + ".png" + c.img_suffix, d.sheet = c.img_sets[g[h]].sheet, d.px = i[1], d.py = i[2], d
            }
        }
        return d
    }, c.prototype.init_emoticons = function () {
        var a = this;
        if (!a.inits.emoticons) {
            a.init_colons(), a.inits.emoticons = 1;
            var b = [];
            a.map.emoticons = {};
            for (var c in a.emoticons_data) {
                var d = c.replace(/\&/g, "&amp;").replace(/\</g, "&lt;").replace(/\>/g, "&gt;");
                a.map.colons[a.emoticons_data[c]] && (a.map.emoticons[d] = a.map.colons[a.emoticons_data[c]], b.push(a.escape_rx(d)))
            }
            a.rx_emoticons = new RegExp("(^|\\s)(" + b.join("|") + ")(?=$|[\\s|\\?\\.,!])", "g")
        }
    }, c.prototype.init_colons = function () {
        var a = this;
        if (!a.inits.colons) {
            a.inits.colons = 1, a.rx_colons = new RegExp(":[a-zA-Z0-9-_+]+:(:skin-tone-[2-6]:)?", "g"), a.map.colons = {};
            for (var b in a.data) for (var c = 0; c < a.data[b][3].length; c++) a.map.colons[a.data[b][3][c]] = b
        }
    }, c.prototype.init_unified = function () {
        var a = this;
        if (!a.inits.unified) {
            a.inits.unified = 1;
            var b = [];
            a.map.unified = {}, a.map.unified_vars = {};
            for (var c in a.data) for (var d = 0; d < a.data[c][0].length; d++) b.push(a.data[c][0][d].replace("*", "\\*")), a.map.unified[a.data[c][0][d]] = c;
            for (var c in a.variations_data) if (a.variations_data[c]["1f3fb"][0] != c + "-1f3fb") for (var e in a.variations_data[c]) for (var d = 0; d < a.variations_data[c][e][4].length; d++) b.push(a.variations_data[c][e][4][d].replace("*", "\\*")), a.map.unified_vars[a.variations_data[c][e][4][d]] = [c, e];
            b = b.sort(function (a, b) {
                return b.length - a.length
            }), a.rx_unified = new RegExp("(" + b.join("|") + ")(\ud83c[\udffb-\udfff])?", "g")
        }
    }, c.prototype.init_env = function () {
        var a = this;
        if (!a.inits.env) {
            if (a.inits.env = 1, a.replace_mode = "img", a.supports_css = !1, "undefined" != typeof navigator) {
                var b = navigator.userAgent;
                if (window.getComputedStyle) try {
                    var c = window.getComputedStyle(document.body);
                    (c["background-size"] || c.backgroundSize) && (a.supports_css = !0)
                } catch (d) {
                    b.match(/Firefox/i) && (a.supports_css = !0)
                }
                if (b.match(/(iPhone|iPod|iPad|iPhone\s+Simulator)/i)) {
                    if (b.match(/OS\s+[12345]/i)) return void(a.replace_mode = "softbank");
                    if (b.match(/OS\s+[6789]/i)) return void(a.replace_mode = "unified")
                }
                if (b.match(/Mac OS X 10[._ ](?:[789]|1\d)/i)) return void(a.replace_mode = "unified");
                if (!a.avoid_ms_emoji && (b.match(/Windows NT 6.[1-9]/i) || b.match(/Windows NT 10.[0-9]/i)) && !b.match(/Chrome/i) && !b.match(/MSIE 8/i)) return void(a.replace_mode = "unified")
            }
            a.supports_css && (a.replace_mode = "css")
        }
    }, c.prototype.escape_rx = function (a) {
        return a.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
    }, c.prototype.sheet_size = 49, c.prototype.data = {
        "00a9": [["\xa9\ufe0f", "\xa9"], "\ue24e", "\udbba\udf29", ["copyright"], 0, 0, 11, 0],
        "00ae": [["\xae\ufe0f", "\xae"], "\ue24f", "\udbba\udf2d", ["registered"], 0, 1, 11, 0],
        "203c": [["\u203c\ufe0f", "\u203c"], "", "\udbba\udf06", ["bangbang"], 0, 2, 63, 0],
        2049: [["\u2049\ufe0f", "\u2049"], "", "\udbba\udf05", ["interrobang"], 0, 3, 63, 0],
        2122: [["\u2122\ufe0f", "\u2122"], "\ue537", "\udbba\udf2a", ["tm"], 0, 4, 63, 0],
        2139: [["\u2139\ufe0f", "\u2139"], "", "\udbba\udf47", ["information_source"], 0, 5, 63, 0],
        2194: [["\u2194\ufe0f", "\u2194"], "", "\udbba\udef6", ["left_right_arrow"], 0, 6, 63, 0],
        2195: [["\u2195\ufe0f", "\u2195"], "", "\udbba\udef7", ["arrow_up_down"], 0, 7, 63, 0],
        2196: [["\u2196\ufe0f", "\u2196"], "\ue237", "\udbba\udef2", ["arrow_upper_left"], 0, 8, 63, 0],
        2197: [["\u2197\ufe0f", "\u2197"], "\ue236", "\udbba\udef0", ["arrow_upper_right"], 0, 9, 63, 0],
        2198: [["\u2198\ufe0f", "\u2198"], "\ue238", "\udbba\udef1", ["arrow_lower_right"], 0, 10, 63, 0],
        2199: [["\u2199\ufe0f", "\u2199"], "\ue239", "\udbba\udef3", ["arrow_lower_left"], 0, 11, 63, 0],
        "21a9": [["\u21a9\ufe0f", "\u21a9"], "", "\udbba\udf83", ["leftwards_arrow_with_hook"], 0, 12, 63, 0],
        "21aa": [["\u21aa\ufe0f", "\u21aa"], "", "\udbba\udf88", ["arrow_right_hook"], 0, 13, 63, 0],
        "231a": [["\u231a\ufe0f", "\u231a"], "", "\udbb8\udc1d", ["watch"], 0, 14, 63, 0],
        "231b": [["\u231b\ufe0f", "\u231b"], "", "\udbb8\udc1c", ["hourglass"], 0, 15, 63, 0],
        2328: [["\u2328\ufe0f", "\u2328"], "", "", ["keyboard"], 0, 16, 31, 0],
        "23cf": [["\u23cf"], "", "", ["eject"], 0, 17, 30, 0],
        "23e9": [["\u23e9"], "\ue23c", "\udbba\udefe", ["fast_forward"], 0, 18, 63, 0],
        "23ea": [["\u23ea"], "\ue23d", "\udbba\udeff", ["rewind"], 0, 19, 63, 0],
        "23eb": [["\u23eb"], "", "\udbba\udf03", ["arrow_double_up"], 0, 20, 63, 0],
        "23ec": [["\u23ec"], "", "\udbba\udf02", ["arrow_double_down"], 0, 21, 63, 0],
        "23ed": [["\u23ed"], "", "", ["black_right_pointing_double_triangle_with_vertical_bar"], 0, 22, 31, 0],
        "23ee": [["\u23ee"], "", "", ["black_left_pointing_double_triangle_with_vertical_bar"], 0, 23, 31, 0],
        "23ef": [["\u23ef"], "", "", ["black_right_pointing_triangle_with_double_vertical_bar"], 0, 24, 31, 0],
        "23f0": [["\u23f0"], "\ue02d", "\udbb8\udc2a", ["alarm_clock"], 0, 25, 63, 0],
        "23f1": [["\u23f1"], "", "", ["stopwatch"], 0, 26, 31, 0],
        "23f2": [["\u23f2"], "", "", ["timer_clock"], 0, 27, 31, 0],
        "23f3": [["\u23f3"], "", "\udbb8\udc1b", ["hourglass_flowing_sand"], 0, 28, 63, 0],
        "23f8": [["\u23f8"], "", "", ["double_vertical_bar"], 0, 29, 31, 0],
        "23f9": [["\u23f9"], "", "", ["black_square_for_stop"], 0, 30, 31, 0],
        "23fa": [["\u23fa"], "", "", ["black_circle_for_record"], 0, 31, 31, 0],
        "24c2": [["\u24c2\ufe0f", "\u24c2"], "\ue434", "\udbb9\udfe1", ["m"], 0, 32, 63, 0],
        "25aa": [["\u25aa\ufe0f", "\u25aa"], "\ue21a", "\udbba\udf6e", ["black_small_square"], 0, 33, 63, 0],
        "25ab": [["\u25ab\ufe0f", "\u25ab"], "\ue21b", "\udbba\udf6d", ["white_small_square"], 0, 34, 63, 0],
        "25b6": [["\u25b6\ufe0f", "\u25b6"], "\ue23a", "\udbba\udefc", ["arrow_forward"], 0, 35, 63, 0],
        "25c0": [["\u25c0\ufe0f", "\u25c0"], "\ue23b", "\udbba\udefd", ["arrow_backward"], 0, 36, 63, 0],
        "25fb": [["\u25fb\ufe0f", "\u25fb"], "\ue21b", "\udbba\udf71", ["white_medium_square"], 0, 37, 63, 0],
        "25fc": [["\u25fc\ufe0f", "\u25fc"], "\ue21a", "\udbba\udf72", ["black_medium_square"], 0, 38, 63, 0],
        "25fd": [["\u25fd\ufe0f", "\u25fd"], "\ue21b", "\udbba\udf6f", ["white_medium_small_square"], 0, 39, 63, 0],
        "25fe": [["\u25fe\ufe0f", "\u25fe"], "\ue21a", "\udbba\udf70", ["black_medium_small_square"], 0, 40, 63, 0],
        2600: [["\u2600\ufe0f", "\u2600"], "\ue04a", "\udbb8\udc00", ["sunny"], 0, 41, 63, 0],
        2601: [["\u2601\ufe0f", "\u2601"], "\ue049", "\udbb8\udc01", ["cloud"], 0, 42, 63, 0],
        2602: [["\u2602\ufe0f", "\u2602"], "", "", ["umbrella"], 0, 43, 31, 0],
        2603: [["\u2603\ufe0f", "\u2603"], "", "", ["snowman"], 0, 44, 31, 0],
        2604: [["\u2604\ufe0f", "\u2604"], "", "", ["comet"], 0, 45, 31, 0],
        "260e": [["\u260e\ufe0f", "\u260e"], "\ue009", "\udbb9\udd23", ["phone", "telephone"], 0, 46, 63, 0],
        2611: [["\u2611\ufe0f", "\u2611"], "", "\udbba\udf8b", ["ballot_box_with_check"], 0, 47, 63, 0],
        2614: [["\u2614\ufe0f", "\u2614"], "\ue04b", "\udbb8\udc02", ["umbrella_with_rain_drops"], 0, 48, 63, 0],
        2615: [["\u2615\ufe0f", "\u2615"], "\ue045", "\udbba\udd81", ["coffee"], 1, 0, 63, 0],
        2618: [["\u2618\ufe0f", "\u2618"], "", "", ["shamrock"], 1, 1, 31, 0],
        "261d": [["\u261d\ufe0f", "\u261d"], "\ue00f", "\udbba\udf98", ["point_up"], 1, 2, 63, 0],
        2620: [["\u2620\ufe0f", "\u2620"], "", "", ["skull_and_crossbones"], 1, 8, 31, 0],
        2622: [["\u2622\ufe0f", "\u2622"], "", "", ["radioactive_sign"], 1, 9, 31, 0],
        2623: [["\u2623\ufe0f", "\u2623"], "", "", ["biohazard_sign"], 1, 10, 31, 0],
        2626: [["\u2626\ufe0f", "\u2626"], "", "", ["orthodox_cross"], 1, 11, 31, 0],
        "262a": [["\u262a\ufe0f", "\u262a"], "", "", ["star_and_crescent"], 1, 12, 31, 0],
        "262e": [["\u262e\ufe0f", "\u262e"], "", "", ["peace_symbol"], 1, 13, 31, 0],
        "262f": [["\u262f\ufe0f", "\u262f"], "", "", ["yin_yang"], 1, 14, 31, 0],
        2638: [["\u2638\ufe0f", "\u2638"], "", "", ["wheel_of_dharma"], 1, 15, 31, 0],
        2639: [["\u2639\ufe0f", "\u2639"], "", "", ["white_frowning_face"], 1, 16, 31, 0],
        "263a": [["\u263a\ufe0f", "\u263a"], "\ue414", "\udbb8\udf36", ["relaxed"], 1, 17, 63, 0],
        2640: [["\u2640"], "", "", ["female_sign"], 1, 18, 22, 0],
        2642: [["\u2642"], "", "", ["male_sign"], 1, 19, 22, 0],
        2648: [["\u2648\ufe0f", "\u2648"], "\ue23f", "\udbb8\udc2b", ["aries"], 1, 20, 63, 0],
        2649: [["\u2649\ufe0f", "\u2649"], "\ue240", "\udbb8\udc2c", ["taurus"], 1, 21, 63, 0],
        "264a": [["\u264a\ufe0f", "\u264a"], "\ue241", "\udbb8\udc2d", ["gemini"], 1, 22, 63, 0],
        "264b": [["\u264b\ufe0f", "\u264b"], "\ue242", "\udbb8\udc2e", ["cancer"], 1, 23, 63, 0],
        "264c": [["\u264c\ufe0f", "\u264c"], "\ue243", "\udbb8\udc2f", ["leo"], 1, 24, 63, 0],
        "264d": [["\u264d\ufe0f", "\u264d"], "\ue244", "\udbb8\udc30", ["virgo"], 1, 25, 63, 0],
        "264e": [["\u264e\ufe0f", "\u264e"], "\ue245", "\udbb8\udc31", ["libra"], 1, 26, 63, 0],
        "264f": [["\u264f\ufe0f", "\u264f"], "\ue246", "\udbb8\udc32", ["scorpius"], 1, 27, 63, 0],
        2650: [["\u2650\ufe0f", "\u2650"], "\ue247", "\udbb8\udc33", ["sagittarius"], 1, 28, 63, 0],
        2651: [["\u2651\ufe0f", "\u2651"], "\ue248", "\udbb8\udc34", ["capricorn"], 1, 29, 63, 0],
        2652: [["\u2652\ufe0f", "\u2652"], "\ue249", "\udbb8\udc35", ["aquarius"], 1, 30, 63, 0],
        2653: [["\u2653\ufe0f", "\u2653"], "\ue24a", "\udbb8\udc36", ["pisces"], 1, 31, 63, 0],
        2660: [["\u2660\ufe0f", "\u2660"], "\ue20e", "\udbba\udf1b", ["spades"], 1, 32, 63, 0],
        2663: [["\u2663\ufe0f", "\u2663"], "\ue20f", "\udbba\udf1d", ["clubs"], 1, 33, 63, 0],
        2665: [["\u2665\ufe0f", "\u2665"], "\ue20c", "\udbba\udf1a", ["hearts"], 1, 34, 63, 0],
        2666: [["\u2666\ufe0f", "\u2666"], "\ue20d", "\udbba\udf1c", ["diamonds"], 1, 35, 63, 0],
        2668: [["\u2668\ufe0f", "\u2668"], "\ue123", "\udbb9\udffa", ["hotsprings"], 1, 36, 63, 0],
        "267b": [["\u267b\ufe0f", "\u267b"], "", "\udbba\udf2c", ["recycle"], 1, 37, 63, 0],
        "267f": [["\u267f\ufe0f", "\u267f"], "\ue20a", "\udbba\udf20", ["wheelchair"], 1, 38, 63, 0],
        2692: [["\u2692"], "", "", ["hammer_and_pick"], 1, 39, 31, 0],
        2693: [["\u2693\ufe0f", "\u2693"], "\ue202", "\udbb9\udcc1", ["anchor"], 1, 40, 63, 0],
        2694: [["\u2694\ufe0f", "\u2694"], "", "", ["crossed_swords"], 1, 41, 31, 0],
        2695: [["\u2695"], "", "", ["staff_of_aesculapius"], 1, 42, 7, 0],
        2696: [["\u2696\ufe0f", "\u2696"], "", "", ["scales"], 1, 43, 31, 0],
        2697: [["\u2697\ufe0f", "\u2697"], "", "", ["alembic"], 1, 44, 31, 0],
        2699: [["\u2699\ufe0f", "\u2699"], "", "", ["gear"], 1, 45, 31, 0],
        "269b": [["\u269b\ufe0f", "\u269b"], "", "", ["atom_symbol"], 1, 46, 31, 0],
        "269c": [["\u269c\ufe0f", "\u269c"], "", "", ["fleur_de_lis"], 1, 47, 31, 0],
        "26a0": [["\u26a0\ufe0f", "\u26a0"], "\ue252", "\udbba\udf23", ["warning"], 1, 48, 63, 0],
        "26a1": [["\u26a1\ufe0f", "\u26a1"], "\ue13d", "\udbb8\udc04", ["zap"], 2, 0, 63, 0],
        "26aa": [["\u26aa\ufe0f", "\u26aa"], "\ue219", "\udbba\udf65", ["white_circle"], 2, 1, 63, 0],
        "26ab": [["\u26ab\ufe0f", "\u26ab"], "\ue219", "\udbba\udf66", ["black_circle"], 2, 2, 63, 0],
        "26b0": [["\u26b0\ufe0f", "\u26b0"], "", "", ["coffin"], 2, 3, 31, 0],
        "26b1": [["\u26b1\ufe0f", "\u26b1"], "", "", ["funeral_urn"], 2, 4, 31, 0],
        "26bd": [["\u26bd\ufe0f", "\u26bd"], "\ue018", "\udbb9\udfd4", ["soccer"], 2, 5, 63, 0],
        "26be": [["\u26be\ufe0f", "\u26be"], "\ue016", "\udbb9\udfd1", ["baseball"], 2, 6, 63, 0],
        "26c4": [["\u26c4\ufe0f", "\u26c4"], "\ue048", "\udbb8\udc03", ["snowman_without_snow"], 2, 7, 63, 0],
        "26c5": [["\u26c5\ufe0f", "\u26c5"], "\ue04a\ue049", "\udbb8\udc0f", ["partly_sunny"], 2, 8, 63, 0],
        "26c8": [["\u26c8"], "", "", ["thunder_cloud_and_rain"], 2, 9, 31, 0],
        "26ce": [["\u26ce"], "\ue24b", "\udbb8\udc37", ["ophiuchus"], 2, 10, 63, 0],
        "26cf": [["\u26cf"], "", "", ["pick"], 2, 11, 31, 0],
        "26d1": [["\u26d1"], "", "", ["helmet_with_white_cross"], 2, 12, 31, 0],
        "26d3": [["\u26d3"], "", "", ["chains"], 2, 13, 31, 0],
        "26d4": [["\u26d4\ufe0f", "\u26d4"], "\ue137", "\udbba\udf26", ["no_entry"], 2, 14, 63, 0],
        "26e9": [["\u26e9"], "", "", ["shinto_shrine"], 2, 15, 31, 0],
        "26ea": [["\u26ea\ufe0f", "\u26ea"], "\ue037", "\udbb9\udcbb", ["church"], 2, 16, 63, 0],
        "26f0": [["\u26f0"], "", "", ["mountain"], 2, 17, 31, 0],
        "26f1": [["\u26f1"], "", "", ["umbrella_on_ground"], 2, 18, 31, 0],
        "26f2": [["\u26f2\ufe0f", "\u26f2"], "\ue121", "\udbb9\udcbc", ["fountain"], 2, 19, 63, 0],
        "26f3": [["\u26f3\ufe0f", "\u26f3"], "\ue014", "\udbb9\udfd2", ["golf"], 2, 20, 63, 0],
        "26f4": [["\u26f4"], "", "", ["ferry"], 2, 21, 31, 0],
        "26f5": [["\u26f5\ufe0f", "\u26f5"], "\ue01c", "\udbb9\udfea", ["boat", "sailboat"], 2, 22, 63, 0],
        "26f7": [["\u26f7"], "", "", ["skier"], 2, 23, 31, 0],
        "26f8": [["\u26f8"], "", "", ["ice_skate"], 2, 24, 31, 0],
        "26fa": [["\u26fa\ufe0f", "\u26fa"], "\ue122", "\udbb9\udffb", ["tent"], 2, 31, 63, 0],
        "26fd": [["\u26fd\ufe0f", "\u26fd"], "\ue03a", "\udbb9\udff5", ["fuelpump"], 2, 32, 63, 0],
        2702: [["\u2702\ufe0f", "\u2702"], "\ue313", "\udbb9\udd3e", ["scissors"], 2, 33, 63, 0],
        2705: [["\u2705"], "", "\udbba\udf4a", ["white_check_mark"], 2, 34, 63, 0],
        2708: [["\u2708\ufe0f", "\u2708"], "\ue01d", "\udbb9\udfe9", ["airplane"], 2, 35, 63, 0],
        2709: [["\u2709\ufe0f", "\u2709"], "\ue103", "\udbb9\udd29", ["email", "envelope"], 2, 36, 63, 0],
        "270a": [["\u270a"], "\ue010", "\udbba\udf93", ["fist"], 2, 37, 63, 0],
        "270b": [["\u270b"], "\ue012", "\udbba\udf95", ["hand", "raised_hand"], 2, 43, 63, 0],
        "270c": [["\u270c\ufe0f", "\u270c"], "\ue011", "\udbba\udf94", ["v"], 3, 0, 63, 0],
        "270d": [["\u270d\ufe0f", "\u270d"], "", "", ["writing_hand"], 3, 6, 31, 0],
        "270f": [["\u270f\ufe0f", "\u270f"], "\ue301", "\udbb9\udd39", ["pencil2"], 3, 12, 63, 0],
        2712: [["\u2712\ufe0f", "\u2712"], "", "\udbb9\udd36", ["black_nib"], 3, 13, 63, 0],
        2714: [["\u2714\ufe0f", "\u2714"], "", "\udbba\udf49", ["heavy_check_mark"], 3, 14, 63, 0],
        2716: [["\u2716\ufe0f", "\u2716"], "\ue333", "\udbba\udf53", ["heavy_multiplication_x"], 3, 15, 63, 0],
        "271d": [["\u271d\ufe0f", "\u271d"], "", "", ["latin_cross"], 3, 16, 31, 0],
        2721: [["\u2721\ufe0f", "\u2721"], "", "", ["star_of_david"], 3, 17, 31, 0],
        2728: [["\u2728"], "\ue32e", "\udbba\udf60", ["sparkles"], 3, 18, 63, 0],
        2733: [["\u2733\ufe0f", "\u2733"], "\ue206", "\udbba\udf62", ["eight_spoked_asterisk"], 3, 19, 63, 0],
        2734: [["\u2734\ufe0f", "\u2734"], "\ue205", "\udbba\udf61", ["eight_pointed_black_star"], 3, 20, 63, 0],
        2744: [["\u2744\ufe0f", "\u2744"], "", "\udbb8\udc0e", ["snowflake"], 3, 21, 63, 0],
        2747: [["\u2747\ufe0f", "\u2747"], "\ue32e", "\udbba\udf77", ["sparkle"], 3, 22, 63, 0],
        "274c": [["\u274c"], "\ue333", "\udbba\udf45", ["x"], 3, 23, 63, 0],
        "274e": [["\u274e"], "\ue333", "\udbba\udf46", ["negative_squared_cross_mark"], 3, 24, 63, 0],
        2753: [["\u2753"], "\ue020", "\udbba\udf09", ["question"], 3, 25, 63, 0],
        2754: [["\u2754"], "\ue336", "\udbba\udf0a", ["grey_question"], 3, 26, 63, 0],
        2755: [["\u2755"], "\ue337", "\udbba\udf0b", ["grey_exclamation"], 3, 27, 63, 0],
        2757: [["\u2757\ufe0f", "\u2757"], "\ue021", "\udbba\udf04", ["exclamation", "heavy_exclamation_mark"], 3, 28, 63, 0],
        2763: [["\u2763\ufe0f", "\u2763"], "", "", ["heavy_heart_exclamation_mark_ornament"], 3, 29, 31, 0],
        2764: [["\u2764\ufe0f", "\u2764"], "\ue022", "\udbba\udf0c", ["heart"], 3, 30, 63, 0, "<3"],
        2795: [["\u2795"], "", "\udbba\udf51", ["heavy_plus_sign"], 3, 31, 63, 0],
        2796: [["\u2796"], "", "\udbba\udf52", ["heavy_minus_sign"], 3, 32, 63, 0],
        2797: [["\u2797"], "", "\udbba\udf54", ["heavy_division_sign"], 3, 33, 63, 0],
        "27a1": [["\u27a1\ufe0f", "\u27a1"], "\ue234", "\udbba\udefa", ["arrow_right"], 3, 34, 63, 0],
        "27b0": [["\u27b0"], "", "\udbba\udf08", ["curly_loop"], 3, 35, 63, 0],
        "27bf": [["\u27bf"], "\ue211", "\udbba\udc2b", ["loop"], 3, 36, 63, 0],
        2934: [["\u2934\ufe0f", "\u2934"], "\ue236", "\udbba\udef4", ["arrow_heading_up"], 3, 37, 63, 0],
        2935: [["\u2935\ufe0f", "\u2935"], "\ue238", "\udbba\udef5", ["arrow_heading_down"], 3, 38, 63, 0],
        "2b05": [["\u2b05\ufe0f", "\u2b05"], "\ue235", "\udbba\udefb", ["arrow_left"], 3, 39, 63, 0],
        "2b06": [["\u2b06\ufe0f", "\u2b06"], "\ue232", "\udbba\udef8", ["arrow_up"], 3, 40, 63, 0],
        "2b07": [["\u2b07\ufe0f", "\u2b07"], "\ue233", "\udbba\udef9", ["arrow_down"], 3, 41, 63, 0],
        "2b1b": [["\u2b1b\ufe0f", "\u2b1b"], "\ue21a", "\udbba\udf6c", ["black_large_square"], 3, 42, 63, 0],
        "2b1c": [["\u2b1c\ufe0f", "\u2b1c"], "\ue21b", "\udbba\udf6b", ["white_large_square"], 3, 43, 63, 0],
        "2b50": [["\u2b50\ufe0f", "\u2b50"], "\ue32f", "\udbba\udf68", ["star"], 3, 44, 63, 0],
        "2b55": [["\u2b55\ufe0f", "\u2b55"], "\ue332", "\udbba\udf44", ["o"], 3, 45, 63, 0],
        3030: [["\u3030\ufe0f", "\u3030"], "", "\udbba\udf07", ["wavy_dash"], 3, 46, 63, 0],
        "303d": [["\u303d\ufe0f", "\u303d"], "\ue12c", "\udbba\udc1b", ["part_alternation_mark"], 3, 47, 63, 0],
        3297: [["\u3297\ufe0f", "\u3297"], "\ue30d", "\udbba\udf43", ["congratulations"], 3, 48, 63, 0],
        3299: [["\u3299\ufe0f", "\u3299"], "\ue315", "\udbba\udf2b", ["secret"], 4, 0, 63, 0],
        "1f004": [["\ud83c\udc04\ufe0f", "\ud83c\udc04"], "\ue12d", "\udbba\udc0b", ["mahjong"], 4, 1, 63, 0],
        "1f0cf": [["\ud83c\udccf"], "", "\udbba\udc12", ["black_joker"], 4, 2, 63, 0],
        "1f170": [["\ud83c\udd70\ufe0f", "\ud83c\udd70"], "\ue532", "\udbb9\udd0b", ["a"], 4, 3, 63, 0],
        "1f171": [["\ud83c\udd71\ufe0f", "\ud83c\udd71"], "\ue533", "\udbb9\udd0c", ["b"], 4, 4, 63, 0],
        "1f17e": [["\ud83c\udd7e\ufe0f", "\ud83c\udd7e"], "\ue535", "\udbb9\udd0e", ["o2"], 4, 5, 63, 0],
        "1f17f": [["\ud83c\udd7f\ufe0f", "\ud83c\udd7f"], "\ue14f", "\udbb9\udff6", ["parking"], 4, 6, 63, 0],
        "1f18e": [["\ud83c\udd8e"], "\ue534", "\udbb9\udd0d", ["ab"], 4, 7, 63, 0],
        "1f191": [["\ud83c\udd91"], "", "\udbba\udf84", ["cl"], 4, 8, 63, 0],
        "1f192": [["\ud83c\udd92"], "\ue214", "\udbba\udf38", ["cool"], 4, 9, 63, 0],
        "1f193": [["\ud83c\udd93"], "", "\udbba\udf21", ["free"], 4, 10, 63, 0],
        "1f194": [["\ud83c\udd94"], "\ue229", "\udbba\udf81", ["id"], 4, 11, 63, 0],
        "1f195": [["\ud83c\udd95"], "\ue212", "\udbba\udf36", ["new"], 4, 12, 63, 0],
        "1f196": [["\ud83c\udd96"], "", "\udbba\udf28", ["ng"], 4, 13, 63, 0],
        "1f197": [["\ud83c\udd97"], "\ue24d", "\udbba\udf27", ["ok"], 4, 14, 63, 0],
        "1f198": [["\ud83c\udd98"], "", "\udbba\udf4f", ["sos"], 4, 15, 63, 0],
        "1f199": [["\ud83c\udd99"], "\ue213", "\udbba\udf37", ["up"], 4, 16, 63, 0],
        "1f19a": [["\ud83c\udd9a"], "\ue12e", "\udbba\udf32", ["vs"], 4, 17, 63, 0],
        "1f201": [["\ud83c\ude01"], "\ue203", "\udbba\udf24", ["koko"], 4, 18, 63, 0],
        "1f202": [["\ud83c\ude02\ufe0f", "\ud83c\ude02"], "\ue228", "\udbba\udf3f", ["sa"], 4, 19, 63, 0],
        "1f21a": [["\ud83c\ude1a\ufe0f", "\ud83c\ude1a"], "\ue216", "\udbba\udf3a", ["u7121"], 4, 20, 63, 0],
        "1f22f": [["\ud83c\ude2f\ufe0f", "\ud83c\ude2f"], "\ue22c", "\udbba\udf40", ["u6307"], 4, 21, 63, 0],
        "1f232": [["\ud83c\ude32"], "", "\udbba\udf2e", ["u7981"], 4, 22, 63, 0],
        "1f233": [["\ud83c\ude33"], "\ue22b", "\udbba\udf2f", ["u7a7a"], 4, 23, 63, 0],
        "1f234": [["\ud83c\ude34"], "", "\udbba\udf30", ["u5408"], 4, 24, 63, 0],
        "1f235": [["\ud83c\ude35"], "\ue22a", "\udbba\udf31", ["u6e80"], 4, 25, 63, 0],
        "1f236": [["\ud83c\ude36"], "\ue215", "\udbba\udf39", ["u6709"], 4, 26, 63, 0],
        "1f237": [["\ud83c\ude37\ufe0f", "\ud83c\ude37"], "\ue217", "\udbba\udf3b", ["u6708"], 4, 27, 63, 0],
        "1f238": [["\ud83c\ude38"], "\ue218", "\udbba\udf3c", ["u7533"], 4, 28, 63, 0],
        "1f239": [["\ud83c\ude39"], "\ue227", "\udbba\udf3e", ["u5272"], 4, 29, 63, 0],
        "1f23a": [["\ud83c\ude3a"], "\ue22d", "\udbba\udf41", ["u55b6"], 4, 30, 63, 0],
        "1f250": [["\ud83c\ude50"], "\ue226", "\udbba\udf3d", ["ideograph_advantage"], 4, 31, 63, 0],
        "1f251": [["\ud83c\ude51"], "", "\udbba\udf50", ["accept"], 4, 32, 63, 0],
        "1f300": [["\ud83c\udf00"], "\ue443", "\udbb8\udc05", ["cyclone"], 4, 33, 63, 0],
        "1f301": [["\ud83c\udf01"], "", "\udbb8\udc06", ["foggy"], 4, 34, 63, 0],
        "1f302": [["\ud83c\udf02"], "\ue43c", "\udbb8\udc07", ["closed_umbrella"], 4, 35, 63, 0],
        "1f303": [["\ud83c\udf03"], "\ue44b", "\udbb8\udc08", ["night_with_stars"], 4, 36, 63, 0],
        "1f304": [["\ud83c\udf04"], "\ue04d", "\udbb8\udc09", ["sunrise_over_mountains"], 4, 37, 63, 0],
        "1f305": [["\ud83c\udf05"], "\ue449", "\udbb8\udc0a", ["sunrise"], 4, 38, 63, 0],
        "1f306": [["\ud83c\udf06"], "\ue146", "\udbb8\udc0b", ["city_sunset"], 4, 39, 63, 0],
        "1f307": [["\ud83c\udf07"], "\ue44a", "\udbb8\udc0c", ["city_sunrise"], 4, 40, 63, 0],
        "1f308": [["\ud83c\udf08"], "\ue44c", "\udbb8\udc0d", ["rainbow"], 4, 41, 63, 0],
        "1f309": [["\ud83c\udf09"], "\ue44b", "\udbb8\udc10", ["bridge_at_night"], 4, 42, 63, 0],
        "1f30a": [["\ud83c\udf0a"], "\ue43e", "\udbb8\udc38", ["ocean"], 4, 43, 63, 0],
        "1f30b": [["\ud83c\udf0b"], "", "\udbb8\udc3a", ["volcano"], 4, 44, 63, 0],
        "1f30c": [["\ud83c\udf0c"], "\ue44b", "\udbb8\udc3b", ["milky_way"], 4, 45, 63, 0],
        "1f30d": [["\ud83c\udf0d"], "", "", ["earth_africa"], 4, 46, 63, 0],
        "1f30e": [["\ud83c\udf0e"], "", "", ["earth_americas"], 4, 47, 63, 0],
        "1f30f": [["\ud83c\udf0f"], "", "\udbb8\udc39", ["earth_asia"], 4, 48, 63, 0],
        "1f310": [["\ud83c\udf10"], "", "", ["globe_with_meridians"], 5, 0, 63, 0],
        "1f311": [["\ud83c\udf11"], "", "\udbb8\udc11", ["new_moon"], 5, 1, 63, 0],
        "1f312": [["\ud83c\udf12"], "", "", ["waxing_crescent_moon"], 5, 2, 63, 0],
        "1f313": [["\ud83c\udf13"], "\ue04c", "\udbb8\udc13", ["first_quarter_moon"], 5, 3, 63, 0],
        "1f314": [["\ud83c\udf14"], "\ue04c", "\udbb8\udc12", ["moon", "waxing_gibbous_moon"], 5, 4, 63, 0],
        "1f315": [["\ud83c\udf15"], "", "\udbb8\udc15", ["full_moon"], 5, 5, 63, 0],
        "1f316": [["\ud83c\udf16"], "", "", ["waning_gibbous_moon"], 5, 6, 63, 0],
        "1f317": [["\ud83c\udf17"], "", "", ["last_quarter_moon"], 5, 7, 63, 0],
        "1f318": [["\ud83c\udf18"], "", "", ["waning_crescent_moon"], 5, 8, 63, 0],
        "1f319": [["\ud83c\udf19"], "\ue04c", "\udbb8\udc14", ["crescent_moon"], 5, 9, 63, 0],
        "1f31a": [["\ud83c\udf1a"], "", "", ["new_moon_with_face"], 5, 10, 63, 0],
        "1f31b": [["\ud83c\udf1b"], "\ue04c", "\udbb8\udc16", ["first_quarter_moon_with_face"], 5, 11, 63, 0],
        "1f31c": [["\ud83c\udf1c"], "", "", ["last_quarter_moon_with_face"], 5, 12, 63, 0],
        "1f31d": [["\ud83c\udf1d"], "", "", ["full_moon_with_face"], 5, 13, 63, 0],
        "1f31e": [["\ud83c\udf1e"], "", "", ["sun_with_face"], 5, 14, 63, 0],
        "1f31f": [["\ud83c\udf1f"], "\ue335", "\udbba\udf69", ["star2"], 5, 15, 63, 0],
        "1f320": [["\ud83c\udf20"], "", "\udbba\udf6a", ["stars"], 5, 16, 63, 0],
        "1f321": [["\ud83c\udf21"], "", "", ["thermometer"], 5, 17, 31, 0],
        "1f324": [["\ud83c\udf24"], "", "", ["mostly_sunny", "sun_small_cloud"], 5, 18, 31, 0],
        "1f325": [["\ud83c\udf25"], "", "", ["barely_sunny", "sun_behind_cloud"], 5, 19, 31, 0],
        "1f326": [["\ud83c\udf26"], "", "", ["partly_sunny_rain", "sun_behind_rain_cloud"], 5, 20, 31, 0],
        "1f327": [["\ud83c\udf27"], "", "", ["rain_cloud"], 5, 21, 31, 0],
        "1f328": [["\ud83c\udf28"], "", "", ["snow_cloud"], 5, 22, 31, 0],
        "1f329": [["\ud83c\udf29"], "", "", ["lightning", "lightning_cloud"], 5, 23, 31, 0],
        "1f32a": [["\ud83c\udf2a"], "", "", ["tornado", "tornado_cloud"], 5, 24, 31, 0],
        "1f32b": [["\ud83c\udf2b"], "", "", ["fog"], 5, 25, 31, 0],
        "1f32c": [["\ud83c\udf2c"], "", "", ["wind_blowing_face"], 5, 26, 31, 0],
        "1f32d": [["\ud83c\udf2d"], "", "", ["hotdog"], 5, 27, 31, 0],
        "1f32e": [["\ud83c\udf2e"], "", "", ["taco"], 5, 28, 31, 0],
        "1f32f": [["\ud83c\udf2f"], "", "", ["burrito"], 5, 29, 31, 0],
        "1f330": [["\ud83c\udf30"], "", "\udbb8\udc4c", ["chestnut"], 5, 30, 63, 0],
        "1f331": [["\ud83c\udf31"], "\ue110", "\udbb8\udc3e", ["seedling"], 5, 31, 63, 0],
        "1f332": [["\ud83c\udf32"], "", "", ["evergreen_tree"], 5, 32, 63, 0],
        "1f333": [["\ud83c\udf33"], "", "", ["deciduous_tree"], 5, 33, 63, 0],
        "1f334": [["\ud83c\udf34"], "\ue307", "\udbb8\udc47", ["palm_tree"], 5, 34, 63, 0],
        "1f335": [["\ud83c\udf35"], "\ue308", "\udbb8\udc48", ["cactus"], 5, 35, 63, 0],
        "1f336": [["\ud83c\udf36"], "", "", ["hot_pepper"], 5, 36, 31, 0],
        "1f337": [["\ud83c\udf37"], "\ue304", "\udbb8\udc3d", ["tulip"], 5, 37, 63, 0],
        "1f338": [["\ud83c\udf38"], "\ue030", "\udbb8\udc40", ["cherry_blossom"], 5, 38, 63, 0],
        "1f339": [["\ud83c\udf39"], "\ue032", "\udbb8\udc41", ["rose"], 5, 39, 63, 0],
        "1f33a": [["\ud83c\udf3a"], "\ue303", "\udbb8\udc45", ["hibiscus"], 5, 40, 63, 0],
        "1f33b": [["\ud83c\udf3b"], "\ue305", "\udbb8\udc46", ["sunflower"], 5, 41, 63, 0],
        "1f33c": [["\ud83c\udf3c"], "\ue305", "\udbb8\udc4d", ["blossom"], 5, 42, 63, 0],
        "1f33d": [["\ud83c\udf3d"], "", "\udbb8\udc4a", ["corn"], 5, 43, 63, 0],
        "1f33e": [["\ud83c\udf3e"], "\ue444", "\udbb8\udc49", ["ear_of_rice"], 5, 44, 63, 0],
        "1f33f": [["\ud83c\udf3f"], "\ue110", "\udbb8\udc4e", ["herb"], 5, 45, 63, 0],
        "1f340": [["\ud83c\udf40"], "\ue110", "\udbb8\udc3c", ["four_leaf_clover"], 5, 46, 63, 0],
        "1f341": [["\ud83c\udf41"], "\ue118", "\udbb8\udc3f", ["maple_leaf"], 5, 47, 63, 0],
        "1f342": [["\ud83c\udf42"], "\ue119", "\udbb8\udc42", ["fallen_leaf"], 5, 48, 63, 0],
        "1f343": [["\ud83c\udf43"], "\ue447", "\udbb8\udc43", ["leaves"], 6, 0, 63, 0],
        "1f344": [["\ud83c\udf44"], "", "\udbb8\udc4b", ["mushroom"], 6, 1, 63, 0],
        "1f345": [["\ud83c\udf45"], "\ue349", "\udbb8\udc55", ["tomato"], 6, 2, 63, 0],
        "1f346": [["\ud83c\udf46"], "\ue34a", "\udbb8\udc56", ["eggplant"], 6, 3, 63, 0],
        "1f347": [["\ud83c\udf47"], "", "\udbb8\udc59", ["grapes"], 6, 4, 63, 0],
        "1f348": [["\ud83c\udf48"], "", "\udbb8\udc57", ["melon"], 6, 5, 63, 0],
        "1f349": [["\ud83c\udf49"], "\ue348", "\udbb8\udc54", ["watermelon"], 6, 6, 63, 0],
        "1f34a": [["\ud83c\udf4a"], "\ue346", "\udbb8\udc52", ["tangerine"], 6, 7, 63, 0],
        "1f34b": [["\ud83c\udf4b"], "", "", ["lemon"], 6, 8, 63, 0],
        "1f34c": [["\ud83c\udf4c"], "", "\udbb8\udc50", ["banana"], 6, 9, 63, 0],
        "1f34d": [["\ud83c\udf4d"], "", "\udbb8\udc58", ["pineapple"], 6, 10, 63, 0],
        "1f34e": [["\ud83c\udf4e"], "\ue345", "\udbb8\udc51", ["apple"], 6, 11, 63, 0],
        "1f34f": [["\ud83c\udf4f"], "\ue345", "\udbb8\udc5b", ["green_apple"], 6, 12, 63, 0],
        "1f350": [["\ud83c\udf50"], "", "", ["pear"], 6, 13, 63, 0],
        "1f351": [["\ud83c\udf51"], "", "\udbb8\udc5a", ["peach"], 6, 14, 63, 0],
        "1f352": [["\ud83c\udf52"], "", "\udbb8\udc4f", ["cherries"], 6, 15, 63, 0],
        "1f353": [["\ud83c\udf53"], "\ue347", "\udbb8\udc53", ["strawberry"], 6, 16, 63, 0],
        "1f354": [["\ud83c\udf54"], "\ue120", "\udbba\udd60", ["hamburger"], 6, 17, 63, 0],
        "1f355": [["\ud83c\udf55"], "", "\udbba\udd75", ["pizza"], 6, 18, 63, 0],
        "1f356": [["\ud83c\udf56"], "", "\udbba\udd72", ["meat_on_bone"], 6, 19, 63, 0],
        "1f357": [["\ud83c\udf57"], "", "\udbba\udd76", ["poultry_leg"], 6, 20, 63, 0],
        "1f358": [["\ud83c\udf58"], "\ue33d", "\udbba\udd69", ["rice_cracker"], 6, 21, 63, 0],
        "1f359": [["\ud83c\udf59"], "\ue342", "\udbba\udd61", ["rice_ball"], 6, 22, 63, 0],
        "1f35a": [["\ud83c\udf5a"], "\ue33e", "\udbba\udd6a", ["rice"], 6, 23, 63, 0],
        "1f35b": [["\ud83c\udf5b"], "\ue341", "\udbba\udd6c", ["curry"], 6, 24, 63, 0],
        "1f35c": [["\ud83c\udf5c"], "\ue340", "\udbba\udd63", ["ramen"], 6, 25, 63, 0],
        "1f35d": [["\ud83c\udf5d"], "\ue33f", "\udbba\udd6b", ["spaghetti"], 6, 26, 63, 0],
        "1f35e": [["\ud83c\udf5e"], "\ue339", "\udbba\udd64", ["bread"], 6, 27, 63, 0],
        "1f35f": [["\ud83c\udf5f"], "\ue33b", "\udbba\udd67", ["fries"], 6, 28, 63, 0],
        "1f360": [["\ud83c\udf60"], "", "\udbba\udd74", ["sweet_potato"], 6, 29, 63, 0],
        "1f361": [["\ud83c\udf61"], "\ue33c", "\udbba\udd68", ["dango"], 6, 30, 63, 0],
        "1f362": [["\ud83c\udf62"], "\ue343", "\udbba\udd6d", ["oden"], 6, 31, 63, 0],
        "1f363": [["\ud83c\udf63"], "\ue344", "\udbba\udd6e", ["sushi"], 6, 32, 63, 0],
        "1f364": [["\ud83c\udf64"], "", "\udbba\udd7f", ["fried_shrimp"], 6, 33, 63, 0],
        "1f365": [["\ud83c\udf65"], "", "\udbba\udd73", ["fish_cake"], 6, 34, 63, 0],
        "1f366": [["\ud83c\udf66"], "\ue33a", "\udbba\udd66", ["icecream"], 6, 35, 63, 0],
        "1f367": [["\ud83c\udf67"], "\ue43f", "\udbba\udd71", ["shaved_ice"], 6, 36, 63, 0],
        "1f368": [["\ud83c\udf68"], "", "\udbba\udd77", ["ice_cream"], 6, 37, 63, 0],
        "1f369": [["\ud83c\udf69"], "", "\udbba\udd78", ["doughnut"], 6, 38, 63, 0],
        "1f36a": [["\ud83c\udf6a"], "", "\udbba\udd79", ["cookie"], 6, 39, 63, 0],
        "1f36b": [["\ud83c\udf6b"], "", "\udbba\udd7a", ["chocolate_bar"], 6, 40, 63, 0],
        "1f36c": [["\ud83c\udf6c"], "", "\udbba\udd7b", ["candy"], 6, 41, 63, 0],
        "1f36d": [["\ud83c\udf6d"], "", "\udbba\udd7c", ["lollipop"], 6, 42, 63, 0],
        "1f36e": [["\ud83c\udf6e"], "", "\udbba\udd7d", ["custard"], 6, 43, 63, 0],
        "1f36f": [["\ud83c\udf6f"], "", "\udbba\udd7e", ["honey_pot"], 6, 44, 63, 0],
        "1f370": [["\ud83c\udf70"], "\ue046", "\udbba\udd62", ["cake"], 6, 45, 63, 0],
        "1f371": [["\ud83c\udf71"], "\ue34c", "\udbba\udd6f", ["bento"], 6, 46, 63, 0],
        "1f372": [["\ud83c\udf72"], "\ue34d", "\udbba\udd70", ["stew"], 6, 47, 63, 0],
        "1f373": [["\ud83c\udf73"], "\ue147", "\udbba\udd65", ["fried_egg", "cooking"], 6, 48, 63, 0],
        "1f374": [["\ud83c\udf74"], "\ue043", "\udbba\udd80", ["fork_and_knife"], 7, 0, 63, 0],
        "1f375": [["\ud83c\udf75"], "\ue338", "\udbba\udd84", ["tea"], 7, 1, 63, 0],
        "1f376": [["\ud83c\udf76"], "\ue30b", "\udbba\udd85", ["sake"], 7, 2, 63, 0],
        "1f377": [["\ud83c\udf77"], "\ue044", "\udbba\udd86", ["wine_glass"], 7, 3, 63, 0],
        "1f378": [["\ud83c\udf78"], "\ue044", "\udbba\udd82", ["cocktail"], 7, 4, 63, 0],
        "1f379": [["\ud83c\udf79"], "\ue044", "\udbba\udd88", ["tropical_drink"], 7, 5, 63, 0],
        "1f37a": [["\ud83c\udf7a"], "\ue047", "\udbba\udd83", ["beer"], 7, 6, 63, 0],
        "1f37b": [["\ud83c\udf7b"], "\ue30c", "\udbba\udd87", ["beers"], 7, 7, 63, 0],
        "1f37c": [["\ud83c\udf7c"], "", "", ["baby_bottle"], 7, 8, 63, 0],
        "1f37d": [["\ud83c\udf7d"], "", "", ["knife_fork_plate"], 7, 9, 31, 0],
        "1f37e": [["\ud83c\udf7e"], "", "", ["champagne"], 7, 10, 31, 0],
        "1f37f": [["\ud83c\udf7f"], "", "", ["popcorn"], 7, 11, 31, 0],
        "1f380": [["\ud83c\udf80"], "\ue314", "\udbb9\udd0f", ["ribbon"], 7, 12, 63, 0],
        "1f381": [["\ud83c\udf81"], "\ue112", "\udbb9\udd10", ["gift"], 7, 13, 63, 0],
        "1f382": [["\ud83c\udf82"], "\ue34b", "\udbb9\udd11", ["birthday"], 7, 14, 63, 0],
        "1f383": [["\ud83c\udf83"], "\ue445", "\udbb9\udd1f", ["jack_o_lantern"], 7, 15, 63, 0],
        "1f384": [["\ud83c\udf84"], "\ue033", "\udbb9\udd12", ["christmas_tree"], 7, 16, 63, 0],
        "1f385": [["\ud83c\udf85"], "\ue448", "\udbb9\udd13", ["santa"], 7, 17, 63, 0],
        "1f386": [["\ud83c\udf86"], "\ue117", "\udbb9\udd15", ["fireworks"], 7, 23, 63, 0],
        "1f387": [["\ud83c\udf87"], "\ue440", "\udbb9\udd1d", ["sparkler"], 7, 24, 63, 0],
        "1f388": [["\ud83c\udf88"], "\ue310", "\udbb9\udd16", ["balloon"], 7, 25, 63, 0],
        "1f389": [["\ud83c\udf89"], "\ue312", "\udbb9\udd17", ["tada"], 7, 26, 63, 0],
        "1f38a": [["\ud83c\udf8a"], "", "\udbb9\udd20", ["confetti_ball"], 7, 27, 63, 0],
        "1f38b": [["\ud83c\udf8b"], "", "\udbb9\udd21", ["tanabata_tree"], 7, 28, 63, 0],
        "1f38c": [["\ud83c\udf8c"], "\ue143", "\udbb9\udd14", ["crossed_flags"], 7, 29, 63, 0],
        "1f38d": [["\ud83c\udf8d"], "\ue436", "\udbb9\udd18", ["bamboo"], 7, 30, 63, 0],
        "1f38e": [["\ud83c\udf8e"], "\ue438", "\udbb9\udd19", ["dolls"], 7, 31, 63, 0],
        "1f38f": [["\ud83c\udf8f"], "\ue43b", "\udbb9\udd1c", ["flags"], 7, 32, 63, 0],
        "1f390": [["\ud83c\udf90"], "\ue442", "\udbb9\udd1e", ["wind_chime"], 7, 33, 63, 0],
        "1f391": [["\ud83c\udf91"], "\ue446", "\udbb8\udc17", ["rice_scene"], 7, 34, 63, 0],
        "1f392": [["\ud83c\udf92"], "\ue43a", "\udbb9\udd1b", ["school_satchel"], 7, 35, 63, 0],
        "1f393": [["\ud83c\udf93"], "\ue439", "\udbb9\udd1a", ["mortar_board"], 7, 36, 63, 0],
        "1f396": [["\ud83c\udf96"], "", "", ["medal"], 7, 37, 31, 0],
        "1f397": [["\ud83c\udf97"], "", "", ["reminder_ribbon"], 7, 38, 31, 0],
        "1f399": [["\ud83c\udf99"], "", "", ["studio_microphone"], 7, 39, 31, 0],
        "1f39a": [["\ud83c\udf9a"], "", "", ["level_slider"], 7, 40, 31, 0],
        "1f39b": [["\ud83c\udf9b"], "", "", ["control_knobs"], 7, 41, 31, 0],
        "1f39e": [["\ud83c\udf9e"], "", "", ["film_frames"], 7, 42, 31, 0],
        "1f39f": [["\ud83c\udf9f"], "", "", ["admission_tickets"], 7, 43, 31, 0],
        "1f3a0": [["\ud83c\udfa0"], "", "\udbb9\udffc", ["carousel_horse"], 7, 44, 63, 0],
        "1f3a1": [["\ud83c\udfa1"], "\ue124", "\udbb9\udffd", ["ferris_wheel"], 7, 45, 63, 0],
        "1f3a2": [["\ud83c\udfa2"], "\ue433", "\udbb9\udffe", ["roller_coaster"], 7, 46, 63, 0],
        "1f3a3": [["\ud83c\udfa3"], "\ue019", "\udbb9\udfff", ["fishing_pole_and_fish"], 7, 47, 63, 0],
        "1f3a4": [["\ud83c\udfa4"], "\ue03c", "\udbba\udc00", ["microphone"], 7, 48, 63, 0],
        "1f3a5": [["\ud83c\udfa5"], "\ue03d", "\udbba\udc01", ["movie_camera"], 8, 0, 63, 0],
        "1f3a6": [["\ud83c\udfa6"], "\ue507", "\udbba\udc02", ["cinema"], 8, 1, 63, 0],
        "1f3a7": [["\ud83c\udfa7"], "\ue30a", "\udbba\udc03", ["headphones"], 8, 2, 63, 0],
        "1f3a8": [["\ud83c\udfa8"], "\ue502", "\udbba\udc04", ["art"], 8, 3, 63, 0],
        "1f3a9": [["\ud83c\udfa9"], "\ue503", "\udbba\udc05", ["tophat"], 8, 4, 63, 0],
        "1f3aa": [["\ud83c\udfaa"], "", "\udbba\udc06", ["circus_tent"], 8, 5, 63, 0],
        "1f3ab": [["\ud83c\udfab"], "\ue125", "\udbba\udc07", ["ticket"], 8, 6, 63, 0],
        "1f3ac": [["\ud83c\udfac"], "\ue324", "\udbba\udc08", ["clapper"], 8, 7, 63, 0],
        "1f3ad": [["\ud83c\udfad"], "\ue503", "\udbba\udc09", ["performing_arts"], 8, 8, 63, 0],
        "1f3ae": [["\ud83c\udfae"], "", "\udbba\udc0a", ["video_game"], 8, 9, 63, 0],
        "1f3af": [["\ud83c\udfaf"], "\ue130", "\udbba\udc0c", ["dart"], 8, 10, 63, 0],
        "1f3b0": [["\ud83c\udfb0"], "\ue133", "\udbba\udc0d", ["slot_machine"], 8, 11, 63, 0],
        "1f3b1": [["\ud83c\udfb1"], "\ue42c", "\udbba\udc0e", ["8ball"], 8, 12, 63, 0],
        "1f3b2": [["\ud83c\udfb2"], "", "\udbba\udc0f", ["game_die"], 8, 13, 63, 0],
        "1f3b3": [["\ud83c\udfb3"], "", "\udbba\udc10", ["bowling"], 8, 14, 63, 0],
        "1f3b4": [["\ud83c\udfb4"], "", "\udbba\udc11", ["flower_playing_cards"], 8, 15, 63, 0],
        "1f3b5": [["\ud83c\udfb5"], "\ue03e", "\udbba\udc13", ["musical_note"], 8, 16, 63, 0],
        "1f3b6": [["\ud83c\udfb6"], "\ue326", "\udbba\udc14", ["notes"], 8, 17, 63, 0],
        "1f3b7": [["\ud83c\udfb7"], "\ue040", "\udbba\udc15", ["saxophone"], 8, 18, 63, 0],
        "1f3b8": [["\ud83c\udfb8"], "\ue041", "\udbba\udc16", ["guitar"], 8, 19, 63, 0],
        "1f3b9": [["\ud83c\udfb9"], "", "\udbba\udc17", ["musical_keyboard"], 8, 20, 63, 0],
        "1f3ba": [["\ud83c\udfba"], "\ue042", "\udbba\udc18", ["trumpet"], 8, 21, 63, 0],
        "1f3bb": [["\ud83c\udfbb"], "", "\udbba\udc19", ["violin"], 8, 22, 63, 0],
        "1f3bc": [["\ud83c\udfbc"], "\ue326", "\udbba\udc1a", ["musical_score"], 8, 23, 63, 0],
        "1f3bd": [["\ud83c\udfbd"], "", "\udbb9\udfd0", ["running_shirt_with_sash"], 8, 24, 63, 0],
        "1f3be": [["\ud83c\udfbe"], "\ue015", "\udbb9\udfd3", ["tennis"], 8, 25, 63, 0],
        "1f3bf": [["\ud83c\udfbf"], "\ue013", "\udbb9\udfd5", ["ski"], 8, 26, 63, 0],
        "1f3c0": [["\ud83c\udfc0"], "\ue42a", "\udbb9\udfd6", ["basketball"], 8, 27, 63, 0],
        "1f3c1": [["\ud83c\udfc1"], "\ue132", "\udbb9\udfd7", ["checkered_flag"], 8, 28, 63, 0],
        "1f3c2": [["\ud83c\udfc2"], "", "\udbb9\udfd8", ["snowboarder"], 8, 29, 63, 0],
        "1f3c5": [["\ud83c\udfc5"], "", "", ["sports_medal"], 8, 47, 31, 0],
        "1f3c6": [["\ud83c\udfc6"], "\ue131", "\udbb9\udfdb", ["trophy"], 8, 48, 63, 0],
        "1f3c7": [["\ud83c\udfc7"], "", "", ["horse_racing"], 9, 0, 63, 0],
        "1f3c8": [["\ud83c\udfc8"], "\ue42b", "\udbb9\udfdd", ["football"], 9, 6, 63, 0],
        "1f3c9": [["\ud83c\udfc9"], "", "", ["rugby_football"], 9, 7, 63, 0],
        "1f3cd": [["\ud83c\udfcd"], "", "", ["racing_motorcycle"], 9, 26, 31, 0],
        "1f3ce": [["\ud83c\udfce"], "", "", ["racing_car"], 9, 27, 31, 0],
        "1f3cf": [["\ud83c\udfcf"], "", "", ["cricket_bat_and_ball"], 9, 28, 31, 0],
        "1f3d0": [["\ud83c\udfd0"], "", "", ["volleyball"], 9, 29, 31, 0],
        "1f3d1": [["\ud83c\udfd1"], "", "", ["field_hockey_stick_and_ball"], 9, 30, 31, 0],
        "1f3d2": [["\ud83c\udfd2"], "", "", ["ice_hockey_stick_and_puck"], 9, 31, 31, 0],
        "1f3d3": [["\ud83c\udfd3"], "", "", ["table_tennis_paddle_and_ball"], 9, 32, 31, 0],
        "1f3d4": [["\ud83c\udfd4"], "", "", ["snow_capped_mountain"], 9, 33, 31, 0],
        "1f3d5": [["\ud83c\udfd5"], "", "", ["camping"], 9, 34, 31, 0],
        "1f3d6": [["\ud83c\udfd6"], "", "", ["beach_with_umbrella"], 9, 35, 31, 0],
        "1f3d7": [["\ud83c\udfd7"], "", "", ["building_construction"], 9, 36, 31, 0],
        "1f3d8": [["\ud83c\udfd8"], "", "", ["house_buildings"], 9, 37, 31, 0],
        "1f3d9": [["\ud83c\udfd9"], "", "", ["cityscape"], 9, 38, 31, 0],
        "1f3da": [["\ud83c\udfda"], "", "", ["derelict_house_building"], 9, 39, 31, 0],
        "1f3db": [["\ud83c\udfdb"], "", "", ["classical_building"], 9, 40, 31, 0],
        "1f3dc": [["\ud83c\udfdc"], "", "", ["desert"], 9, 41, 31, 0],
        "1f3dd": [["\ud83c\udfdd"], "", "", ["desert_island"], 9, 42, 31, 0],
        "1f3de": [["\ud83c\udfde"], "", "", ["national_park"], 9, 43, 31, 0],
        "1f3df": [["\ud83c\udfdf"], "", "", ["stadium"], 9, 44, 31, 0],
        "1f3e0": [["\ud83c\udfe0"], "\ue036", "\udbb9\udcb0", ["house"], 9, 45, 63, 0],
        "1f3e1": [["\ud83c\udfe1"], "\ue036", "\udbb9\udcb1", ["house_with_garden"], 9, 46, 63, 0],
        "1f3e2": [["\ud83c\udfe2"], "\ue038", "\udbb9\udcb2", ["office"], 9, 47, 63, 0],
        "1f3e3": [["\ud83c\udfe3"], "\ue153", "\udbb9\udcb3", ["post_office"], 9, 48, 63, 0],
        "1f3e4": [["\ud83c\udfe4"], "", "", ["european_post_office"], 10, 0, 63, 0],
        "1f3e5": [["\ud83c\udfe5"], "\ue155", "\udbb9\udcb4", ["hospital"], 10, 1, 63, 0],
        "1f3e6": [["\ud83c\udfe6"], "\ue14d", "\udbb9\udcb5", ["bank"], 10, 2, 63, 0],
        "1f3e7": [["\ud83c\udfe7"], "\ue154", "\udbb9\udcb6", ["atm"], 10, 3, 63, 0],
        "1f3e8": [["\ud83c\udfe8"], "\ue158", "\udbb9\udcb7", ["hotel"], 10, 4, 63, 0],
        "1f3e9": [["\ud83c\udfe9"], "\ue501", "\udbb9\udcb8", ["love_hotel"], 10, 5, 63, 0],
        "1f3ea": [["\ud83c\udfea"], "\ue156", "\udbb9\udcb9", ["convenience_store"], 10, 6, 63, 0],
        "1f3eb": [["\ud83c\udfeb"], "\ue157", "\udbb9\udcba", ["school"], 10, 7, 63, 0],
        "1f3ec": [["\ud83c\udfec"], "\ue504", "\udbb9\udcbd", ["department_store"], 10, 8, 63, 0],
        "1f3ed": [["\ud83c\udfed"], "\ue508", "\udbb9\udcc0", ["factory"], 10, 9, 63, 0],
        "1f3ee": [["\ud83c\udfee"], "\ue30b", "\udbb9\udcc2", ["izakaya_lantern", "lantern"], 10, 10, 63, 0],
        "1f3ef": [["\ud83c\udfef"], "\ue505", "\udbb9\udcbe", ["japanese_castle"], 10, 11, 63, 0],
        "1f3f0": [["\ud83c\udff0"], "\ue506", "\udbb9\udcbf", ["european_castle"], 10, 12, 63, 0],
        "1f3f3": [["\ud83c\udff3\ufe0f", "\ud83c\udff3"], "", "", ["waving_white_flag"], 10, 13, 31, 0],
        "1f3f4": [["\ud83c\udff4"], "", "", ["waving_black_flag"], 10, 14, 31, 0],
        "1f3f5": [["\ud83c\udff5"], "", "", ["rosette"], 10, 15, 31, 0],
        "1f3f7": [["\ud83c\udff7"], "", "", ["label"], 10, 16, 31, 0],
        "1f3f8": [["\ud83c\udff8"], "", "", ["badminton_racquet_and_shuttlecock"], 10, 17, 31, 0],
        "1f3f9": [["\ud83c\udff9"], "", "", ["bow_and_arrow"], 10, 18, 31, 0],
        "1f3fa": [["\ud83c\udffa"], "", "", ["amphora"], 10, 19, 31, 0],
        "1f3fb": [["\ud83c\udffb"], "", "", ["skin-tone-2"], 10, 20, 31, 0],
        "1f3fc": [["\ud83c\udffc"], "", "", ["skin-tone-3"], 10, 21, 31, 0],
        "1f3fd": [["\ud83c\udffd"], "", "", ["skin-tone-4"], 10, 22, 31, 0],
        "1f3fe": [["\ud83c\udffe"], "", "", ["skin-tone-5"], 10, 23, 31, 0],
        "1f3ff": [["\ud83c\udfff"], "", "", ["skin-tone-6"], 10, 24, 31, 0],
        "1f400": [["\ud83d\udc00"], "", "", ["rat"], 10, 25, 63, 0],
        "1f401": [["\ud83d\udc01"], "", "", ["mouse2"], 10, 26, 63, 0],
        "1f402": [["\ud83d\udc02"], "", "", ["ox"], 10, 27, 63, 0],
        "1f403": [["\ud83d\udc03"], "", "", ["water_buffalo"], 10, 28, 63, 0],
        "1f404": [["\ud83d\udc04"], "", "", ["cow2"], 10, 29, 63, 0],
        "1f405": [["\ud83d\udc05"], "", "", ["tiger2"], 10, 30, 63, 0],
        "1f406": [["\ud83d\udc06"], "", "", ["leopard"], 10, 31, 63, 0],
        "1f407": [["\ud83d\udc07"], "", "", ["rabbit2"], 10, 32, 63, 0],
        "1f408": [["\ud83d\udc08"], "", "", ["cat2"], 10, 33, 63, 0],
        "1f409": [["\ud83d\udc09"], "", "", ["dragon"], 10, 34, 63, 0],
        "1f40a": [["\ud83d\udc0a"], "", "", ["crocodile"], 10, 35, 63, 0],
        "1f40b": [["\ud83d\udc0b"], "", "", ["whale2"], 10, 36, 63, 0],
        "1f40c": [["\ud83d\udc0c"], "", "\udbb8\uddb9", ["snail"], 10, 37, 63, 0],
        "1f40d": [["\ud83d\udc0d"], "\ue52d", "\udbb8\uddd3", ["snake"], 10, 38, 63, 0],
        "1f40e": [["\ud83d\udc0e"], "\ue134", "\udbb9\udfdc", ["racehorse"], 10, 39, 63, 0],
        "1f40f": [["\ud83d\udc0f"], "", "", ["ram"], 10, 40, 63, 0],
        "1f410": [["\ud83d\udc10"], "", "", ["goat"], 10, 41, 63, 0],
        "1f411": [["\ud83d\udc11"], "\ue529", "\udbb8\uddcf", ["sheep"], 10, 42, 63, 0],
        "1f412": [["\ud83d\udc12"], "\ue528", "\udbb8\uddce", ["monkey"], 10, 43, 63, 0],
        "1f413": [["\ud83d\udc13"], "", "", ["rooster"], 10, 44, 63, 0],
        "1f414": [["\ud83d\udc14"], "\ue52e", "\udbb8\uddd4", ["chicken"], 10, 45, 63, 0],
        "1f415": [["\ud83d\udc15"], "", "", ["dog2"], 10, 46, 63, 0],
        "1f416": [["\ud83d\udc16"], "", "", ["pig2"], 10, 47, 63, 0],
        "1f417": [["\ud83d\udc17"], "\ue52f", "\udbb8\uddd5", ["boar"], 10, 48, 63, 0],
        "1f418": [["\ud83d\udc18"], "\ue526", "\udbb8\uddcc", ["elephant"], 11, 0, 63, 0],
        "1f419": [["\ud83d\udc19"], "\ue10a", "\udbb8\uddc5", ["octopus"], 11, 1, 63, 0],
        "1f41a": [["\ud83d\udc1a"], "\ue441", "\udbb8\uddc6", ["shell"], 11, 2, 63, 0],
        "1f41b": [["\ud83d\udc1b"], "\ue525", "\udbb8\uddcb", ["bug"], 11, 3, 63, 0],
        "1f41c": [["\ud83d\udc1c"], "", "\udbb8\uddda", ["ant"], 11, 4, 63, 0],
        "1f41d": [["\ud83d\udc1d"], "", "\udbb8\udde1", ["bee", "honeybee"], 11, 5, 63, 0],
        "1f41e": [["\ud83d\udc1e"], "", "\udbb8\udde2", ["beetle"], 11, 6, 63, 0],
        "1f41f": [["\ud83d\udc1f"], "\ue019", "\udbb8\uddbd", ["fish"], 11, 7, 63, 0],
        "1f420": [["\ud83d\udc20"], "\ue522", "\udbb8\uddc9", ["tropical_fish"], 11, 8, 63, 0],
        "1f421": [["\ud83d\udc21"], "\ue019", "\udbb8\uddd9", ["blowfish"], 11, 9, 63, 0],
        "1f422": [["\ud83d\udc22"], "", "\udbb8\udddc", ["turtle"], 11, 10, 63, 0],
        "1f423": [["\ud83d\udc23"], "\ue523", "\udbb8\udddd", ["hatching_chick"], 11, 11, 63, 0],
        "1f424": [["\ud83d\udc24"], "\ue523", "\udbb8\uddba", ["baby_chick"], 11, 12, 63, 0],
        "1f425": [["\ud83d\udc25"], "\ue523", "\udbb8\uddbb", ["hatched_chick"], 11, 13, 63, 0],
        "1f426": [["\ud83d\udc26"], "\ue521", "\udbb8\uddc8", ["bird"], 11, 14, 63, 0],
        "1f427": [["\ud83d\udc27"], "\ue055", "\udbb8\uddbc", ["penguin"], 11, 15, 63, 0],
        "1f428": [["\ud83d\udc28"], "\ue527", "\udbb8\uddcd", ["koala"], 11, 16, 63, 0],
        "1f429": [["\ud83d\udc29"], "\ue052", "\udbb8\uddd8", ["poodle"], 11, 17, 63, 0],
        "1f42a": [["\ud83d\udc2a"], "", "", ["dromedary_camel"], 11, 18, 63, 0],
        "1f42b": [["\ud83d\udc2b"], "\ue530", "\udbb8\uddd6", ["camel"], 11, 19, 63, 0],
        "1f42c": [["\ud83d\udc2c"], "\ue520", "\udbb8\uddc7", ["dolphin", "flipper"], 11, 20, 63, 0],
        "1f42d": [["\ud83d\udc2d"], "\ue053", "\udbb8\uddc2", ["mouse"], 11, 21, 63, 0],
        "1f42e": [["\ud83d\udc2e"], "\ue52b", "\udbb8\uddd1", ["cow"], 11, 22, 63, 0],
        "1f42f": [["\ud83d\udc2f"], "\ue050", "\udbb8\uddc0", ["tiger"], 11, 23, 63, 0],
        "1f430": [["\ud83d\udc30"], "\ue52c", "\udbb8\uddd2", ["rabbit"], 11, 24, 63, 0],
        "1f431": [["\ud83d\udc31"], "\ue04f", "\udbb8\uddb8", ["cat"], 11, 25, 63, 0],
        "1f432": [["\ud83d\udc32"], "", "\udbb8\uddde", ["dragon_face"], 11, 26, 63, 0],
        "1f433": [["\ud83d\udc33"], "\ue054", "\udbb8\uddc3", ["whale"], 11, 27, 63, 0],
        "1f434": [["\ud83d\udc34"], "\ue01a", "\udbb8\uddbe", ["horse"], 11, 28, 63, 0],
        "1f435": [["\ud83d\udc35"], "\ue109", "\udbb8\uddc4", ["monkey_face"], 11, 29, 63, 0],
        "1f436": [["\ud83d\udc36"], "\ue052", "\udbb8\uddb7", ["dog"], 11, 30, 63, 0],
        "1f437": [["\ud83d\udc37"], "\ue10b", "\udbb8\uddbf", ["pig"], 11, 31, 63, 0],
        "1f438": [["\ud83d\udc38"], "\ue531", "\udbb8\uddd7", ["frog"], 11, 32, 63, 0],
        "1f439": [["\ud83d\udc39"], "\ue524", "\udbb8\uddca", ["hamster"], 11, 33, 63, 0],
        "1f43a": [["\ud83d\udc3a"], "\ue52a", "\udbb8\uddd0", ["wolf"], 11, 34, 63, 0],
        "1f43b": [["\ud83d\udc3b"], "\ue051", "\udbb8\uddc1", ["bear"], 11, 35, 63, 0],
        "1f43c": [["\ud83d\udc3c"], "", "\udbb8\udddf", ["panda_face"], 11, 36, 63, 0],
        "1f43d": [["\ud83d\udc3d"], "\ue10b", "\udbb8\udde0", ["pig_nose"], 11, 37, 63, 0],
        "1f43e": [["\ud83d\udc3e"], "\ue536", "\udbb8\udddb", ["feet", "paw_prints"], 11, 38, 63, 0],
        "1f43f": [["\ud83d\udc3f"], "", "", ["chipmunk"], 11, 39, 31, 0],
        "1f440": [["\ud83d\udc40"], "\ue419", "\udbb8\udd90", ["eyes"], 11, 40, 63, 0],
        "1f441": [["\ud83d\udc41"], "", "", ["eye"], 11, 41, 31, 0],
        "1f442": [["\ud83d\udc42"], "\ue41b", "\udbb8\udd91", ["ear"], 11, 42, 63, 0],
        "1f443": [["\ud83d\udc43"], "\ue41a", "\udbb8\udd92", ["nose"], 11, 48, 63, 0],
        "1f444": [["\ud83d\udc44"], "\ue41c", "\udbb8\udd93", ["lips"], 12, 5, 63, 0],
        "1f445": [["\ud83d\udc45"], "\ue409", "\udbb8\udd94", ["tongue"], 12, 6, 63, 0],
        "1f446": [["\ud83d\udc46"], "\ue22e", "\udbba\udf99", ["point_up_2"], 12, 7, 63, 0],
        "1f447": [["\ud83d\udc47"], "\ue22f", "\udbba\udf9a", ["point_down"], 12, 13, 63, 0],
        "1f448": [["\ud83d\udc48"], "\ue230", "\udbba\udf9b", ["point_left"], 12, 19, 63, 0],
        "1f449": [["\ud83d\udc49"], "\ue231", "\udbba\udf9c", ["point_right"], 12, 25, 63, 0],
        "1f44a": [["\ud83d\udc4a"], "\ue00d", "\udbba\udf96", ["facepunch", "punch"], 12, 31, 63, 0],
        "1f44b": [["\ud83d\udc4b"], "\ue41e", "\udbba\udf9d", ["wave"], 12, 37, 63, 0],
        "1f44c": [["\ud83d\udc4c"], "\ue420", "\udbba\udf9f", ["ok_hand"], 12, 43, 63, 0],
        "1f44d": [["\ud83d\udc4d"], "\ue00e", "\udbba\udf97", ["+1", "thumbsup"], 13, 0, 63, 0],
        "1f44e": [["\ud83d\udc4e"], "\ue421", "\udbba\udfa0", ["-1", "thumbsdown"], 13, 6, 63, 0],
        "1f44f": [["\ud83d\udc4f"], "\ue41f", "\udbba\udf9e", ["clap"], 13, 12, 63, 0],
        "1f450": [["\ud83d\udc50"], "\ue422", "\udbba\udfa1", ["open_hands"], 13, 18, 63, 0],
        "1f451": [["\ud83d\udc51"], "\ue10e", "\udbb9\udcd1", ["crown"], 13, 24, 63, 0],
        "1f452": [["\ud83d\udc52"], "\ue318", "\udbb9\udcd4", ["womans_hat"], 13, 25, 63, 0],
        "1f453": [["\ud83d\udc53"], "", "\udbb9\udcce", ["eyeglasses"], 13, 26, 63, 0],
        "1f454": [["\ud83d\udc54"], "\ue302", "\udbb9\udcd3", ["necktie"], 13, 27, 63, 0],
        "1f455": [["\ud83d\udc55"], "\ue006", "\udbb9\udccf", ["shirt", "tshirt"], 13, 28, 63, 0],
        "1f456": [["\ud83d\udc56"], "", "\udbb9\udcd0", ["jeans"], 13, 29, 63, 0],
        "1f457": [["\ud83d\udc57"], "\ue319", "\udbb9\udcd5", ["dress"], 13, 30, 63, 0],
        "1f458": [["\ud83d\udc58"], "\ue321", "\udbb9\udcd9", ["kimono"], 13, 31, 63, 0],
        "1f459": [["\ud83d\udc59"], "\ue322", "\udbb9\udcda", ["bikini"], 13, 32, 63, 0],
        "1f45a": [["\ud83d\udc5a"], "\ue006", "\udbb9\udcdb", ["womans_clothes"], 13, 33, 63, 0],
        "1f45b": [["\ud83d\udc5b"], "", "\udbb9\udcdc", ["purse"], 13, 34, 63, 0],
        "1f45c": [["\ud83d\udc5c"], "\ue323", "\udbb9\udcf0", ["handbag"], 13, 35, 63, 0],
        "1f45d": [["\ud83d\udc5d"], "", "\udbb9\udcf1", ["pouch"], 13, 36, 63, 0],
        "1f45e": [["\ud83d\udc5e"], "\ue007", "\udbb9\udccc", ["mans_shoe", "shoe"], 13, 37, 63, 0],
        "1f45f": [["\ud83d\udc5f"], "\ue007", "\udbb9\udccd", ["athletic_shoe"], 13, 38, 63, 0],
        "1f460": [["\ud83d\udc60"], "\ue13e", "\udbb9\udcd6", ["high_heel"], 13, 39, 63, 0],
        "1f461": [["\ud83d\udc61"], "\ue31a", "\udbb9\udcd7", ["sandal"], 13, 40, 63, 0],
        "1f462": [["\ud83d\udc62"], "\ue31b", "\udbb9\udcd8", ["boot"], 13, 41, 63, 0],
        "1f463": [["\ud83d\udc63"], "\ue536", "\udbb9\udd53", ["footprints"], 13, 42, 63, 0],
        "1f464": [["\ud83d\udc64"], "", "\udbb8\udd9a", ["bust_in_silhouette"], 13, 43, 63, 0],
        "1f465": [["\ud83d\udc65"], "", "", ["busts_in_silhouette"], 13, 44, 63, 0],
        "1f466": [["\ud83d\udc66"], "\ue001", "\udbb8\udd9b", ["boy"], 13, 45, 63, 0],
        "1f467": [["\ud83d\udc67"], "\ue002", "\udbb8\udd9c", ["girl"], 14, 2, 63, 0],
        "1f468": [["\ud83d\udc68"], "\ue004", "\udbb8\udd9d", ["man"], 14, 8, 63, 0],
        "1f469": [["\ud83d\udc69"], "\ue005", "\udbb8\udd9e", ["woman"], 14, 14, 63, 0],
        "1f46b": [["\ud83d\udc6b"], "\ue428", "\udbb8\udda0", ["couple", "man_and_woman_holding_hands"], 14, 21, 63, 0],
        "1f46c": [["\ud83d\udc6c"], "", "", ["two_men_holding_hands"], 14, 22, 63, 0],
        "1f46d": [["\ud83d\udc6d"], "", "", ["two_women_holding_hands"], 14, 23, 63, 0],
        "1f470": [["\ud83d\udc70"], "", "\udbb8\udda3", ["bride_with_veil"], 14, 31, 63, 0],
        "1f472": [["\ud83d\udc72"], "\ue516", "\udbb8\udda5", ["man_with_gua_pi_mao"], 14, 43, 63, 0],
        "1f474": [["\ud83d\udc74"], "\ue518", "\udbb8\udda7", ["older_man"], 15, 6, 63, 0],
        "1f475": [["\ud83d\udc75"], "\ue519", "\udbb8\udda8", ["older_woman"], 15, 12, 63, 0],
        "1f476": [["\ud83d\udc76"], "\ue51a", "\udbb8\udda9", ["baby"], 15, 18, 63, 0],
        "1f478": [["\ud83d\udc78"], "\ue51c", "\udbb8\uddab", ["princess"], 15, 30, 63, 0],
        "1f479": [["\ud83d\udc79"], "", "\udbb8\uddac", ["japanese_ogre"], 15, 36, 63, 0],
        "1f47a": [["\ud83d\udc7a"], "", "\udbb8\uddad", ["japanese_goblin"], 15, 37, 63, 0],
        "1f47b": [["\ud83d\udc7b"], "\ue11b", "\udbb8\uddae", ["ghost"], 15, 38, 63, 0],
        "1f47c": [["\ud83d\udc7c"], "\ue04e", "\udbb8\uddaf", ["angel"], 15, 39, 63, 0],
        "1f47d": [["\ud83d\udc7d"], "\ue10c", "\udbb8\uddb0", ["alien"], 15, 45, 63, 0],
        "1f47e": [["\ud83d\udc7e"], "\ue12b", "\udbb8\uddb1", ["space_invader"], 15, 46, 63, 0],
        "1f47f": [["\ud83d\udc7f"], "\ue11a", "\udbb8\uddb2", ["imp"], 15, 47, 63, 0],
        "1f480": [["\ud83d\udc80"], "\ue11c", "\udbb8\uddb3", ["skull"], 15, 48, 63, 0],
        "1f483": [["\ud83d\udc83"], "\ue51f", "\udbb8\uddb6", ["dancer"], 16, 12, 63, 0],
        "1f484": [["\ud83d\udc84"], "\ue31c", "\udbb8\udd95", ["lipstick"], 16, 18, 63, 0],
        "1f485": [["\ud83d\udc85"], "\ue31d", "\udbb8\udd96", ["nail_care"], 16, 19, 63, 0],
        "1f488": [["\ud83d\udc88"], "\ue320", "\udbb8\udd99", ["barber"], 16, 37, 63, 0],
        "1f489": [["\ud83d\udc89"], "\ue13b", "\udbb9\udd09", ["syringe"], 16, 38, 63, 0],
        "1f48a": [["\ud83d\udc8a"], "\ue30f", "\udbb9\udd0a", ["pill"], 16, 39, 63, 0],
        "1f48b": [["\ud83d\udc8b"], "\ue003", "\udbba\udc23", ["kiss"], 16, 40, 63, 0],
        "1f48c": [["\ud83d\udc8c"], "\ue103\ue328", "\udbba\udc24", ["love_letter"], 16, 41, 63, 0],
        "1f48d": [["\ud83d\udc8d"], "\ue034", "\udbba\udc25", ["ring"], 16, 42, 63, 0],
        "1f48e": [["\ud83d\udc8e"], "\ue035", "\udbba\udc26", ["gem"], 16, 43, 63, 0],
        "1f490": [["\ud83d\udc90"], "\ue306", "\udbba\udc28", ["bouquet"], 16, 45, 63, 0],
        "1f492": [["\ud83d\udc92"], "\ue43d", "\udbba\udc2a", ["wedding"], 16, 47, 63, 0],
        "1f493": [["\ud83d\udc93"], "\ue327", "\udbba\udf0d", ["heartbeat"], 16, 48, 63, 0],
        "1f494": [["\ud83d\udc94"], "\ue023", "\udbba\udf0e", ["broken_heart"], 17, 0, 63, 0, "</3"],
        "1f495": [["\ud83d\udc95"], "\ue327", "\udbba\udf0f", ["two_hearts"], 17, 1, 63, 0],
        "1f496": [["\ud83d\udc96"], "\ue327", "\udbba\udf10", ["sparkling_heart"], 17, 2, 63, 0],
        "1f497": [["\ud83d\udc97"], "\ue328", "\udbba\udf11", ["heartpulse"], 17, 3, 63, 0],
        "1f498": [["\ud83d\udc98"], "\ue329", "\udbba\udf12", ["cupid"], 17, 4, 63, 0],
        "1f499": [["\ud83d\udc99"], "\ue32a", "\udbba\udf13", ["blue_heart"], 17, 5, 63, 0, "<3"],
        "1f49a": [["\ud83d\udc9a"], "\ue32b", "\udbba\udf14", ["green_heart"], 17, 6, 63, 0, "<3"],
        "1f49b": [["\ud83d\udc9b"], "\ue32c", "\udbba\udf15", ["yellow_heart"], 17, 7, 63, 0, "<3"],
        "1f49c": [["\ud83d\udc9c"], "\ue32d", "\udbba\udf16", ["purple_heart"], 17, 8, 63, 0, "<3"],
        "1f49d": [["\ud83d\udc9d"], "\ue437", "\udbba\udf17", ["gift_heart"], 17, 9, 63, 0],
        "1f49e": [["\ud83d\udc9e"], "\ue327", "\udbba\udf18", ["revolving_hearts"], 17, 10, 63, 0],
        "1f49f": [["\ud83d\udc9f"], "\ue204", "\udbba\udf19", ["heart_decoration"], 17, 11, 63, 0],
        "1f4a0": [["\ud83d\udca0"], "", "\udbba\udf55", ["diamond_shape_with_a_dot_inside"], 17, 12, 63, 0],
        "1f4a1": [["\ud83d\udca1"], "\ue10f", "\udbba\udf56", ["bulb"], 17, 13, 63, 0],
        "1f4a2": [["\ud83d\udca2"], "\ue334", "\udbba\udf57", ["anger"], 17, 14, 63, 0],
        "1f4a3": [["\ud83d\udca3"], "\ue311", "\udbba\udf58", ["bomb"], 17, 15, 63, 0],
        "1f4a4": [["\ud83d\udca4"], "\ue13c", "\udbba\udf59", ["zzz"], 17, 16, 63, 0],
        "1f4a5": [["\ud83d\udca5"], "", "\udbba\udf5a", ["boom", "collision"], 17, 17, 63, 0],
        "1f4a6": [["\ud83d\udca6"], "\ue331", "\udbba\udf5b", ["sweat_drops"], 17, 18, 63, 0],
        "1f4a7": [["\ud83d\udca7"], "\ue331", "\udbba\udf5c", ["droplet"], 17, 19, 63, 0],
        "1f4a8": [["\ud83d\udca8"], "\ue330", "\udbba\udf5d", ["dash"], 17, 20, 63, 0],
        "1f4a9": [["\ud83d\udca9"], "\ue05a", "\udbb9\udcf4", ["hankey", "poop", "shit"], 17, 21, 63, 0],
        "1f4aa": [["\ud83d\udcaa"], "\ue14c", "\udbba\udf5e", ["muscle"], 17, 22, 63, 0],
        "1f4ab": [["\ud83d\udcab"], "\ue407", "\udbba\udf5f", ["dizzy"], 17, 28, 63, 0],
        "1f4ac": [["\ud83d\udcac"], "", "\udbb9\udd32", ["speech_balloon"], 17, 29, 63, 0],
        "1f4ad": [["\ud83d\udcad"], "", "", ["thought_balloon"], 17, 30, 63, 0],
        "1f4ae": [["\ud83d\udcae"], "", "\udbba\udf7a", ["white_flower"], 17, 31, 63, 0],
        "1f4af": [["\ud83d\udcaf"], "", "\udbba\udf7b", ["100"], 17, 32, 63, 0],
        "1f4b0": [["\ud83d\udcb0"], "\ue12f", "\udbb9\udcdd", ["moneybag"], 17, 33, 63, 0],
        "1f4b1": [["\ud83d\udcb1"], "\ue149", "\udbb9\udcde", ["currency_exchange"], 17, 34, 63, 0],
        "1f4b2": [["\ud83d\udcb2"], "\ue12f", "\udbb9\udce0", ["heavy_dollar_sign"], 17, 35, 63, 0],
        "1f4b3": [["\ud83d\udcb3"], "", "\udbb9\udce1", ["credit_card"], 17, 36, 63, 0],
        "1f4b4": [["\ud83d\udcb4"], "", "\udbb9\udce2", ["yen"], 17, 37, 63, 0],
        "1f4b5": [["\ud83d\udcb5"], "\ue12f", "\udbb9\udce3", ["dollar"], 17, 38, 63, 0],
        "1f4b6": [["\ud83d\udcb6"], "", "", ["euro"], 17, 39, 63, 0],
        "1f4b7": [["\ud83d\udcb7"], "", "", ["pound"], 17, 40, 63, 0],
        "1f4b8": [["\ud83d\udcb8"], "", "\udbb9\udce4", ["money_with_wings"], 17, 41, 63, 0],
        "1f4b9": [["\ud83d\udcb9"], "\ue14a", "\udbb9\udcdf", ["chart"], 17, 42, 63, 0],
        "1f4ba": [["\ud83d\udcba"], "\ue11f", "\udbb9\udd37", ["seat"], 17, 43, 63, 0],
        "1f4bb": [["\ud83d\udcbb"], "\ue00c", "\udbb9\udd38", ["computer"], 17, 44, 63, 0],
        "1f4bc": [["\ud83d\udcbc"], "\ue11e", "\udbb9\udd3b", ["briefcase"], 17, 45, 63, 0],
        "1f4bd": [["\ud83d\udcbd"], "\ue316", "\udbb9\udd3c", ["minidisc"], 17, 46, 63, 0],
        "1f4be": [["\ud83d\udcbe"], "\ue316", "\udbb9\udd3d", ["floppy_disk"], 17, 47, 63, 0],
        "1f4bf": [["\ud83d\udcbf"], "\ue126", "\udbba\udc1d", ["cd"], 17, 48, 63, 0],
        "1f4c0": [["\ud83d\udcc0"], "\ue127", "\udbba\udc1e", ["dvd"], 18, 0, 63, 0],
        "1f4c1": [["\ud83d\udcc1"], "", "\udbb9\udd43", ["file_folder"], 18, 1, 63, 0],
        "1f4c2": [["\ud83d\udcc2"], "", "\udbb9\udd44", ["open_file_folder"], 18, 2, 63, 0],
        "1f4c3": [["\ud83d\udcc3"], "\ue301", "\udbb9\udd40", ["page_with_curl"], 18, 3, 63, 0],
        "1f4c4": [["\ud83d\udcc4"], "\ue301", "\udbb9\udd41", ["page_facing_up"], 18, 4, 63, 0],
        "1f4c5": [["\ud83d\udcc5"], "", "\udbb9\udd42", ["date"], 18, 5, 63, 0],
        "1f4c6": [["\ud83d\udcc6"], "", "\udbb9\udd49", ["calendar"], 18, 6, 63, 0],
        "1f4c7": [["\ud83d\udcc7"], "\ue148", "\udbb9\udd4d", ["card_index"], 18, 7, 63, 0],
        "1f4c8": [["\ud83d\udcc8"], "\ue14a", "\udbb9\udd4b", ["chart_with_upwards_trend"], 18, 8, 63, 0],
        "1f4c9": [["\ud83d\udcc9"], "", "\udbb9\udd4c", ["chart_with_downwards_trend"], 18, 9, 63, 0],
        "1f4ca": [["\ud83d\udcca"], "\ue14a", "\udbb9\udd4a", ["bar_chart"], 18, 10, 63, 0],
        "1f4cb": [["\ud83d\udccb"], "\ue301", "\udbb9\udd48", ["clipboard"], 18, 11, 63, 0],
        "1f4cc": [["\ud83d\udccc"], "", "\udbb9\udd4e", ["pushpin"], 18, 12, 63, 0],
        "1f4cd": [["\ud83d\udccd"], "", "\udbb9\udd3f", ["round_pushpin"], 18, 13, 63, 0],
        "1f4ce": [["\ud83d\udcce"], "", "\udbb9\udd3a", ["paperclip"], 18, 14, 63, 0],
        "1f4cf": [["\ud83d\udccf"], "", "\udbb9\udd50", ["straight_ruler"], 18, 15, 63, 0],
        "1f4d0": [["\ud83d\udcd0"], "", "\udbb9\udd51", ["triangular_ruler"], 18, 16, 63, 0],
        "1f4d1": [["\ud83d\udcd1"], "\ue301", "\udbb9\udd52", ["bookmark_tabs"], 18, 17, 63, 0],
        "1f4d2": [["\ud83d\udcd2"], "\ue148", "\udbb9\udd4f", ["ledger"], 18, 18, 63, 0],
        "1f4d3": [["\ud83d\udcd3"], "\ue148", "\udbb9\udd45", ["notebook"], 18, 19, 63, 0],
        "1f4d4": [["\ud83d\udcd4"], "\ue148", "\udbb9\udd47", ["notebook_with_decorative_cover"], 18, 20, 63, 0],
        "1f4d5": [["\ud83d\udcd5"], "\ue148", "\udbb9\udd02", ["closed_book"], 18, 21, 63, 0],
        "1f4d6": [["\ud83d\udcd6"], "\ue148", "\udbb9\udd46", ["book", "open_book"], 18, 22, 63, 0],
        "1f4d7": [["\ud83d\udcd7"], "\ue148", "\udbb9\udcff", ["green_book"], 18, 23, 63, 0],
        "1f4d8": [["\ud83d\udcd8"], "\ue148", "\udbb9\udd00", ["blue_book"], 18, 24, 63, 0],
        "1f4d9": [["\ud83d\udcd9"], "\ue148", "\udbb9\udd01", ["orange_book"], 18, 25, 63, 0],
        "1f4da": [["\ud83d\udcda"], "\ue148", "\udbb9\udd03", ["books"], 18, 26, 63, 0],
        "1f4db": [["\ud83d\udcdb"], "", "\udbb9\udd04", ["name_badge"], 18, 27, 63, 0],
        "1f4dc": [["\ud83d\udcdc"], "", "\udbb9\udcfd", ["scroll"], 18, 28, 63, 0],
        "1f4dd": [["\ud83d\udcdd"], "\ue301", "\udbb9\udd27", ["memo", "pencil"], 18, 29, 63, 0],
        "1f4de": [["\ud83d\udcde"], "\ue009", "\udbb9\udd24", ["telephone_receiver"], 18, 30, 63, 0],
        "1f4df": [["\ud83d\udcdf"], "", "\udbb9\udd22", ["pager"], 18, 31, 63, 0],
        "1f4e0": [["\ud83d\udce0"], "\ue00b", "\udbb9\udd28", ["fax"], 18, 32, 63, 0],
        "1f4e1": [["\ud83d\udce1"], "\ue14b", "\udbb9\udd31", ["satellite_antenna"], 18, 33, 63, 0],
        "1f4e2": [["\ud83d\udce2"], "\ue142", "\udbb9\udd2f", ["loudspeaker"], 18, 34, 63, 0],
        "1f4e3": [["\ud83d\udce3"], "\ue317", "\udbb9\udd30", ["mega"], 18, 35, 63, 0],
        "1f4e4": [["\ud83d\udce4"], "", "\udbb9\udd33", ["outbox_tray"], 18, 36, 63, 0],
        "1f4e5": [["\ud83d\udce5"], "", "\udbb9\udd34", ["inbox_tray"], 18, 37, 63, 0],
        "1f4e6": [["\ud83d\udce6"], "\ue112", "\udbb9\udd35", ["package"], 18, 38, 63, 0],
        "1f4e7": [["\ud83d\udce7"], "\ue103", "\udbba\udf92", ["e-mail"], 18, 39, 63, 0],
        "1f4e8": [["\ud83d\udce8"], "\ue103", "\udbb9\udd2a", ["incoming_envelope"], 18, 40, 63, 0],
        "1f4e9": [["\ud83d\udce9"], "\ue103", "\udbb9\udd2b", ["envelope_with_arrow"], 18, 41, 63, 0],
        "1f4ea": [["\ud83d\udcea"], "\ue101", "\udbb9\udd2c", ["mailbox_closed"], 18, 42, 63, 0],
        "1f4eb": [["\ud83d\udceb"], "\ue101", "\udbb9\udd2d", ["mailbox"], 18, 43, 63, 0],
        "1f4ec": [["\ud83d\udcec"], "", "", ["mailbox_with_mail"], 18, 44, 63, 0],
        "1f4ed": [["\ud83d\udced"], "", "", ["mailbox_with_no_mail"], 18, 45, 63, 0],
        "1f4ee": [["\ud83d\udcee"], "\ue102", "\udbb9\udd2e", ["postbox"], 18, 46, 63, 0],
        "1f4ef": [["\ud83d\udcef"], "", "", ["postal_horn"], 18, 47, 63, 0],
        "1f4f0": [["\ud83d\udcf0"], "", "\udbba\udc22", ["newspaper"], 18, 48, 63, 0],
        "1f4f1": [["\ud83d\udcf1"], "\ue00a", "\udbb9\udd25", ["iphone"], 19, 0, 63, 0],
        "1f4f2": [["\ud83d\udcf2"], "\ue104", "\udbb9\udd26", ["calling"], 19, 1, 63, 0],
        "1f4f3": [["\ud83d\udcf3"], "\ue250", "\udbba\udc39", ["vibration_mode"], 19, 2, 63, 0],
        "1f4f4": [["\ud83d\udcf4"], "\ue251", "\udbba\udc3a", ["mobile_phone_off"], 19, 3, 63, 0],
        "1f4f5": [["\ud83d\udcf5"], "", "", ["no_mobile_phones"], 19, 4, 63, 0],
        "1f4f6": [["\ud83d\udcf6"], "\ue20b", "\udbba\udc38", ["signal_strength"], 19, 5, 63, 0],
        "1f4f7": [["\ud83d\udcf7"], "\ue008", "\udbb9\udcef", ["camera"], 19, 6, 63, 0],
        "1f4f8": [["\ud83d\udcf8"], "", "", ["camera_with_flash"], 19, 7, 31, 0],
        "1f4f9": [["\ud83d\udcf9"], "\ue03d", "\udbb9\udcf9", ["video_camera"], 19, 8, 63, 0],
        "1f4fa": [["\ud83d\udcfa"], "\ue12a", "\udbba\udc1c", ["tv"], 19, 9, 63, 0],
        "1f4fb": [["\ud83d\udcfb"], "\ue128", "\udbba\udc1f", ["radio"], 19, 10, 63, 0],
        "1f4fc": [["\ud83d\udcfc"], "\ue129", "\udbba\udc20", ["vhs"], 19, 11, 63, 0],
        "1f4fd": [["\ud83d\udcfd"], "", "", ["film_projector"], 19, 12, 31, 0],
        "1f4ff": [["\ud83d\udcff"], "", "", ["prayer_beads"], 19, 13, 31, 0],
        "1f500": [["\ud83d\udd00"], "", "", ["twisted_rightwards_arrows"], 19, 14, 63, 0],
        "1f501": [["\ud83d\udd01"], "", "", ["repeat"], 19, 15, 63, 0],
        "1f502": [["\ud83d\udd02"], "", "", ["repeat_one"], 19, 16, 63, 0],
        "1f503": [["\ud83d\udd03"], "", "\udbba\udf91", ["arrows_clockwise"], 19, 17, 63, 0],
        "1f504": [["\ud83d\udd04"], "", "", ["arrows_counterclockwise"], 19, 18, 63, 0],
        "1f505": [["\ud83d\udd05"], "", "", ["low_brightness"], 19, 19, 63, 0],
        "1f506": [["\ud83d\udd06"], "", "", ["high_brightness"], 19, 20, 63, 0],
        "1f507": [["\ud83d\udd07"], "", "", ["mute"], 19, 21, 63, 0],
        "1f508": [["\ud83d\udd08"], "", "", ["speaker"], 19, 22, 63, 0],
        "1f509": [["\ud83d\udd09"], "", "", ["sound"], 19, 23, 63, 0],
        "1f50a": [["\ud83d\udd0a"], "\ue141", "\udbba\udc21", ["loud_sound"], 19, 24, 63, 0],
        "1f50b": [["\ud83d\udd0b"], "", "\udbb9\udcfc", ["battery"], 19, 25, 63, 0],
        "1f50c": [["\ud83d\udd0c"], "", "\udbb9\udcfe", ["electric_plug"], 19, 26, 63, 0],
        "1f50d": [["\ud83d\udd0d"], "\ue114", "\udbba\udf85", ["mag"], 19, 27, 63, 0],
        "1f50e": [["\ud83d\udd0e"], "\ue114", "\udbba\udf8d", ["mag_right"], 19, 28, 63, 0],
        "1f50f": [["\ud83d\udd0f"], "\ue144", "\udbba\udf90", ["lock_with_ink_pen"], 19, 29, 63, 0],
        "1f510": [["\ud83d\udd10"], "\ue144", "\udbba\udf8a", ["closed_lock_with_key"], 19, 30, 63, 0],
        "1f511": [["\ud83d\udd11"], "\ue03f", "\udbba\udf82", ["key"], 19, 31, 63, 0],
        "1f512": [["\ud83d\udd12"], "\ue144", "\udbba\udf86", ["lock"], 19, 32, 63, 0],
        "1f513": [["\ud83d\udd13"], "\ue145", "\udbba\udf87", ["unlock"], 19, 33, 63, 0],
        "1f514": [["\ud83d\udd14"], "\ue325", "\udbb9\udcf2", ["bell"], 19, 34, 63, 0],
        "1f515": [["\ud83d\udd15"], "", "", ["no_bell"], 19, 35, 63, 0],
        "1f516": [["\ud83d\udd16"], "", "\udbba\udf8f", ["bookmark"], 19, 36, 63, 0],
        "1f517": [["\ud83d\udd17"], "", "\udbba\udf4b", ["link"], 19, 37, 63, 0],
        "1f518": [["\ud83d\udd18"], "", "\udbba\udf8c", ["radio_button"], 19, 38, 63, 0],
        "1f519": [["\ud83d\udd19"], "\ue235", "\udbba\udf8e", ["back"], 19, 39, 63, 0],
        "1f51a": [["\ud83d\udd1a"], "", "\udbb8\udc1a", ["end"], 19, 40, 63, 0],
        "1f51b": [["\ud83d\udd1b"], "", "\udbb8\udc19", ["on"], 19, 41, 63, 0],
        "1f51c": [["\ud83d\udd1c"], "", "\udbb8\udc18", ["soon"], 19, 42, 63, 0],
        "1f51d": [["\ud83d\udd1d"], "\ue24c", "\udbba\udf42", ["top"], 19, 43, 63, 0],
        "1f51e": [["\ud83d\udd1e"], "\ue207", "\udbba\udf25", ["underage"], 19, 44, 63, 0],
        "1f51f": [["\ud83d\udd1f"], "", "\udbba\udc3b", ["keycap_ten"], 19, 45, 63, 0],
        "1f520": [["\ud83d\udd20"], "", "\udbba\udf7c", ["capital_abcd"], 19, 46, 63, 0],
        "1f521": [["\ud83d\udd21"], "", "\udbba\udf7d", ["abcd"], 19, 47, 63, 0],
        "1f522": [["\ud83d\udd22"], "", "\udbba\udf7e", ["1234"], 19, 48, 63, 0],
        "1f523": [["\ud83d\udd23"], "", "\udbba\udf7f", ["symbols"], 20, 0, 63, 0],
        "1f524": [["\ud83d\udd24"], "", "\udbba\udf80", ["abc"], 20, 1, 63, 0],
        "1f525": [["\ud83d\udd25"], "\ue11d", "\udbb9\udcf6", ["fire"], 20, 2, 63, 0],
        "1f526": [["\ud83d\udd26"], "", "\udbb9\udcfb", ["flashlight"], 20, 3, 63, 0],
        "1f527": [["\ud83d\udd27"], "", "\udbb9\udcc9", ["wrench"], 20, 4, 63, 0],
        "1f528": [["\ud83d\udd28"], "\ue116", "\udbb9\udcca", ["hammer"], 20, 5, 63, 0],
        "1f529": [["\ud83d\udd29"], "", "\udbb9\udccb", ["nut_and_bolt"], 20, 6, 63, 0],
        "1f52a": [["\ud83d\udd2a"], "", "\udbb9\udcfa", ["hocho", "knife"], 20, 7, 63, 0],
        "1f52b": [["\ud83d\udd2b"], "\ue113", "\udbb9\udcf5", ["gun"], 20, 8, 63, 0],
        "1f52c": [["\ud83d\udd2c"], "", "", ["microscope"], 20, 9, 63, 0],
        "1f52d": [["\ud83d\udd2d"], "", "", ["telescope"], 20, 10, 63, 0],
        "1f52e": [["\ud83d\udd2e"], "\ue23e", "\udbb9\udcf7", ["crystal_ball"], 20, 11, 63, 0],
        "1f52f": [["\ud83d\udd2f"], "\ue23e", "\udbb9\udcf8", ["six_pointed_star"], 20, 12, 63, 0],
        "1f530": [["\ud83d\udd30"], "\ue209", "\udbb8\udc44", ["beginner"], 20, 13, 63, 0],
        "1f531": [["\ud83d\udd31"], "\ue031", "\udbb9\udcd2", ["trident"], 20, 14, 63, 0],
        "1f532": [["\ud83d\udd32"], "\ue21a", "\udbba\udf64", ["black_square_button"], 20, 15, 63, 0],
        "1f533": [["\ud83d\udd33"], "\ue21b", "\udbba\udf67", ["white_square_button"], 20, 16, 63, 0],
        "1f534": [["\ud83d\udd34"], "\ue219", "\udbba\udf63", ["red_circle"], 20, 17, 63, 0],
        "1f535": [["\ud83d\udd35"], "\ue21a", "\udbba\udf64", ["large_blue_circle"], 20, 18, 63, 0],
        "1f536": [["\ud83d\udd36"], "\ue21b", "\udbba\udf73", ["large_orange_diamond"], 20, 19, 63, 0],
        "1f537": [["\ud83d\udd37"], "\ue21b", "\udbba\udf74", ["large_blue_diamond"], 20, 20, 63, 0],
        "1f538": [["\ud83d\udd38"], "\ue21b", "\udbba\udf75", ["small_orange_diamond"], 20, 21, 63, 0],
        "1f539": [["\ud83d\udd39"], "\ue21b", "\udbba\udf76", ["small_blue_diamond"], 20, 22, 63, 0],
        "1f53a": [["\ud83d\udd3a"], "", "\udbba\udf78", ["small_red_triangle"], 20, 23, 63, 0],
        "1f53b": [["\ud83d\udd3b"], "", "\udbba\udf79", ["small_red_triangle_down"], 20, 24, 63, 0],
        "1f53c": [["\ud83d\udd3c"], "", "\udbba\udf01", ["arrow_up_small"], 20, 25, 63, 0],
        "1f53d": [["\ud83d\udd3d"], "", "\udbba\udf00", ["arrow_down_small"], 20, 26, 63, 0],
        "1f549": [["\ud83d\udd49"], "", "", ["om_symbol"], 20, 27, 31, 0],
        "1f54a": [["\ud83d\udd4a"], "", "", ["dove_of_peace"], 20, 28, 31, 0],
        "1f54b": [["\ud83d\udd4b"], "", "", ["kaaba"], 20, 29, 31, 0],
        "1f54c": [["\ud83d\udd4c"], "", "", ["mosque"], 20, 30, 31, 0],
        "1f54d": [["\ud83d\udd4d"], "", "", ["synagogue"], 20, 31, 31, 0],
        "1f54e": [["\ud83d\udd4e"], "", "", ["menorah_with_nine_branches"], 20, 32, 31, 0],
        "1f550": [["\ud83d\udd50"], "\ue024", "\udbb8\udc1e", ["clock1"], 20, 33, 63, 0],
        "1f551": [["\ud83d\udd51"], "\ue025", "\udbb8\udc1f", ["clock2"], 20, 34, 63, 0],
        "1f552": [["\ud83d\udd52"], "\ue026", "\udbb8\udc20", ["clock3"], 20, 35, 63, 0],
        "1f553": [["\ud83d\udd53"], "\ue027", "\udbb8\udc21", ["clock4"], 20, 36, 63, 0],
        "1f554": [["\ud83d\udd54"], "\ue028", "\udbb8\udc22", ["clock5"], 20, 37, 63, 0],
        "1f555": [["\ud83d\udd55"], "\ue029", "\udbb8\udc23", ["clock6"], 20, 38, 63, 0],
        "1f556": [["\ud83d\udd56"], "\ue02a", "\udbb8\udc24", ["clock7"], 20, 39, 63, 0],
        "1f557": [["\ud83d\udd57"], "\ue02b", "\udbb8\udc25", ["clock8"], 20, 40, 63, 0],
        "1f558": [["\ud83d\udd58"], "\ue02c", "\udbb8\udc26", ["clock9"], 20, 41, 63, 0],
        "1f559": [["\ud83d\udd59"], "\ue02d", "\udbb8\udc27", ["clock10"], 20, 42, 63, 0],
        "1f55a": [["\ud83d\udd5a"], "\ue02e", "\udbb8\udc28", ["clock11"], 20, 43, 63, 0],
        "1f55b": [["\ud83d\udd5b"], "\ue02f", "\udbb8\udc29", ["clock12"], 20, 44, 63, 0],
        "1f55c": [["\ud83d\udd5c"], "", "", ["clock130"], 20, 45, 63, 0],
        "1f55d": [["\ud83d\udd5d"], "", "", ["clock230"], 20, 46, 63, 0],
        "1f55e": [["\ud83d\udd5e"], "", "", ["clock330"], 20, 47, 63, 0],
        "1f55f": [["\ud83d\udd5f"], "", "", ["clock430"], 20, 48, 63, 0],
        "1f560": [["\ud83d\udd60"], "", "", ["clock530"], 21, 0, 63, 0],
        "1f561": [["\ud83d\udd61"], "", "", ["clock630"], 21, 1, 63, 0],
        "1f562": [["\ud83d\udd62"], "", "", ["clock730"], 21, 2, 63, 0],
        "1f563": [["\ud83d\udd63"], "", "", ["clock830"], 21, 3, 63, 0],
        "1f564": [["\ud83d\udd64"], "", "", ["clock930"], 21, 4, 63, 0],
        "1f565": [["\ud83d\udd65"], "", "", ["clock1030"], 21, 5, 63, 0],
        "1f566": [["\ud83d\udd66"], "", "", ["clock1130"], 21, 6, 63, 0],
        "1f567": [["\ud83d\udd67"], "", "", ["clock1230"], 21, 7, 63, 0],
        "1f56f": [["\ud83d\udd6f"], "", "", ["candle"], 21, 8, 31, 0],
        "1f570": [["\ud83d\udd70"], "", "", ["mantelpiece_clock"], 21, 9, 31, 0],
        "1f573": [["\ud83d\udd73"], "", "", ["hole"], 21, 10, 31, 0],
        "1f574": [["\ud83d\udd74"], "", "", ["man_in_business_suit_levitating"], 21, 11, 31, 0],
        "1f576": [["\ud83d\udd76"], "", "", ["dark_sunglasses"], 21, 23, 31, 0],
        "1f577": [["\ud83d\udd77"], "", "", ["spider"], 21, 24, 31, 0],
        "1f578": [["\ud83d\udd78"], "", "", ["spider_web"], 21, 25, 31, 0],
        "1f579": [["\ud83d\udd79"], "", "", ["joystick"], 21, 26, 31, 0],
        "1f57a": [["\ud83d\udd7a"], "", "", ["man_dancing"], 21, 27, 31, 0],
        "1f587": [["\ud83d\udd87"], "", "", ["linked_paperclips"], 21, 33, 31, 0],
        "1f58a": [["\ud83d\udd8a"], "", "", ["lower_left_ballpoint_pen"], 21, 34, 31, 0],
        "1f58b": [["\ud83d\udd8b"], "", "", ["lower_left_fountain_pen"], 21, 35, 31, 0],
        "1f58c": [["\ud83d\udd8c"], "", "", ["lower_left_paintbrush"], 21, 36, 31, 0],
        "1f58d": [["\ud83d\udd8d"], "", "", ["lower_left_crayon"], 21, 37, 31, 0],
        "1f590": [["\ud83d\udd90"], "", "", ["raised_hand_with_fingers_splayed"], 21, 38, 31, 0],
        "1f595": [["\ud83d\udd95"], "", "", ["middle_finger", "reversed_hand_with_middle_finger_extended"], 21, 44, 31, 0],
        "1f596": [["\ud83d\udd96"], "", "", ["spock-hand"], 22, 1, 31, 0],
        "1f5a4": [["\ud83d\udda4"], "", "", ["black_heart"], 22, 7, 31, 0],
        "1f5a5": [["\ud83d\udda5"], "", "", ["desktop_computer"], 22, 8, 31, 0],
        "1f5a8": [["\ud83d\udda8"], "", "", ["printer"], 22, 9, 31, 0],
        "1f5b1": [["\ud83d\uddb1"], "", "", ["three_button_mouse"], 22, 10, 31, 0],
        "1f5b2": [["\ud83d\uddb2"], "", "", ["trackball"], 22, 11, 31, 0],
        "1f5bc": [["\ud83d\uddbc"], "", "", ["frame_with_picture"], 22, 12, 31, 0],
        "1f5c2": [["\ud83d\uddc2"], "", "", ["card_index_dividers"], 22, 13, 31, 0],
        "1f5c3": [["\ud83d\uddc3"], "", "", ["card_file_box"], 22, 14, 31, 0],
        "1f5c4": [["\ud83d\uddc4"], "", "", ["file_cabinet"], 22, 15, 31, 0],
        "1f5d1": [["\ud83d\uddd1"], "", "", ["wastebasket"], 22, 16, 31, 0],
        "1f5d2": [["\ud83d\uddd2"], "", "", ["spiral_note_pad"], 22, 17, 31, 0],
        "1f5d3": [["\ud83d\uddd3"], "", "", ["spiral_calendar_pad"], 22, 18, 31, 0],
        "1f5dc": [["\ud83d\udddc"], "", "", ["compression"], 22, 19, 31, 0],
        "1f5dd": [["\ud83d\udddd"], "", "", ["old_key"], 22, 20, 31, 0],
        "1f5de": [["\ud83d\uddde"], "", "", ["rolled_up_newspaper"], 22, 21, 31, 0],
        "1f5e1": [["\ud83d\udde1"], "", "", ["dagger_knife"], 22, 22, 31, 0],
        "1f5e3": [["\ud83d\udde3"], "", "", ["speaking_head_in_silhouette"], 22, 23, 31, 0],
        "1f5e8": [["\ud83d\udde8"], "", "", ["left_speech_bubble"], 22, 24, 31, 0],
        "1f5ef": [["\ud83d\uddef"], "", "", ["right_anger_bubble"], 22, 25, 31, 0],
        "1f5f3": [["\ud83d\uddf3"], "", "", ["ballot_box_with_ballot"], 22, 26, 31, 0],
        "1f5fa": [["\ud83d\uddfa"], "", "", ["world_map"], 22, 27, 31, 0],
        "1f5fb": [["\ud83d\uddfb"], "\ue03b", "\udbb9\udcc3", ["mount_fuji"], 22, 28, 63, 0],
        "1f5fc": [["\ud83d\uddfc"], "\ue509", "\udbb9\udcc4", ["tokyo_tower"], 22, 29, 63, 0],
        "1f5fd": [["\ud83d\uddfd"], "\ue51d", "\udbb9\udcc6", ["statue_of_liberty"], 22, 30, 63, 0],
        "1f5fe": [["\ud83d\uddfe"], "", "\udbb9\udcc7", ["japan"], 22, 31, 63, 0],
        "1f5ff": [["\ud83d\uddff"], "", "\udbb9\udcc8", ["moyai"], 22, 32, 63, 0],
        "1f600": [["\ud83d\ude00"], "", "", ["grinning"], 22, 33, 63, 0, ":D"],
        "1f601": [["\ud83d\ude01"], "\ue404", "\udbb8\udf33", ["grin"], 22, 34, 63, 0],
        "1f602": [["\ud83d\ude02"], "\ue412", "\udbb8\udf34", ["joy"], 22, 35, 63, 0],
        "1f603": [["\ud83d\ude03"], "\ue057", "\udbb8\udf30", ["smiley"], 22, 36, 63, 0, ":)"],
        "1f604": [["\ud83d\ude04"], "\ue415", "\udbb8\udf38", ["smile"], 22, 37, 63, 0, ":)"],
        "1f605": [["\ud83d\ude05"], "\ue415\ue331", "\udbb8\udf31", ["sweat_smile"], 22, 38, 63, 0],
        "1f606": [["\ud83d\ude06"], "\ue40a", "\udbb8\udf32", ["laughing", "satisfied"], 22, 39, 63, 0],
        "1f607": [["\ud83d\ude07"], "", "", ["innocent"], 22, 40, 63, 0],
        "1f608": [["\ud83d\ude08"], "", "", ["smiling_imp"], 22, 41, 63, 0],
        "1f609": [["\ud83d\ude09"], "\ue405", "\udbb8\udf47", ["wink"], 22, 42, 63, 0, ";)"],
        "1f60a": [["\ud83d\ude0a"], "\ue056", "\udbb8\udf35", ["blush"], 22, 43, 63, 0, ":)"],
        "1f60b": [["\ud83d\ude0b"], "\ue056", "\udbb8\udf2b", ["yum"], 22, 44, 63, 0],
        "1f60c": [["\ud83d\ude0c"], "\ue40a", "\udbb8\udf3e", ["relieved"], 22, 45, 63, 0],
        "1f60d": [["\ud83d\ude0d"], "\ue106", "\udbb8\udf27", ["heart_eyes"], 22, 46, 63, 0],
        "1f60e": [["\ud83d\ude0e"], "", "", ["sunglasses"], 22, 47, 63, 0],
        "1f60f": [["\ud83d\ude0f"], "\ue402", "\udbb8\udf43", ["smirk"], 22, 48, 63, 0],
        "1f610": [["\ud83d\ude10"], "", "", ["neutral_face"], 23, 0, 63, 0],
        "1f611": [["\ud83d\ude11"], "", "", ["expressionless"], 23, 1, 63, 0],
        "1f612": [["\ud83d\ude12"], "\ue40e", "\udbb8\udf26", ["unamused"], 23, 2, 63, 0, ":("],
        "1f613": [["\ud83d\ude13"], "\ue108", "\udbb8\udf44", ["sweat"], 23, 3, 63, 0],
        "1f614": [["\ud83d\ude14"], "\ue403", "\udbb8\udf40", ["pensive"], 23, 4, 63, 0],
        "1f615": [["\ud83d\ude15"], "", "", ["confused"], 23, 5, 63, 0],
        "1f616": [["\ud83d\ude16"], "\ue407", "\udbb8\udf3f", ["confounded"], 23, 6, 63, 0],
        "1f617": [["\ud83d\ude17"], "", "", ["kissing"], 23, 7, 63, 0],
        "1f618": [["\ud83d\ude18"], "\ue418", "\udbb8\udf2c", ["kissing_heart"], 23, 8, 63, 0],
        "1f619": [["\ud83d\ude19"], "", "", ["kissing_smiling_eyes"], 23, 9, 63, 0],
        "1f61a": [["\ud83d\ude1a"], "\ue417", "\udbb8\udf2d", ["kissing_closed_eyes"], 23, 10, 63, 0],
        "1f61b": [["\ud83d\ude1b"], "", "", ["stuck_out_tongue"], 23, 11, 63, 0, ":p"],
        "1f61c": [["\ud83d\ude1c"], "\ue105", "\udbb8\udf29", ["stuck_out_tongue_winking_eye"], 23, 12, 63, 0, ";p"],
        "1f61d": [["\ud83d\ude1d"], "\ue409", "\udbb8\udf2a", ["stuck_out_tongue_closed_eyes"], 23, 13, 63, 0],
        "1f61e": [["\ud83d\ude1e"], "\ue058", "\udbb8\udf23", ["disappointed"], 23, 14, 63, 0, ":("],
        "1f61f": [["\ud83d\ude1f"], "", "", ["worried"], 23, 15, 63, 0],
        "1f620": [["\ud83d\ude20"], "\ue059", "\udbb8\udf20", ["angry"], 23, 16, 63, 0],
        "1f621": [["\ud83d\ude21"], "\ue416", "\udbb8\udf3d", ["rage"], 23, 17, 63, 0],
        "1f622": [["\ud83d\ude22"], "\ue413", "\udbb8\udf39", ["cry"], 23, 18, 63, 0, ":'("],
        "1f623": [["\ud83d\ude23"], "\ue406", "\udbb8\udf3c", ["persevere"], 23, 19, 63, 0],
        "1f624": [["\ud83d\ude24"], "\ue404", "\udbb8\udf28", ["triumph"], 23, 20, 63, 0],
        "1f625": [["\ud83d\ude25"], "\ue401", "\udbb8\udf45", ["disappointed_relieved"], 23, 21, 63, 0],
        "1f626": [["\ud83d\ude26"], "", "", ["frowning"], 23, 22, 63, 0],
        "1f627": [["\ud83d\ude27"], "", "", ["anguished"], 23, 23, 63, 0],
        "1f628": [["\ud83d\ude28"], "\ue40b", "\udbb8\udf3b", ["fearful"], 23, 24, 63, 0],
        "1f629": [["\ud83d\ude29"], "\ue403", "\udbb8\udf21", ["weary"], 23, 25, 63, 0],
        "1f62a": [["\ud83d\ude2a"], "\ue408", "\udbb8\udf42", ["sleepy"], 23, 26, 63, 0],
        "1f62b": [["\ud83d\ude2b"], "\ue406", "\udbb8\udf46", ["tired_face"], 23, 27, 63, 0],
        "1f62c": [["\ud83d\ude2c"], "", "", ["grimacing"], 23, 28, 63, 0],
        "1f62d": [["\ud83d\ude2d"], "\ue411", "\udbb8\udf3a", ["sob"], 23, 29, 63, 0, ":'("],
        "1f62e": [["\ud83d\ude2e"], "", "", ["open_mouth"], 23, 30, 63, 0],
        "1f62f": [["\ud83d\ude2f"], "", "", ["hushed"], 23, 31, 63, 0],
        "1f630": [["\ud83d\ude30"], "\ue40f", "\udbb8\udf25", ["cold_sweat"], 23, 32, 63, 0],
        "1f631": [["\ud83d\ude31"], "\ue107", "\udbb8\udf41", ["scream"], 23, 33, 63, 0],
        "1f632": [["\ud83d\ude32"], "\ue410", "\udbb8\udf22", ["astonished"], 23, 34, 63, 0],
        "1f633": [["\ud83d\ude33"], "\ue40d", "\udbb8\udf2f", ["flushed"], 23, 35, 63, 0],
        "1f634": [["\ud83d\ude34"], "", "", ["sleeping"], 23, 36, 63, 0],
        "1f635": [["\ud83d\ude35"], "\ue406", "\udbb8\udf24", ["dizzy_face"], 23, 37, 63, 0],
        "1f636": [["\ud83d\ude36"], "", "", ["no_mouth"], 23, 38, 63, 0],
        "1f637": [["\ud83d\ude37"], "\ue40c", "\udbb8\udf2e", ["mask"], 23, 39, 63, 0],
        "1f638": [["\ud83d\ude38"], "\ue404", "\udbb8\udf49", ["smile_cat"], 23, 40, 63, 0],
        "1f639": [["\ud83d\ude39"], "\ue412", "\udbb8\udf4a", ["joy_cat"], 23, 41, 63, 0],
        "1f63a": [["\ud83d\ude3a"], "\ue057", "\udbb8\udf48", ["smiley_cat"], 23, 42, 63, 0],
        "1f63b": [["\ud83d\ude3b"], "\ue106", "\udbb8\udf4c", ["heart_eyes_cat"], 23, 43, 63, 0],
        "1f63c": [["\ud83d\ude3c"], "\ue404", "\udbb8\udf4f", ["smirk_cat"], 23, 44, 63, 0],
        "1f63d": [["\ud83d\ude3d"], "\ue418", "\udbb8\udf4b", ["kissing_cat"], 23, 45, 63, 0],
        "1f63e": [["\ud83d\ude3e"], "\ue416", "\udbb8\udf4e", ["pouting_cat"], 23, 46, 63, 0],
        "1f63f": [["\ud83d\ude3f"], "\ue413", "\udbb8\udf4d", ["crying_cat_face"], 23, 47, 63, 0],
        "1f640": [["\ud83d\ude40"], "\ue403", "\udbb8\udf50", ["scream_cat"], 23, 48, 63, 0],
        "1f641": [["\ud83d\ude41"], "", "", ["slightly_frowning_face"], 24, 0, 31, 0],
        "1f642": [["\ud83d\ude42"], "", "", ["slightly_smiling_face"], 24, 1, 63, 0],
        "1f643": [["\ud83d\ude43"], "", "", ["upside_down_face"], 24, 2, 31, 0],
        "1f644": [["\ud83d\ude44"], "", "", ["face_with_rolling_eyes"], 24, 3, 31, 0],
        "1f648": [["\ud83d\ude48"], "", "\udbb8\udf54", ["see_no_evil"], 24, 22, 63, 0],
        "1f649": [["\ud83d\ude49"], "", "\udbb8\udf56", ["hear_no_evil"], 24, 23, 63, 0],
        "1f64a": [["\ud83d\ude4a"], "", "\udbb8\udf55", ["speak_no_evil"], 24, 24, 63, 0],
        "1f64c": [["\ud83d\ude4c"], "\ue427", "\udbb8\udf58", ["raised_hands"], 24, 31, 63, 0],
        "1f64f": [["\ud83d\ude4f"], "\ue41d", "\udbb8\udf5b", ["pray"], 25, 0, 63, 0],
        "1f680": [["\ud83d\ude80"], "\ue10d", "\udbb9\udfed", ["rocket"], 25, 6, 63, 0],
        "1f681": [["\ud83d\ude81"], "", "", ["helicopter"], 25, 7, 63, 0],
        "1f682": [["\ud83d\ude82"], "", "", ["steam_locomotive"], 25, 8, 63, 0],
        "1f683": [["\ud83d\ude83"], "\ue01e", "\udbb9\udfdf", ["railway_car"], 25, 9, 63, 0],
        "1f684": [["\ud83d\ude84"], "\ue435", "\udbb9\udfe2", ["bullettrain_side"], 25, 10, 63, 0],
        "1f685": [["\ud83d\ude85"], "\ue01f", "\udbb9\udfe3", ["bullettrain_front"], 25, 11, 63, 0],
        "1f686": [["\ud83d\ude86"], "", "", ["train2"], 25, 12, 63, 0],
        "1f687": [["\ud83d\ude87"], "\ue434", "\udbb9\udfe0", ["metro"], 25, 13, 63, 0],
        "1f688": [["\ud83d\ude88"], "", "", ["light_rail"], 25, 14, 63, 0],
        "1f689": [["\ud83d\ude89"], "\ue039", "\udbb9\udfec", ["station"], 25, 15, 63, 0],
        "1f68a": [["\ud83d\ude8a"], "", "", ["tram"], 25, 16, 63, 0],
        "1f68b": [["\ud83d\ude8b"], "", "", ["train"], 25, 17, 63, 0],
        "1f68c": [["\ud83d\ude8c"], "\ue159", "\udbb9\udfe6", ["bus"], 25, 18, 63, 0],
        "1f68d": [["\ud83d\ude8d"], "", "", ["oncoming_bus"], 25, 19, 63, 0],
        "1f68e": [["\ud83d\ude8e"], "", "", ["trolleybus"], 25, 20, 63, 0],
        "1f68f": [["\ud83d\ude8f"], "\ue150", "\udbb9\udfe7", ["busstop"], 25, 21, 63, 0],
        "1f690": [["\ud83d\ude90"], "", "", ["minibus"], 25, 22, 63, 0],
        "1f691": [["\ud83d\ude91"], "\ue431", "\udbb9\udff3", ["ambulance"], 25, 23, 63, 0],
        "1f692": [["\ud83d\ude92"], "\ue430", "\udbb9\udff2", ["fire_engine"], 25, 24, 63, 0],
        "1f693": [["\ud83d\ude93"], "\ue432", "\udbb9\udff4", ["police_car"], 25, 25, 63, 0],
        "1f694": [["\ud83d\ude94"], "", "", ["oncoming_police_car"], 25, 26, 63, 0],
        "1f695": [["\ud83d\ude95"], "\ue15a", "\udbb9\udfef", ["taxi"], 25, 27, 63, 0],
        "1f696": [["\ud83d\ude96"], "", "", ["oncoming_taxi"], 25, 28, 63, 0],
        "1f697": [["\ud83d\ude97"], "\ue01b", "\udbb9\udfe4", ["car", "red_car"], 25, 29, 63, 0],
        "1f698": [["\ud83d\ude98"], "", "", ["oncoming_automobile"], 25, 30, 63, 0],
        "1f699": [["\ud83d\ude99"], "\ue42e", "\udbb9\udfe5", ["blue_car"], 25, 31, 63, 0],
        "1f69a": [["\ud83d\ude9a"], "\ue42f", "\udbb9\udff1", ["truck"], 25, 32, 63, 0],
        "1f69b": [["\ud83d\ude9b"], "", "", ["articulated_lorry"], 25, 33, 63, 0],
        "1f69c": [["\ud83d\ude9c"], "", "", ["tractor"], 25, 34, 63, 0],
        "1f69d": [["\ud83d\ude9d"], "", "", ["monorail"], 25, 35, 63, 0],
        "1f69e": [["\ud83d\ude9e"], "", "", ["mountain_railway"], 25, 36, 63, 0],
        "1f69f": [["\ud83d\ude9f"], "", "", ["suspension_railway"], 25, 37, 63, 0],
        "1f6a0": [["\ud83d\udea0"], "", "", ["mountain_cableway"], 25, 38, 63, 0],
        "1f6a1": [["\ud83d\udea1"], "", "", ["aerial_tramway"], 25, 39, 63, 0],
        "1f6a2": [["\ud83d\udea2"], "\ue202", "\udbb9\udfe8", ["ship"], 25, 40, 63, 0],
        "1f6a4": [["\ud83d\udea4"], "\ue135", "\udbb9\udfee", ["speedboat"], 25, 47, 63, 0],
        "1f6a5": [["\ud83d\udea5"], "\ue14e", "\udbb9\udff7", ["traffic_light"], 25, 48, 63, 0],
        "1f6a6": [["\ud83d\udea6"], "", "", ["vertical_traffic_light"], 26, 0, 63, 0],
        "1f6a7": [["\ud83d\udea7"], "\ue137", "\udbb9\udff8", ["construction"], 26, 1, 63, 0],
        "1f6a8": [["\ud83d\udea8"], "\ue432", "\udbb9\udff9", ["rotating_light"], 26, 2, 63, 0],
        "1f6a9": [["\ud83d\udea9"], "", "\udbba\udf22", ["triangular_flag_on_post"], 26, 3, 63, 0],
        "1f6aa": [["\ud83d\udeaa"], "", "\udbb9\udcf3", ["door"], 26, 4, 63, 0],
        "1f6ab": [["\ud83d\udeab"], "", "\udbba\udf48", ["no_entry_sign"], 26, 5, 63, 0],
        "1f6ac": [["\ud83d\udeac"], "\ue30e", "\udbba\udf1e", ["smoking"], 26, 6, 63, 0],
        "1f6ad": [["\ud83d\udead"], "\ue208", "\udbba\udf1f", ["no_smoking"], 26, 7, 63, 0],
        "1f6ae": [["\ud83d\udeae"], "", "", ["put_litter_in_its_place"], 26, 8, 63, 0],
        "1f6af": [["\ud83d\udeaf"], "", "", ["do_not_litter"], 26, 9, 63, 0],
        "1f6b0": [["\ud83d\udeb0"], "", "", ["potable_water"], 26, 10, 63, 0],
        "1f6b1": [["\ud83d\udeb1"], "", "", ["non-potable_water"], 26, 11, 63, 0],
        "1f6b2": [["\ud83d\udeb2"], "\ue136", "\udbb9\udfeb", ["bike"], 26, 12, 63, 0],
        "1f6b3": [["\ud83d\udeb3"], "", "", ["no_bicycles"], 26, 13, 63, 0],
        "1f6b7": [["\ud83d\udeb7"], "", "", ["no_pedestrians"], 26, 32, 63, 0],
        "1f6b8": [["\ud83d\udeb8"], "", "", ["children_crossing"], 26, 33, 63, 0],
        "1f6b9": [["\ud83d\udeb9"], "\ue138", "\udbba\udf33", ["mens"], 26, 34, 63, 0],
        "1f6ba": [["\ud83d\udeba"], "\ue139", "\udbba\udf34", ["womens"], 26, 35, 63, 0],
        "1f6bb": [["\ud83d\udebb"], "\ue151", "\udbb9\udd06", ["restroom"], 26, 36, 63, 0],
        "1f6bc": [["\ud83d\udebc"], "\ue13a", "\udbba\udf35", ["baby_symbol"], 26, 37, 63, 0],
        "1f6bd": [["\ud83d\udebd"], "\ue140", "\udbb9\udd07", ["toilet"], 26, 38, 63, 0],
        "1f6be": [["\ud83d\udebe"], "\ue309", "\udbb9\udd08", ["wc"], 26, 39, 63, 0],
        "1f6bf": [["\ud83d\udebf"], "", "", ["shower"], 26, 40, 63, 0],
        "1f6c0": [["\ud83d\udec0"], "\ue13f", "\udbb9\udd05", ["bath"], 26, 41, 63, 0],
        "1f6c1": [["\ud83d\udec1"], "", "", ["bathtub"], 26, 47, 63, 0],
        "1f6c2": [["\ud83d\udec2"], "", "", ["passport_control"], 26, 48, 63, 0],
        "1f6c3": [["\ud83d\udec3"], "", "", ["customs"], 27, 0, 63, 0],
        "1f6c4": [["\ud83d\udec4"], "", "", ["baggage_claim"], 27, 1, 63, 0],
        "1f6c5": [["\ud83d\udec5"], "", "", ["left_luggage"], 27, 2, 63, 0],
        "1f6cb": [["\ud83d\udecb"], "", "", ["couch_and_lamp"], 27, 3, 31, 0],
        "1f6cc": [["\ud83d\udecc"], "", "", ["sleeping_accommodation"], 27, 4, 31, 0],
        "1f6cd": [["\ud83d\udecd"], "", "", ["shopping_bags"], 27, 10, 31, 0],
        "1f6ce": [["\ud83d\udece"], "", "", ["bellhop_bell"], 27, 11, 31, 0],
        "1f6cf": [["\ud83d\udecf"], "", "", ["bed"], 27, 12, 31, 0],
        "1f6d0": [["\ud83d\uded0"], "", "", ["place_of_worship"], 27, 13, 31, 0],
        "1f6d1": [["\ud83d\uded1"], "", "", ["octagonal_sign"], 27, 14, 31, 0],
        "1f6d2": [["\ud83d\uded2"], "", "", ["shopping_trolley"], 27, 15, 31, 0],
        "1f6e0": [["\ud83d\udee0"], "", "", ["hammer_and_wrench"], 27, 16, 31, 0],
        "1f6e1": [["\ud83d\udee1"], "", "", ["shield"], 27, 17, 31, 0],
        "1f6e2": [["\ud83d\udee2"], "", "", ["oil_drum"], 27, 18, 31, 0],
        "1f6e3": [["\ud83d\udee3"], "", "", ["motorway"], 27, 19, 31, 0],
        "1f6e4": [["\ud83d\udee4"], "", "", ["railway_track"], 27, 20, 31, 0],
        "1f6e5": [["\ud83d\udee5"], "", "", ["motor_boat"], 27, 21, 31, 0],
        "1f6e9": [["\ud83d\udee9"], "", "", ["small_airplane"], 27, 22, 31, 0],
        "1f6eb": [["\ud83d\udeeb"], "", "", ["airplane_departure"], 27, 23, 31, 0],
        "1f6ec": [["\ud83d\udeec"], "", "", ["airplane_arriving"], 27, 24, 31, 0],
        "1f6f0": [["\ud83d\udef0"], "", "", ["satellite"], 27, 25, 31, 0],
        "1f6f3": [["\ud83d\udef3"], "", "", ["passenger_ship"], 27, 26, 31, 0],
        "1f6f4": [["\ud83d\udef4"], "", "", ["scooter"], 27, 27, 31, 0],
        "1f6f5": [["\ud83d\udef5"], "", "", ["motor_scooter"], 27, 28, 31, 0],
        "1f6f6": [["\ud83d\udef6"], "", "", ["canoe"], 27, 29, 31, 0],
        "1f910": [["\ud83e\udd10"], "", "", ["zipper_mouth_face"], 27, 30, 31, 0],
        "1f911": [["\ud83e\udd11"], "", "", ["money_mouth_face"], 27, 31, 31, 0],
        "1f912": [["\ud83e\udd12"], "", "", ["face_with_thermometer"], 27, 32, 31, 0],
        "1f913": [["\ud83e\udd13"], "", "", ["nerd_face"], 27, 33, 31, 0],
        "1f914": [["\ud83e\udd14"], "", "", ["thinking_face"], 27, 34, 31, 0],
        "1f915": [["\ud83e\udd15"], "", "", ["face_with_head_bandage"], 27, 35, 31, 0],
        "1f916": [["\ud83e\udd16"], "", "", ["robot_face"], 27, 36, 31, 0],
        "1f917": [["\ud83e\udd17"], "", "", ["hugging_face"], 27, 37, 31, 0],
        "1f918": [["\ud83e\udd18"], "", "", ["the_horns", "sign_of_the_horns"], 27, 38, 31, 0],
        "1f919": [["\ud83e\udd19"], "", "", ["call_me_hand"], 27, 44, 31, 0],
        "1f91a": [["\ud83e\udd1a"], "", "", ["raised_back_of_hand"], 28, 1, 31, 0],
        "1f91b": [["\ud83e\udd1b"], "", "", ["left-facing_fist"], 28, 7, 31, 0],
        "1f91c": [["\ud83e\udd1c"], "", "", ["right-facing_fist"], 28, 13, 31, 0],
        "1f91d": [["\ud83e\udd1d"], "", "", ["handshake"], 28, 19, 31, 0],
        "1f91e": [["\ud83e\udd1e"], "", "", ["hand_with_index_and_middle_fingers_crossed"], 28, 20, 31, 0],
        "1f920": [["\ud83e\udd20"], "", "", ["face_with_cowboy_hat"], 28, 26, 31, 0],
        "1f921": [["\ud83e\udd21"], "", "", ["clown_face"], 28, 27, 31, 0],
        "1f922": [["\ud83e\udd22"], "", "", ["nauseated_face"], 28, 28, 31, 0],
        "1f923": [["\ud83e\udd23"], "", "", ["rolling_on_the_floor_laughing"], 28, 29, 31, 0],
        "1f924": [["\ud83e\udd24"], "", "", ["drooling_face"], 28, 30, 31, 0],
        "1f925": [["\ud83e\udd25"], "", "", ["lying_face"], 28, 31, 31, 0],
        "1f926": [["\ud83e\udd26"], "", "", ["face_palm"], 28, 32, 31, 0],
        "1f927": [["\ud83e\udd27"], "", "", ["sneezing_face"], 28, 38, 31, 0],
        "1f930": [["\ud83e\udd30"], "", "", ["pregnant_woman"], 28, 39, 31, 0],
        "1f933": [["\ud83e\udd33"], "", "", ["selfie"], 28, 45, 31, 0],
        "1f934": [["\ud83e\udd34"], "", "", ["prince"], 29, 2, 31, 0],
        "1f935": [["\ud83e\udd35"], "", "", ["man_in_tuxedo"], 29, 8, 31, 0],
        "1f936": [["\ud83e\udd36"], "", "", ["mother_christmas"], 29, 14, 31, 0],
        "1f937": [["\ud83e\udd37"], "", "", ["shrug"], 29, 20, 31, 0],
        "1f938": [["\ud83e\udd38"], "", "", ["person_doing_cartwheel"], 29, 26, 31, 0],
        "1f939": [["\ud83e\udd39"], "", "", ["juggling"], 29, 32, 31, 0],
        "1f93a": [["\ud83e\udd3a"], "", "", ["fencer"], 29, 38, 31, 0],
        "1f93c": [["\ud83e\udd3c"], "", "", ["wrestlers"], 29, 39, 31, 0],
        "1f93d": [["\ud83e\udd3d"], "", "", ["water_polo"], 29, 40, 31, 0],
        "1f93e": [["\ud83e\udd3e"], "", "", ["handball"], 29, 46, 31, 0],
        "1f940": [["\ud83e\udd40"], "", "", ["wilted_flower"], 30, 3, 31, 0],
        "1f941": [["\ud83e\udd41"], "", "", ["drum_with_drumsticks"], 30, 4, 31, 0],
        "1f942": [["\ud83e\udd42"], "", "", ["clinking_glasses"], 30, 5, 31, 0],
        "1f943": [["\ud83e\udd43"], "", "", ["tumbler_glass"], 30, 6, 31, 0],
        "1f944": [["\ud83e\udd44"], "", "", ["spoon"], 30, 7, 31, 0],
        "1f945": [["\ud83e\udd45"], "", "", ["goal_net"], 30, 8, 31, 0],
        "1f947": [["\ud83e\udd47"], "", "", ["first_place_medal"], 30, 9, 31, 0],
        "1f948": [["\ud83e\udd48"], "", "", ["second_place_medal"], 30, 10, 31, 0],
        "1f949": [["\ud83e\udd49"], "", "", ["third_place_medal"], 30, 11, 31, 0],
        "1f94a": [["\ud83e\udd4a"], "", "", ["boxing_glove"], 30, 12, 31, 0],
        "1f94b": [["\ud83e\udd4b"], "", "", ["martial_arts_uniform"], 30, 13, 31, 0],
        "1f950": [["\ud83e\udd50"], "", "", ["croissant"], 30, 14, 31, 0],
        "1f951": [["\ud83e\udd51"], "", "", ["avocado"], 30, 15, 31, 0],
        "1f952": [["\ud83e\udd52"], "", "", ["cucumber"], 30, 16, 31, 0],
        "1f953": [["\ud83e\udd53"], "", "", ["bacon"], 30, 17, 31, 0],
        "1f954": [["\ud83e\udd54"], "", "", ["potato"], 30, 18, 31, 0],
        "1f955": [["\ud83e\udd55"], "", "", ["carrot"], 30, 19, 31, 0],
        "1f956": [["\ud83e\udd56"], "", "", ["baguette_bread"], 30, 20, 31, 0],
        "1f957": [["\ud83e\udd57"], "", "", ["green_salad"], 30, 21, 31, 0],
        "1f958": [["\ud83e\udd58"], "", "", ["shallow_pan_of_food"], 30, 22, 31, 0],
        "1f959": [["\ud83e\udd59"], "", "", ["stuffed_flatbread"], 30, 23, 31, 0],
        "1f95a": [["\ud83e\udd5a"], "", "", ["egg"], 30, 24, 31, 0],
        "1f95b": [["\ud83e\udd5b"], "", "", ["glass_of_milk"], 30, 25, 31, 0],
        "1f95c": [["\ud83e\udd5c"], "", "", ["peanuts"], 30, 26, 31, 0],
        "1f95d": [["\ud83e\udd5d"], "", "", ["kiwifruit"], 30, 27, 31, 0],
        "1f95e": [["\ud83e\udd5e"], "", "", ["pancakes"], 30, 28, 31, 0],
        "1f980": [["\ud83e\udd80"], "", "", ["crab"], 30, 29, 31, 0],
        "1f981": [["\ud83e\udd81"], "", "", ["lion_face"], 30, 30, 31, 0],
        "1f982": [["\ud83e\udd82"], "", "", ["scorpion"], 30, 31, 31, 0],
        "1f983": [["\ud83e\udd83"], "", "", ["turkey"], 30, 32, 31, 0],
        "1f984": [["\ud83e\udd84"], "", "", ["unicorn_face"], 30, 33, 31, 0],
        "1f985": [["\ud83e\udd85"], "", "", ["eagle"], 30, 34, 31, 0],
        "1f986": [["\ud83e\udd86"], "", "", ["duck"], 30, 35, 31, 0],
        "1f987": [["\ud83e\udd87"], "", "", ["bat"], 30, 36, 31, 0],
        "1f988": [["\ud83e\udd88"], "", "", ["shark"], 30, 37, 31, 0],
        "1f989": [["\ud83e\udd89"], "", "", ["owl"], 30, 38, 31, 0],
        "1f98a": [["\ud83e\udd8a"], "", "", ["fox_face"], 30, 39, 31, 0],
        "1f98b": [["\ud83e\udd8b"], "", "", ["butterfly"], 30, 40, 31, 0],
        "1f98c": [["\ud83e\udd8c"], "", "", ["deer"], 30, 41, 31, 0],
        "1f98d": [["\ud83e\udd8d"], "", "", ["gorilla"], 30, 42, 31, 0],
        "1f98e": [["\ud83e\udd8e"], "", "", ["lizard"], 30, 43, 31, 0],
        "1f98f": [["\ud83e\udd8f"], "", "", ["rhinoceros"], 30, 44, 31, 0],
        "1f990": [["\ud83e\udd90"], "", "", ["shrimp"], 30, 45, 31, 0],
        "1f991": [["\ud83e\udd91"], "", "", ["squid"], 30, 46, 31, 0],
        "1f9c0": [["\ud83e\uddc0"], "", "", ["cheese_wedge"], 30, 47, 31, 0],
        "0023-20e3": [["#\ufe0f\u20e3", "#\u20e3"], "\ue210", "\udbba\udc2c", ["hash"], 30, 48, 15, 0],
        "002a-20e3": [["*\ufe0f\u20e3", "*\u20e3"], "", "", ["keycap_star"], 31, 0, 15, 0],
        "0030-20e3": [["0\ufe0f\u20e3", "0\u20e3"], "\ue225", "\udbba\udc37", ["zero"], 31, 1, 15, 0],
        "0031-20e3": [["1\ufe0f\u20e3", "1\u20e3"], "\ue21c", "\udbba\udc2e", ["one"], 31, 2, 15, 0],
        "0032-20e3": [["2\ufe0f\u20e3", "2\u20e3"], "\ue21d", "\udbba\udc2f", ["two"], 31, 3, 15, 0],
        "0033-20e3": [["3\ufe0f\u20e3", "3\u20e3"], "\ue21e", "\udbba\udc30", ["three"], 31, 4, 15, 0],
        "0034-20e3": [["4\ufe0f\u20e3", "4\u20e3"], "\ue21f", "\udbba\udc31", ["four"], 31, 5, 15, 0],
        "0035-20e3": [["5\ufe0f\u20e3", "5\u20e3"], "\ue220", "\udbba\udc32", ["five"], 31, 6, 15, 0],
        "0036-20e3": [["6\ufe0f\u20e3", "6\u20e3"], "\ue221", "\udbba\udc33", ["six"], 31, 7, 15, 0],
        "0037-20e3": [["7\ufe0f\u20e3", "7\u20e3"], "\ue222", "\udbba\udc34", ["seven"], 31, 8, 15, 0],
        "0038-20e3": [["8\ufe0f\u20e3", "8\u20e3"], "\ue223", "\udbba\udc35", ["eight"], 31, 9, 15, 0],
        "0039-20e3": [["9\ufe0f\u20e3", "9\u20e3"], "\ue224", "\udbba\udc36", ["nine"], 31, 10, 15, 0],
        "1f1e6-1f1e8": [["\ud83c\udde6\ud83c\udde8"], "", "", ["flag-ac"], 31, 11, 63, 0],
        "1f1e6-1f1e9": [["\ud83c\udde6\ud83c\udde9"], "", "", ["flag-ad"], 31, 12, 63, 0],
        "1f1e6-1f1ea": [["\ud83c\udde6\ud83c\uddea"], "", "", ["flag-ae"], 31, 13, 63, 0],
        "1f1e6-1f1eb": [["\ud83c\udde6\ud83c\uddeb"], "", "", ["flag-af"], 31, 14, 63, 0],
        "1f1e6-1f1ec": [["\ud83c\udde6\ud83c\uddec"], "", "", ["flag-ag"], 31, 15, 63, 0],
        "1f1e6-1f1ee": [["\ud83c\udde6\ud83c\uddee"], "", "", ["flag-ai"], 31, 16, 63, 0],
        "1f1e6-1f1f1": [["\ud83c\udde6\ud83c\uddf1"], "", "", ["flag-al"], 31, 17, 63, 0],
        "1f1e6-1f1f2": [["\ud83c\udde6\ud83c\uddf2"], "", "", ["flag-am"], 31, 18, 63, 0],
        "1f1e6-1f1f4": [["\ud83c\udde6\ud83c\uddf4"], "", "", ["flag-ao"], 31, 19, 63, 0],
        "1f1e6-1f1f6": [["\ud83c\udde6\ud83c\uddf6"], "", "", ["flag-aq"], 31, 20, 63, 0],
        "1f1e6-1f1f7": [["\ud83c\udde6\ud83c\uddf7"], "", "", ["flag-ar"], 31, 21, 63, 0],
        "1f1e6-1f1f8": [["\ud83c\udde6\ud83c\uddf8"], "", "", ["flag-as"], 31, 22, 63, 0],
        "1f1e6-1f1f9": [["\ud83c\udde6\ud83c\uddf9"], "", "", ["flag-at"], 31, 23, 63, 0],
        "1f1e6-1f1fa": [["\ud83c\udde6\ud83c\uddfa"], "", "", ["flag-au"], 31, 24, 63, 0],
        "1f1e6-1f1fc": [["\ud83c\udde6\ud83c\uddfc"], "", "", ["flag-aw"], 31, 25, 63, 0],
        "1f1e6-1f1fd": [["\ud83c\udde6\ud83c\uddfd"], "", "", ["flag-ax"], 31, 26, 63, 0],
        "1f1e6-1f1ff": [["\ud83c\udde6\ud83c\uddff"], "", "", ["flag-az"], 31, 27, 63, 0],
        "1f1e7-1f1e6": [["\ud83c\udde7\ud83c\udde6"], "", "", ["flag-ba"], 31, 28, 31, 0],
        "1f1e7-1f1e7": [["\ud83c\udde7\ud83c\udde7"], "", "", ["flag-bb"], 31, 29, 63, 0],
        "1f1e7-1f1e9": [["\ud83c\udde7\ud83c\udde9"], "", "", ["flag-bd"], 31, 30, 63, 0],
        "1f1e7-1f1ea": [["\ud83c\udde7\ud83c\uddea"], "", "", ["flag-be"], 31, 31, 63, 0],
        "1f1e7-1f1eb": [["\ud83c\udde7\ud83c\uddeb"], "", "", ["flag-bf"], 31, 32, 63, 0],
        "1f1e7-1f1ec": [["\ud83c\udde7\ud83c\uddec"], "", "", ["flag-bg"], 31, 33, 63, 0],
        "1f1e7-1f1ed": [["\ud83c\udde7\ud83c\udded"], "", "", ["flag-bh"], 31, 34, 63, 0],
        "1f1e7-1f1ee": [["\ud83c\udde7\ud83c\uddee"], "", "", ["flag-bi"], 31, 35, 63, 0],
        "1f1e7-1f1ef": [["\ud83c\udde7\ud83c\uddef"], "", "", ["flag-bj"], 31, 36, 63, 0],
        "1f1e7-1f1f1": [["\ud83c\udde7\ud83c\uddf1"], "", "", ["flag-bl"], 31, 37, 61, 0],
        "1f1e7-1f1f2": [["\ud83c\udde7\ud83c\uddf2"], "", "", ["flag-bm"], 31, 38, 63, 0],
        "1f1e7-1f1f3": [["\ud83c\udde7\ud83c\uddf3"], "", "", ["flag-bn"], 31, 39, 31, 0],
        "1f1e7-1f1f4": [["\ud83c\udde7\ud83c\uddf4"], "", "", ["flag-bo"], 31, 40, 63, 0],
        "1f1e7-1f1f6": [["\ud83c\udde7\ud83c\uddf6"], "", "", ["flag-bq"], 31, 41, 61, 0],
        "1f1e7-1f1f7": [["\ud83c\udde7\ud83c\uddf7"], "", "", ["flag-br"], 31, 42, 63, 0],
        "1f1e7-1f1f8": [["\ud83c\udde7\ud83c\uddf8"], "", "", ["flag-bs"], 31, 43, 63, 0],
        "1f1e7-1f1f9": [["\ud83c\udde7\ud83c\uddf9"], "", "", ["flag-bt"], 31, 44, 63, 0],
        "1f1e7-1f1fb": [["\ud83c\udde7\ud83c\uddfb"], "", "", ["flag-bv"], 31, 45, 61, 0],
        "1f1e7-1f1fc": [["\ud83c\udde7\ud83c\uddfc"], "", "", ["flag-bw"], 31, 46, 63, 0],
        "1f1e7-1f1fe": [["\ud83c\udde7\ud83c\uddfe"], "", "", ["flag-by"], 31, 47, 63, 0],
        "1f1e7-1f1ff": [["\ud83c\udde7\ud83c\uddff"], "", "", ["flag-bz"], 31, 48, 63, 0],
        "1f1e8-1f1e6": [["\ud83c\udde8\ud83c\udde6"], "", "", ["flag-ca"], 32, 0, 63, 0],
        "1f1e8-1f1e8": [["\ud83c\udde8\ud83c\udde8"], "", "", ["flag-cc"], 32, 1, 63, 0],
        "1f1e8-1f1e9": [["\ud83c\udde8\ud83c\udde9"], "", "", ["flag-cd"], 32, 2, 63, 0],
        "1f1e8-1f1eb": [["\ud83c\udde8\ud83c\uddeb"], "", "", ["flag-cf"], 32, 3, 63, 0],
        "1f1e8-1f1ec": [["\ud83c\udde8\ud83c\uddec"], "", "", ["flag-cg"], 32, 4, 63, 0],
        "1f1e8-1f1ed": [["\ud83c\udde8\ud83c\udded"], "", "", ["flag-ch"], 32, 5, 63, 0],
        "1f1e8-1f1ee": [["\ud83c\udde8\ud83c\uddee"], "", "", ["flag-ci"], 32, 6, 63, 0],
        "1f1e8-1f1f0": [["\ud83c\udde8\ud83c\uddf0"], "", "", ["flag-ck"], 32, 7, 63, 0],
        "1f1e8-1f1f1": [["\ud83c\udde8\ud83c\uddf1"], "", "", ["flag-cl"], 32, 8, 63, 0],
        "1f1e8-1f1f2": [["\ud83c\udde8\ud83c\uddf2"], "", "", ["flag-cm"], 32, 9, 63, 0],
        "1f1e8-1f1f3": [["\ud83c\udde8\ud83c\uddf3"], "\ue513", "\udbb9\udced", ["flag-cn", "cn"], 32, 10, 63, 0],
        "1f1e8-1f1f4": [["\ud83c\udde8\ud83c\uddf4"], "", "", ["flag-co"], 32, 11, 63, 0],
        "1f1e8-1f1f5": [["\ud83c\udde8\ud83c\uddf5"], "", "", ["flag-cp"], 32, 12, 29, 0],
        "1f1e8-1f1f7": [["\ud83c\udde8\ud83c\uddf7"], "", "", ["flag-cr"], 32, 13, 63, 0],
        "1f1e8-1f1fa": [["\ud83c\udde8\ud83c\uddfa"], "", "", ["flag-cu"], 32, 14, 63, 0],
        "1f1e8-1f1fb": [["\ud83c\udde8\ud83c\uddfb"], "", "", ["flag-cv"], 32, 15, 63, 0],
        "1f1e8-1f1fc": [["\ud83c\udde8\ud83c\uddfc"], "", "", ["flag-cw"], 32, 16, 63, 0],
        "1f1e8-1f1fd": [["\ud83c\udde8\ud83c\uddfd"], "", "", ["flag-cx"], 32, 17, 63, 0],
        "1f1e8-1f1fe": [["\ud83c\udde8\ud83c\uddfe"], "", "", ["flag-cy"], 32, 18, 63, 0],
        "1f1e8-1f1ff": [["\ud83c\udde8\ud83c\uddff"], "", "", ["flag-cz"], 32, 19, 63, 0],
        "1f1e9-1f1ea": [["\ud83c\udde9\ud83c\uddea"], "\ue50e", "\udbb9\udce8", ["flag-de", "de"], 32, 20, 63, 0],
        "1f1e9-1f1ec": [["\ud83c\udde9\ud83c\uddec"], "", "", ["flag-dg"], 32, 21, 61, 0],
        "1f1e9-1f1ef": [["\ud83c\udde9\ud83c\uddef"], "", "", ["flag-dj"], 32, 22, 63, 0],
        "1f1e9-1f1f0": [["\ud83c\udde9\ud83c\uddf0"], "", "", ["flag-dk"], 32, 23, 63, 0],
        "1f1e9-1f1f2": [["\ud83c\udde9\ud83c\uddf2"], "", "", ["flag-dm"], 32, 24, 63, 0],
        "1f1e9-1f1f4": [["\ud83c\udde9\ud83c\uddf4"], "", "", ["flag-do"], 32, 25, 63, 0],
        "1f1e9-1f1ff": [["\ud83c\udde9\ud83c\uddff"], "", "", ["flag-dz"], 32, 26, 63, 0],
        "1f1ea-1f1e6": [["\ud83c\uddea\ud83c\udde6"], "", "", ["flag-ea"], 32, 27, 61, 0],
        "1f1ea-1f1e8": [["\ud83c\uddea\ud83c\udde8"], "", "", ["flag-ec"], 32, 28, 63, 0],
        "1f1ea-1f1ea": [["\ud83c\uddea\ud83c\uddea"], "", "", ["flag-ee"], 32, 29, 63, 0],
        "1f1ea-1f1ec": [["\ud83c\uddea\ud83c\uddec"], "", "", ["flag-eg"], 32, 30, 63, 0],
        "1f1ea-1f1ed": [["\ud83c\uddea\ud83c\udded"], "", "", ["flag-eh"], 32, 31, 61, 0],
        "1f1ea-1f1f7": [["\ud83c\uddea\ud83c\uddf7"], "", "", ["flag-er"], 32, 32, 63, 0],
        "1f1ea-1f1f8": [["\ud83c\uddea\ud83c\uddf8"], "\ue511", "\udbb9\udceb", ["flag-es", "es"], 32, 33, 63, 0],
        "1f1ea-1f1f9": [["\ud83c\uddea\ud83c\uddf9"], "", "", ["flag-et"], 32, 34, 63, 0],
        "1f1ea-1f1fa": [["\ud83c\uddea\ud83c\uddfa"], "", "", ["flag-eu"], 32, 35, 63, 0],
        "1f1eb-1f1ee": [["\ud83c\uddeb\ud83c\uddee"], "", "", ["flag-fi"], 32, 36, 63, 0],
        "1f1eb-1f1ef": [["\ud83c\uddeb\ud83c\uddef"], "", "", ["flag-fj"], 32, 37, 63, 0],
        "1f1eb-1f1f0": [["\ud83c\uddeb\ud83c\uddf0"], "", "", ["flag-fk"], 32, 38, 61, 0],
        "1f1eb-1f1f2": [["\ud83c\uddeb\ud83c\uddf2"], "", "", ["flag-fm"], 32, 39, 63, 0],
        "1f1eb-1f1f4": [["\ud83c\uddeb\ud83c\uddf4"], "", "", ["flag-fo"], 32, 40, 63, 0],
        "1f1eb-1f1f7": [["\ud83c\uddeb\ud83c\uddf7"], "\ue50d", "\udbb9\udce7", ["flag-fr", "fr"], 32, 41, 63, 0],
        "1f1ec-1f1e6": [["\ud83c\uddec\ud83c\udde6"], "", "", ["flag-ga"], 32, 42, 63, 0],
        "1f1ec-1f1e7": [["\ud83c\uddec\ud83c\udde7"], "\ue510", "\udbb9\udcea", ["flag-gb", "gb", "uk"], 32, 43, 63, 0],
        "1f1ec-1f1e9": [["\ud83c\uddec\ud83c\udde9"], "", "", ["flag-gd"], 32, 44, 63, 0],
        "1f1ec-1f1ea": [["\ud83c\uddec\ud83c\uddea"], "", "", ["flag-ge"], 32, 45, 63, 0],
        "1f1ec-1f1eb": [["\ud83c\uddec\ud83c\uddeb"], "", "", ["flag-gf"], 32, 46, 61, 0],
        "1f1ec-1f1ec": [["\ud83c\uddec\ud83c\uddec"], "", "", ["flag-gg"], 32, 47, 63, 0],
        "1f1ec-1f1ed": [["\ud83c\uddec\ud83c\udded"], "", "", ["flag-gh"], 32, 48, 63, 0],
        "1f1ec-1f1ee": [["\ud83c\uddec\ud83c\uddee"], "", "", ["flag-gi"], 33, 0, 63, 0],
        "1f1ec-1f1f1": [["\ud83c\uddec\ud83c\uddf1"], "", "", ["flag-gl"], 33, 1, 63, 0],
        "1f1ec-1f1f2": [["\ud83c\uddec\ud83c\uddf2"], "", "", ["flag-gm"], 33, 2, 63, 0],
        "1f1ec-1f1f3": [["\ud83c\uddec\ud83c\uddf3"], "", "", ["flag-gn"], 33, 3, 63, 0],
        "1f1ec-1f1f5": [["\ud83c\uddec\ud83c\uddf5"], "", "", ["flag-gp"], 33, 4, 61, 0],
        "1f1ec-1f1f6": [["\ud83c\uddec\ud83c\uddf6"], "", "", ["flag-gq"], 33, 5, 63, 0],
        "1f1ec-1f1f7": [["\ud83c\uddec\ud83c\uddf7"], "", "", ["flag-gr"], 33, 6, 63, 0],
        "1f1ec-1f1f8": [["\ud83c\uddec\ud83c\uddf8"], "", "", ["flag-gs"], 33, 7, 61, 0],
        "1f1ec-1f1f9": [["\ud83c\uddec\ud83c\uddf9"], "", "", ["flag-gt"], 33, 8, 63, 0],
        "1f1ec-1f1fa": [["\ud83c\uddec\ud83c\uddfa"], "", "", ["flag-gu"], 33, 9, 63, 0],
        "1f1ec-1f1fc": [["\ud83c\uddec\ud83c\uddfc"], "", "", ["flag-gw"], 33, 10, 63, 0],
        "1f1ec-1f1fe": [["\ud83c\uddec\ud83c\uddfe"], "", "", ["flag-gy"], 33, 11, 63, 0],
        "1f1ed-1f1f0": [["\ud83c\udded\ud83c\uddf0"], "", "", ["flag-hk"], 33, 12, 63, 0],
        "1f1ed-1f1f2": [["\ud83c\udded\ud83c\uddf2"], "", "", ["flag-hm"], 33, 13, 61, 0],
        "1f1ed-1f1f3": [["\ud83c\udded\ud83c\uddf3"], "", "", ["flag-hn"], 33, 14, 63, 0],
        "1f1ed-1f1f7": [["\ud83c\udded\ud83c\uddf7"], "", "", ["flag-hr"], 33, 15, 63, 0],
        "1f1ed-1f1f9": [["\ud83c\udded\ud83c\uddf9"], "", "", ["flag-ht"], 33, 16, 63, 0],
        "1f1ed-1f1fa": [["\ud83c\udded\ud83c\uddfa"], "", "", ["flag-hu"], 33, 17, 63, 0],
        "1f1ee-1f1e8": [["\ud83c\uddee\ud83c\udde8"], "", "", ["flag-ic"], 33, 18, 63, 0],
        "1f1ee-1f1e9": [["\ud83c\uddee\ud83c\udde9"], "", "", ["flag-id"], 33, 19, 63, 0],
        "1f1ee-1f1ea": [["\ud83c\uddee\ud83c\uddea"], "", "", ["flag-ie"], 33, 20, 63, 0],
        "1f1ee-1f1f1": [["\ud83c\uddee\ud83c\uddf1"], "", "", ["flag-il"], 33, 21, 63, 0],
        "1f1ee-1f1f2": [["\ud83c\uddee\ud83c\uddf2"], "", "", ["flag-im"], 33, 22, 63, 0],
        "1f1ee-1f1f3": [["\ud83c\uddee\ud83c\uddf3"], "", "", ["flag-in"], 33, 23, 63, 0],
        "1f1ee-1f1f4": [["\ud83c\uddee\ud83c\uddf4"], "", "", ["flag-io"], 33, 24, 63, 0],
        "1f1ee-1f1f6": [["\ud83c\uddee\ud83c\uddf6"], "", "", ["flag-iq"], 33, 25, 63, 0],
        "1f1ee-1f1f7": [["\ud83c\uddee\ud83c\uddf7"], "", "", ["flag-ir"], 33, 26, 63, 0],
        "1f1ee-1f1f8": [["\ud83c\uddee\ud83c\uddf8"], "", "", ["flag-is"], 33, 27, 63, 0],
        "1f1ee-1f1f9": [["\ud83c\uddee\ud83c\uddf9"], "\ue50f", "\udbb9\udce9", ["flag-it", "it"], 33, 28, 63, 0],
        "1f1ef-1f1ea": [["\ud83c\uddef\ud83c\uddea"], "", "", ["flag-je"], 33, 29, 63, 0],
        "1f1ef-1f1f2": [["\ud83c\uddef\ud83c\uddf2"], "", "", ["flag-jm"], 33, 30, 63, 0],
        "1f1ef-1f1f4": [["\ud83c\uddef\ud83c\uddf4"], "", "", ["flag-jo"], 33, 31, 63, 0],
        "1f1ef-1f1f5": [["\ud83c\uddef\ud83c\uddf5"], "\ue50b", "\udbb9\udce5", ["flag-jp", "jp"], 33, 32, 63, 0],
        "1f1f0-1f1ea": [["\ud83c\uddf0\ud83c\uddea"], "", "", ["flag-ke"], 33, 33, 63, 0],
        "1f1f0-1f1ec": [["\ud83c\uddf0\ud83c\uddec"], "", "", ["flag-kg"], 33, 34, 63, 0],
        "1f1f0-1f1ed": [["\ud83c\uddf0\ud83c\udded"], "", "", ["flag-kh"], 33, 35, 63, 0],
        "1f1f0-1f1ee": [["\ud83c\uddf0\ud83c\uddee"], "", "", ["flag-ki"], 33, 36, 63, 0],
        "1f1f0-1f1f2": [["\ud83c\uddf0\ud83c\uddf2"], "", "", ["flag-km"], 33, 37, 63, 0],
        "1f1f0-1f1f3": [["\ud83c\uddf0\ud83c\uddf3"], "", "", ["flag-kn"], 33, 38, 63, 0],
        "1f1f0-1f1f5": [["\ud83c\uddf0\ud83c\uddf5"], "", "", ["flag-kp"], 33, 39, 63, 0],
        "1f1f0-1f1f7": [["\ud83c\uddf0\ud83c\uddf7"], "\ue514", "\udbb9\udcee", ["flag-kr", "kr"], 33, 40, 63, 0],
        "1f1f0-1f1fc": [["\ud83c\uddf0\ud83c\uddfc"], "", "", ["flag-kw"], 33, 41, 63, 0],
        "1f1f0-1f1fe": [["\ud83c\uddf0\ud83c\uddfe"], "", "", ["flag-ky"], 33, 42, 63, 0],
        "1f1f0-1f1ff": [["\ud83c\uddf0\ud83c\uddff"], "", "", ["flag-kz"], 33, 43, 63, 0],
        "1f1f1-1f1e6": [["\ud83c\uddf1\ud83c\udde6"], "", "", ["flag-la"], 33, 44, 63, 0],
        "1f1f1-1f1e7": [["\ud83c\uddf1\ud83c\udde7"], "", "", ["flag-lb"], 33, 45, 63, 0],
        "1f1f1-1f1e8": [["\ud83c\uddf1\ud83c\udde8"], "", "", ["flag-lc"], 33, 46, 63, 0],
        "1f1f1-1f1ee": [["\ud83c\uddf1\ud83c\uddee"], "", "", ["flag-li"], 33, 47, 63, 0],
        "1f1f1-1f1f0": [["\ud83c\uddf1\ud83c\uddf0"], "", "", ["flag-lk"], 33, 48, 63, 0],
        "1f1f1-1f1f7": [["\ud83c\uddf1\ud83c\uddf7"], "", "", ["flag-lr"], 34, 0, 63, 0],
        "1f1f1-1f1f8": [["\ud83c\uddf1\ud83c\uddf8"], "", "", ["flag-ls"], 34, 1, 63, 0],
        "1f1f1-1f1f9": [["\ud83c\uddf1\ud83c\uddf9"], "", "", ["flag-lt"], 34, 2, 63, 0],
        "1f1f1-1f1fa": [["\ud83c\uddf1\ud83c\uddfa"], "", "", ["flag-lu"], 34, 3, 63, 0],
        "1f1f1-1f1fb": [["\ud83c\uddf1\ud83c\uddfb"], "", "", ["flag-lv"], 34, 4, 63, 0],
        "1f1f1-1f1fe": [["\ud83c\uddf1\ud83c\uddfe"], "", "", ["flag-ly"], 34, 5, 63, 0],
        "1f1f2-1f1e6": [["\ud83c\uddf2\ud83c\udde6"], "", "", ["flag-ma"], 34, 6, 63, 0],
        "1f1f2-1f1e8": [["\ud83c\uddf2\ud83c\udde8"], "", "", ["flag-mc"], 34, 7, 63, 0],
        "1f1f2-1f1e9": [["\ud83c\uddf2\ud83c\udde9"], "", "", ["flag-md"], 34, 8, 63, 0],
        "1f1f2-1f1ea": [["\ud83c\uddf2\ud83c\uddea"], "", "", ["flag-me"], 34, 9, 63, 0],
        "1f1f2-1f1eb": [["\ud83c\uddf2\ud83c\uddeb"], "", "", ["flag-mf"], 34, 10, 61, 0],
        "1f1f2-1f1ec": [["\ud83c\uddf2\ud83c\uddec"], "", "", ["flag-mg"], 34, 11, 63, 0],
        "1f1f2-1f1ed": [["\ud83c\uddf2\ud83c\udded"], "", "", ["flag-mh"], 34, 12, 63, 0],
        "1f1f2-1f1f0": [["\ud83c\uddf2\ud83c\uddf0"], "", "", ["flag-mk"], 34, 13, 63, 0],
        "1f1f2-1f1f1": [["\ud83c\uddf2\ud83c\uddf1"], "", "", ["flag-ml"], 34, 14, 63, 0],
        "1f1f2-1f1f2": [["\ud83c\uddf2\ud83c\uddf2"], "", "", ["flag-mm"], 34, 15, 63, 0],
        "1f1f2-1f1f3": [["\ud83c\uddf2\ud83c\uddf3"], "", "", ["flag-mn"], 34, 16, 63, 0],
        "1f1f2-1f1f4": [["\ud83c\uddf2\ud83c\uddf4"], "", "", ["flag-mo"], 34, 17, 63, 0],
        "1f1f2-1f1f5": [["\ud83c\uddf2\ud83c\uddf5"], "", "", ["flag-mp"], 34, 18, 63, 0],
        "1f1f2-1f1f6": [["\ud83c\uddf2\ud83c\uddf6"], "", "", ["flag-mq"], 34, 19, 61, 0],
        "1f1f2-1f1f7": [["\ud83c\uddf2\ud83c\uddf7"], "", "", ["flag-mr"], 34, 20, 63, 0],
        "1f1f2-1f1f8": [["\ud83c\uddf2\ud83c\uddf8"], "", "", ["flag-ms"], 34, 21, 63, 0],
        "1f1f2-1f1f9": [["\ud83c\uddf2\ud83c\uddf9"], "", "", ["flag-mt"], 34, 22, 63, 0],
        "1f1f2-1f1fa": [["\ud83c\uddf2\ud83c\uddfa"], "", "", ["flag-mu"], 34, 23, 63, 0],
        "1f1f2-1f1fb": [["\ud83c\uddf2\ud83c\uddfb"], "", "", ["flag-mv"], 34, 24, 63, 0],
        "1f1f2-1f1fc": [["\ud83c\uddf2\ud83c\uddfc"], "", "", ["flag-mw"], 34, 25, 63, 0],
        "1f1f2-1f1fd": [["\ud83c\uddf2\ud83c\uddfd"], "", "", ["flag-mx"], 34, 26, 63, 0],
        "1f1f2-1f1fe": [["\ud83c\uddf2\ud83c\uddfe"], "", "", ["flag-my"], 34, 27, 63, 0],
        "1f1f2-1f1ff": [["\ud83c\uddf2\ud83c\uddff"], "", "", ["flag-mz"], 34, 28, 63, 0],
        "1f1f3-1f1e6": [["\ud83c\uddf3\ud83c\udde6"], "", "", ["flag-na"], 34, 29, 63, 0],
        "1f1f3-1f1e8": [["\ud83c\uddf3\ud83c\udde8"], "", "", ["flag-nc"], 34, 30, 61, 0],
        "1f1f3-1f1ea": [["\ud83c\uddf3\ud83c\uddea"], "", "", ["flag-ne"], 34, 31, 63, 0],
        "1f1f3-1f1eb": [["\ud83c\uddf3\ud83c\uddeb"], "", "", ["flag-nf"], 34, 32, 63, 0],
        "1f1f3-1f1ec": [["\ud83c\uddf3\ud83c\uddec"], "", "", ["flag-ng"], 34, 33, 63, 0],
        "1f1f3-1f1ee": [["\ud83c\uddf3\ud83c\uddee"], "", "", ["flag-ni"], 34, 34, 63, 0],
        "1f1f3-1f1f1": [["\ud83c\uddf3\ud83c\uddf1"], "", "", ["flag-nl"], 34, 35, 63, 0],
        "1f1f3-1f1f4": [["\ud83c\uddf3\ud83c\uddf4"], "", "", ["flag-no"], 34, 36, 63, 0],
        "1f1f3-1f1f5": [["\ud83c\uddf3\ud83c\uddf5"], "", "", ["flag-np"], 34, 37, 63, 0],
        "1f1f3-1f1f7": [["\ud83c\uddf3\ud83c\uddf7"], "", "", ["flag-nr"], 34, 38, 63, 0],
        "1f1f3-1f1fa": [["\ud83c\uddf3\ud83c\uddfa"], "", "", ["flag-nu"], 34, 39, 63, 0],
        "1f1f3-1f1ff": [["\ud83c\uddf3\ud83c\uddff"], "", "", ["flag-nz"], 34, 40, 63, 0],
        "1f1f4-1f1f2": [["\ud83c\uddf4\ud83c\uddf2"], "", "", ["flag-om"], 34, 41, 63, 0],
        "1f1f5-1f1e6": [["\ud83c\uddf5\ud83c\udde6"], "", "", ["flag-pa"], 34, 42, 63, 0],
        "1f1f5-1f1ea": [["\ud83c\uddf5\ud83c\uddea"], "", "", ["flag-pe"], 34, 43, 63, 0],
        "1f1f5-1f1eb": [["\ud83c\uddf5\ud83c\uddeb"], "", "", ["flag-pf"], 34, 44, 63, 0],
        "1f1f5-1f1ec": [["\ud83c\uddf5\ud83c\uddec"], "", "", ["flag-pg"], 34, 45, 63, 0],
        "1f1f5-1f1ed": [["\ud83c\uddf5\ud83c\udded"], "", "", ["flag-ph"], 34, 46, 63, 0],
        "1f1f5-1f1f0": [["\ud83c\uddf5\ud83c\uddf0"], "", "", ["flag-pk"], 34, 47, 63, 0],
        "1f1f5-1f1f1": [["\ud83c\uddf5\ud83c\uddf1"], "", "", ["flag-pl"], 34, 48, 63, 0],
        "1f1f5-1f1f2": [["\ud83c\uddf5\ud83c\uddf2"], "", "", ["flag-pm"], 35, 0, 61, 0],
        "1f1f5-1f1f3": [["\ud83c\uddf5\ud83c\uddf3"], "", "", ["flag-pn"], 35, 1, 63, 0],
        "1f1f5-1f1f7": [["\ud83c\uddf5\ud83c\uddf7"], "", "", ["flag-pr"], 35, 2, 63, 0],
        "1f1f5-1f1f8": [["\ud83c\uddf5\ud83c\uddf8"], "", "", ["flag-ps"], 35, 3, 63, 0],
        "1f1f5-1f1f9": [["\ud83c\uddf5\ud83c\uddf9"], "", "", ["flag-pt"], 35, 4, 63, 0],
        "1f1f5-1f1fc": [["\ud83c\uddf5\ud83c\uddfc"], "", "", ["flag-pw"], 35, 5, 63, 0],
        "1f1f5-1f1fe": [["\ud83c\uddf5\ud83c\uddfe"], "", "", ["flag-py"], 35, 6, 63, 0],
        "1f1f6-1f1e6": [["\ud83c\uddf6\ud83c\udde6"], "", "", ["flag-qa"], 35, 7, 63, 0],
        "1f1f7-1f1ea": [["\ud83c\uddf7\ud83c\uddea"], "", "", ["flag-re"], 35, 8, 61, 0],
        "1f1f7-1f1f4": [["\ud83c\uddf7\ud83c\uddf4"], "", "", ["flag-ro"], 35, 9, 63, 0],
        "1f1f7-1f1f8": [["\ud83c\uddf7\ud83c\uddf8"], "", "", ["flag-rs"], 35, 10, 63, 0],
        "1f1f7-1f1fa": [["\ud83c\uddf7\ud83c\uddfa"], "\ue512", "\udbb9\udcec", ["flag-ru", "ru"], 35, 11, 63, 0],
        "1f1f7-1f1fc": [["\ud83c\uddf7\ud83c\uddfc"], "", "", ["flag-rw"], 35, 12, 63, 0],
        "1f1f8-1f1e6": [["\ud83c\uddf8\ud83c\udde6"], "", "", ["flag-sa"], 35, 13, 63, 0],
        "1f1f8-1f1e7": [["\ud83c\uddf8\ud83c\udde7"], "", "", ["flag-sb"], 35, 14, 63, 0],
        "1f1f8-1f1e8": [["\ud83c\uddf8\ud83c\udde8"], "", "", ["flag-sc"], 35, 15, 63, 0],
        "1f1f8-1f1e9": [["\ud83c\uddf8\ud83c\udde9"], "", "", ["flag-sd"], 35, 16, 63, 0],
        "1f1f8-1f1ea": [["\ud83c\uddf8\ud83c\uddea"], "", "", ["flag-se"], 35, 17, 63, 0],
        "1f1f8-1f1ec": [["\ud83c\uddf8\ud83c\uddec"], "", "", ["flag-sg"], 35, 18, 63, 0],
        "1f1f8-1f1ed": [["\ud83c\uddf8\ud83c\udded"], "", "", ["flag-sh"], 35, 19, 63, 0],
        "1f1f8-1f1ee": [["\ud83c\uddf8\ud83c\uddee"], "", "", ["flag-si"], 35, 20, 63, 0],
        "1f1f8-1f1ef": [["\ud83c\uddf8\ud83c\uddef"], "", "", ["flag-sj"], 35, 21, 61, 0],
        "1f1f8-1f1f0": [["\ud83c\uddf8\ud83c\uddf0"], "", "", ["flag-sk"], 35, 22, 63, 0],
        "1f1f8-1f1f1": [["\ud83c\uddf8\ud83c\uddf1"], "", "", ["flag-sl"], 35, 23, 63, 0],
        "1f1f8-1f1f2": [["\ud83c\uddf8\ud83c\uddf2"], "", "", ["flag-sm"], 35, 24, 63, 0],
        "1f1f8-1f1f3": [["\ud83c\uddf8\ud83c\uddf3"], "", "", ["flag-sn"], 35, 25, 63, 0],
        "1f1f8-1f1f4": [["\ud83c\uddf8\ud83c\uddf4"], "", "", ["flag-so"], 35, 26, 63, 0],
        "1f1f8-1f1f7": [["\ud83c\uddf8\ud83c\uddf7"], "", "", ["flag-sr"], 35, 27, 63, 0],
        "1f1f8-1f1f8": [["\ud83c\uddf8\ud83c\uddf8"], "", "", ["flag-ss"], 35, 28, 63, 0],
        "1f1f8-1f1f9": [["\ud83c\uddf8\ud83c\uddf9"], "", "", ["flag-st"], 35, 29, 63, 0],
        "1f1f8-1f1fb": [["\ud83c\uddf8\ud83c\uddfb"], "", "", ["flag-sv"], 35, 30, 63, 0],
        "1f1f8-1f1fd": [["\ud83c\uddf8\ud83c\uddfd"], "", "", ["flag-sx"], 35, 31, 63, 0],
        "1f1f8-1f1fe": [["\ud83c\uddf8\ud83c\uddfe"], "", "", ["flag-sy"], 35, 32, 63, 0],
        "1f1f8-1f1ff": [["\ud83c\uddf8\ud83c\uddff"], "", "", ["flag-sz"], 35, 33, 63, 0],
        "1f1f9-1f1e6": [["\ud83c\uddf9\ud83c\udde6"], "", "", ["flag-ta"], 35, 34, 63, 0],
        "1f1f9-1f1e8": [["\ud83c\uddf9\ud83c\udde8"], "", "", ["flag-tc"], 35, 35, 63, 0],
        "1f1f9-1f1e9": [["\ud83c\uddf9\ud83c\udde9"], "", "", ["flag-td"], 35, 36, 63, 0],
        "1f1f9-1f1eb": [["\ud83c\uddf9\ud83c\uddeb"], "", "", ["flag-tf"], 35, 37, 61, 0],
        "1f1f9-1f1ec": [["\ud83c\uddf9\ud83c\uddec"], "", "", ["flag-tg"], 35, 38, 63, 0],
        "1f1f9-1f1ed": [["\ud83c\uddf9\ud83c\udded"], "", "", ["flag-th"], 35, 39, 63, 0],
        "1f1f9-1f1ef": [["\ud83c\uddf9\ud83c\uddef"], "", "", ["flag-tj"], 35, 40, 63, 0],
        "1f1f9-1f1f0": [["\ud83c\uddf9\ud83c\uddf0"], "", "", ["flag-tk"], 35, 41, 63, 0],
        "1f1f9-1f1f1": [["\ud83c\uddf9\ud83c\uddf1"], "", "", ["flag-tl"], 35, 42, 63, 0],
        "1f1f9-1f1f2": [["\ud83c\uddf9\ud83c\uddf2"], "", "", ["flag-tm"], 35, 43, 63, 0],
        "1f1f9-1f1f3": [["\ud83c\uddf9\ud83c\uddf3"], "", "", ["flag-tn"], 35, 44, 63, 0],
        "1f1f9-1f1f4": [["\ud83c\uddf9\ud83c\uddf4"], "", "", ["flag-to"], 35, 45, 63, 0],
        "1f1f9-1f1f7": [["\ud83c\uddf9\ud83c\uddf7"], "", "", ["flag-tr"], 35, 46, 63, 0],
        "1f1f9-1f1f9": [["\ud83c\uddf9\ud83c\uddf9"], "", "", ["flag-tt"], 35, 47, 63, 0],
        "1f1f9-1f1fb": [["\ud83c\uddf9\ud83c\uddfb"], "", "", ["flag-tv"], 35, 48, 63, 0],
        "1f1f9-1f1fc": [["\ud83c\uddf9\ud83c\uddfc"], "", "", ["flag-tw"], 36, 0, 63, 0],
        "1f1f9-1f1ff": [["\ud83c\uddf9\ud83c\uddff"], "", "", ["flag-tz"], 36, 1, 63, 0],
        "1f1fa-1f1e6": [["\ud83c\uddfa\ud83c\udde6"], "", "", ["flag-ua"], 36, 2, 63, 0],
        "1f1fa-1f1ec": [["\ud83c\uddfa\ud83c\uddec"], "", "", ["flag-ug"], 36, 3, 63, 0],
        "1f1fa-1f1f2": [["\ud83c\uddfa\ud83c\uddf2"], "", "", ["flag-um"], 36, 4, 61, 0],
        "1f1fa-1f1f3": [["\ud83c\uddfa\ud83c\uddf3"], "", "", ["flag-un"], 36, 5, 6, 0],
        "1f1fa-1f1f8": [["\ud83c\uddfa\ud83c\uddf8"], "\ue50c", "\udbb9\udce6", ["flag-us", "us"], 36, 6, 63, 0],
        "1f1fa-1f1fe": [["\ud83c\uddfa\ud83c\uddfe"], "", "", ["flag-uy"], 36, 7, 63, 0],
        "1f1fa-1f1ff": [["\ud83c\uddfa\ud83c\uddff"], "", "", ["flag-uz"], 36, 8, 63, 0],
        "1f1fb-1f1e6": [["\ud83c\uddfb\ud83c\udde6"], "", "", ["flag-va"], 36, 9, 63, 0],
        "1f1fb-1f1e8": [["\ud83c\uddfb\ud83c\udde8"], "", "", ["flag-vc"], 36, 10, 63, 0],
        "1f1fb-1f1ea": [["\ud83c\uddfb\ud83c\uddea"], "", "", ["flag-ve"], 36, 11, 63, 0],
        "1f1fb-1f1ec": [["\ud83c\uddfb\ud83c\uddec"], "", "", ["flag-vg"], 36, 12, 63, 0],
        "1f1fb-1f1ee": [["\ud83c\uddfb\ud83c\uddee"], "", "", ["flag-vi"], 36, 13, 63, 0],
        "1f1fb-1f1f3": [["\ud83c\uddfb\ud83c\uddf3"], "", "", ["flag-vn"], 36, 14, 63, 0],
        "1f1fb-1f1fa": [["\ud83c\uddfb\ud83c\uddfa"], "", "", ["flag-vu"], 36, 15, 63, 0],
        "1f1fc-1f1eb": [["\ud83c\uddfc\ud83c\uddeb"], "", "", ["flag-wf"], 36, 16, 61, 0],
        "1f1fc-1f1f8": [["\ud83c\uddfc\ud83c\uddf8"], "", "", ["flag-ws"], 36, 17, 63, 0],
        "1f1fd-1f1f0": [["\ud83c\uddfd\ud83c\uddf0"], "", "", ["flag-xk"], 36, 18, 61, 0],
        "1f1fe-1f1ea": [["\ud83c\uddfe\ud83c\uddea"], "", "", ["flag-ye"], 36, 19, 63, 0],
        "1f1fe-1f1f9": [["\ud83c\uddfe\ud83c\uddf9"], "", "", ["flag-yt"], 36, 20, 61, 0],
        "1f1ff-1f1e6": [["\ud83c\uddff\ud83c\udde6"], "", "", ["flag-za"], 36, 21, 63, 0],
        "1f1ff-1f1f2": [["\ud83c\uddff\ud83c\uddf2"], "", "", ["flag-zm"], 36, 22, 63, 0],
        "1f1ff-1f1fc": [["\ud83c\uddff\ud83c\uddfc"], "", "", ["flag-zw"], 36, 23, 63, 0],
        "1f468-200d-1f33e": [["\ud83d\udc68\u200d\ud83c\udf3e"], "", "", ["male-farmer"], 36, 24, 23, 0],
        "1f468-200d-1f373": [["\ud83d\udc68\u200d\ud83c\udf73"], "", "", ["male-cook"], 36, 30, 23, 0],
        "1f468-200d-1f393": [["\ud83d\udc68\u200d\ud83c\udf93"], "", "", ["male-student"], 36, 36, 23, 0],
        "1f468-200d-1f3a4": [["\ud83d\udc68\u200d\ud83c\udfa4"], "", "", ["male-singer"], 36, 42, 23, 0],
        "1f468-200d-1f3a8": [["\ud83d\udc68\u200d\ud83c\udfa8"], "", "", ["male-artist"], 36, 48, 23, 0],
        "1f468-200d-1f3eb": [["\ud83d\udc68\u200d\ud83c\udfeb"], "", "", ["male-teacher"], 37, 5, 23, 0],
        "1f468-200d-1f3ed": [["\ud83d\udc68\u200d\ud83c\udfed"], "", "", ["male-factory-worker"], 37, 11, 23, 0],
        "1f468-200d-1f466": [["\ud83d\udc68\u200d\ud83d\udc66"], "", "", ["man-boy"], 37, 17, 23, 0],
        "1f468-200d-1f467": [["\ud83d\udc68\u200d\ud83d\udc67"], "", "", ["man-girl"], 37, 18, 23, 0],
        "1f468-200d-1f4bb": [["\ud83d\udc68\u200d\ud83d\udcbb"], "", "", ["male-technologist"], 37, 19, 23, 0],
        "1f468-200d-1f4bc": [["\ud83d\udc68\u200d\ud83d\udcbc"], "", "", ["male-office-worker"], 37, 25, 23, 0],
        "1f468-200d-1f527": [["\ud83d\udc68\u200d\ud83d\udd27"], "", "", ["male-mechanic"], 37, 31, 23, 0],
        "1f468-200d-1f52c": [["\ud83d\udc68\u200d\ud83d\udd2c"], "", "", ["male-scientist"], 37, 37, 23, 0],
        "1f468-200d-1f680": [["\ud83d\udc68\u200d\ud83d\ude80"], "", "", ["male-astronaut"], 37, 43, 23, 0],
        "1f468-200d-1f692": [["\ud83d\udc68\u200d\ud83d\ude92"], "", "", ["male-firefighter"], 38, 0, 23, 0],
        "1f469-200d-1f33e": [["\ud83d\udc69\u200d\ud83c\udf3e"], "", "", ["female-farmer"], 38, 6, 23, 0],
        "1f469-200d-1f373": [["\ud83d\udc69\u200d\ud83c\udf73"], "", "", ["female-cook"], 38, 12, 23, 0],
        "1f469-200d-1f393": [["\ud83d\udc69\u200d\ud83c\udf93"], "", "", ["female-student"], 38, 18, 23, 0],
        "1f469-200d-1f3a4": [["\ud83d\udc69\u200d\ud83c\udfa4"], "", "", ["female-singer"], 38, 24, 23, 0],
        "1f469-200d-1f3a8": [["\ud83d\udc69\u200d\ud83c\udfa8"], "", "", ["female-artist"], 38, 30, 23, 0],
        "1f469-200d-1f3eb": [["\ud83d\udc69\u200d\ud83c\udfeb"], "", "", ["female-teacher"], 38, 36, 23, 0],
        "1f469-200d-1f3ed": [["\ud83d\udc69\u200d\ud83c\udfed"], "", "", ["female-factory-worker"], 38, 42, 23, 0],
        "1f469-200d-1f466": [["\ud83d\udc69\u200d\ud83d\udc66"], "", "", ["woman-boy"], 38, 48, 23, 0],
        "1f469-200d-1f467": [["\ud83d\udc69\u200d\ud83d\udc67"], "", "", ["woman-girl"], 39, 0, 23, 0],
        "1f469-200d-1f4bb": [["\ud83d\udc69\u200d\ud83d\udcbb"], "", "", ["female-technologist"], 39, 1, 23, 0],
        "1f469-200d-1f4bc": [["\ud83d\udc69\u200d\ud83d\udcbc"], "", "", ["female-office-worker"], 39, 7, 23, 0],
        "1f469-200d-1f527": [["\ud83d\udc69\u200d\ud83d\udd27"], "", "", ["female-mechanic"], 39, 13, 23, 0],
        "1f469-200d-1f52c": [["\ud83d\udc69\u200d\ud83d\udd2c"], "", "", ["female-scientist"], 39, 19, 23, 0],
        "1f469-200d-1f680": [["\ud83d\udc69\u200d\ud83d\ude80"], "", "", ["female-astronaut"], 39, 25, 23, 0],
        "1f469-200d-1f692": [["\ud83d\udc69\u200d\ud83d\ude92"], "", "", ["female-firefighter"], 39, 31, 23, 0],
        "1f3c3-200d-2640-fe0f": [["\ud83c\udfc3\u200d\u2640\ufe0f"], "", "", ["woman-running"], 39, 37, 5, 0],
        "1f3c3-200d-2642-fe0f": [["\ud83c\udfc3\u200d\u2642\ufe0f", "\ud83c\udfc3"], "", "", ["man-running", "runner", "running"], 39, 43, 5, 0],
        "1f3c4-200d-2640-fe0f": [["\ud83c\udfc4\u200d\u2640\ufe0f"], "", "", ["woman-surfing"], 40, 0, 5, 0],
        "1f3c4-200d-2642-fe0f": [["\ud83c\udfc4\u200d\u2642\ufe0f", "\ud83c\udfc4"], "", "", ["man-surfing", "surfer"], 40, 6, 5, 0],
        "1f3ca-200d-2640-fe0f": [["\ud83c\udfca\u200d\u2640\ufe0f"], "", "", ["woman-swimming"], 40, 12, 5, 0],
        "1f3ca-200d-2642-fe0f": [["\ud83c\udfca\u200d\u2642\ufe0f", "\ud83c\udfca"], "", "", ["man-swimming", "swimmer"], 40, 18, 5, 0],
        "1f3cb-fe0f-200d-2640-fe0f": [["\ud83c\udfcb\ufe0f\u200d\u2640\ufe0f"], "", "", ["woman-lifting-weights"], 40, 24, 5, 0],
        "1f3cb-fe0f-200d-2642-fe0f": [["\ud83c\udfcb\ufe0f\u200d\u2642\ufe0f", "\ud83c\udfcb\ufe0f", "\ud83c\udfcb"], "", "", ["man-lifting-weights", "weight_lifter"], 40, 30, 5, 0],
        "1f3cc-fe0f-200d-2640-fe0f": [["\ud83c\udfcc\ufe0f\u200d\u2640\ufe0f"], "", "", ["woman-golfing"], 40, 36, 5, 0],
        "1f3cc-fe0f-200d-2642-fe0f": [["\ud83c\udfcc\ufe0f\u200d\u2642\ufe0f", "\ud83c\udfcc\ufe0f", "\ud83c\udfcc"], "", "", ["man-golfing", "golfer"], 40, 42, 5, 0],
        "1f3f3-fe0f-200d-1f308": [["\ud83c\udff3\ufe0f\u200d\ud83c\udf08"], "", "", ["rainbow-flag"], 40, 48, 53, 0],
        "1f441-fe0f-200d-1f5e8-fe0f": [["\ud83d\udc41\ufe0f\u200d\ud83d\udde8\ufe0f"], "", "", ["eye-in-speech-bubble"], 41, 0, 1, 0],
        "1f468-200d-1f466-200d-1f466": [["\ud83d\udc68\u200d\ud83d\udc66\u200d\ud83d\udc66"], "", "", ["man-boy-boy"], 41, 1, 23, 0],
        "1f468-200d-1f467-200d-1f466": [["\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d\udc66"], "", "", ["man-girl-boy"], 41, 2, 23, 0],
        "1f468-200d-1f467-200d-1f467": [["\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d\udc67"], "", "", ["man-girl-girl"], 41, 3, 23, 0],
        "1f468-200d-1f468-200d-1f466": [["\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc66"], "", "", ["man-man-boy"], 41, 4, 63, 0],
        "1f468-200d-1f468-200d-1f466-200d-1f466": [["\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc66\u200d\ud83d\udc66"], "", "", ["man-man-boy-boy"], 41, 5, 63, 0],
        "1f468-200d-1f468-200d-1f467": [["\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc67"], "", "", ["man-man-girl"], 41, 6, 63, 0],
        "1f468-200d-1f468-200d-1f467-200d-1f466": [["\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d\udc66"], "", "", ["man-man-girl-boy"], 41, 7, 63, 0],
        "1f468-200d-1f468-200d-1f467-200d-1f467": [["\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d\udc67"], "", "", ["man-man-girl-girl"], 41, 8, 63, 0],
        "1f468-200d-1f469-200d-1f466": [["\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc66", "\ud83d\udc6a"], "", "", ["man-woman-boy", "family"], 41, 9, 55, 0],
        "1f468-200d-1f469-200d-1f466-200d-1f466": [["\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66"], "", "", ["man-woman-boy-boy"], 41, 10, 63, 0],
        "1f468-200d-1f469-200d-1f467": [["\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67"], "", "", ["man-woman-girl"], 41, 11, 63, 0],
        "1f468-200d-1f469-200d-1f467-200d-1f466": [["\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66"], "", "", ["man-woman-girl-boy"], 41, 12, 63, 0],
        "1f468-200d-1f469-200d-1f467-200d-1f467": [["\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc67"], "", "", ["man-woman-girl-girl"], 41, 13, 63, 0],
        "1f468-200d-2695-fe0f": [["\ud83d\udc68\u200d\u2695\ufe0f"], "", "", ["male-doctor"], 41, 14, 5, 0],
        "1f468-200d-2696-fe0f": [["\ud83d\udc68\u200d\u2696\ufe0f"], "", "", ["male-judge"], 41, 20, 5, 0],
        "1f468-200d-2708-fe0f": [["\ud83d\udc68\u200d\u2708\ufe0f"], "", "", ["male-pilot"], 41, 26, 5, 0],
        "1f468-200d-2764-fe0f-200d-1f468": [["\ud83d\udc68\u200d\u2764\ufe0f\u200d\ud83d\udc68"], "", "", ["man-heart-man"], 41, 32, 53, 0],
        "1f468-200d-2764-fe0f-200d-1f48b-200d-1f468": [["\ud83d\udc68\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d\udc68"], "", "", ["man-kiss-man"], 41, 33, 53, 0],
        "1f469-200d-1f466-200d-1f466": [["\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66"], "", "", ["woman-boy-boy"], 41, 34, 23, 0],
        "1f469-200d-1f467-200d-1f466": [["\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66"], "", "", ["woman-girl-boy"], 41, 35, 23, 0],
        "1f469-200d-1f467-200d-1f467": [["\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc67"], "", "", ["woman-girl-girl"], 41, 36, 23, 0],
        "1f469-200d-1f469-200d-1f466": [["\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc66"], "", "", ["woman-woman-boy"], 41, 37, 63, 0],
        "1f469-200d-1f469-200d-1f466-200d-1f466": [["\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66"], "", "", ["woman-woman-boy-boy"], 41, 38, 63, 0],
        "1f469-200d-1f469-200d-1f467": [["\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc67"], "", "", ["woman-woman-girl"], 41, 39, 63, 0],
        "1f469-200d-1f469-200d-1f467-200d-1f466": [["\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66"], "", "", ["woman-woman-girl-boy"], 41, 40, 63, 0],
        "1f469-200d-1f469-200d-1f467-200d-1f467": [["\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc67"], "", "", ["woman-woman-girl-girl"], 41, 41, 63, 0],
        "1f469-200d-2695-fe0f": [["\ud83d\udc69\u200d\u2695\ufe0f"], "", "", ["female-doctor"], 41, 42, 5, 0],
        "1f469-200d-2696-fe0f": [["\ud83d\udc69\u200d\u2696\ufe0f"], "", "", ["female-judge"], 41, 48, 5, 0],
        "1f469-200d-2708-fe0f": [["\ud83d\udc69\u200d\u2708\ufe0f"], "", "", ["female-pilot"], 42, 5, 5, 0],
        "1f469-200d-2764-fe0f-200d-1f468": [["\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d\udc68", "\ud83d\udc91"], "", "", ["woman-heart-man", "couple_with_heart"], 42, 11, 21, 0],
        "1f469-200d-2764-fe0f-200d-1f469": [["\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d\udc69"], "", "", ["woman-heart-woman"], 42, 12, 53, 0],
        "1f469-200d-2764-fe0f-200d-1f48b-200d-1f468": [["\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d\udc68", "\ud83d\udc8f"], "", "", ["woman-kiss-man", "couplekiss"], 42, 13, 21, 0],
        "1f469-200d-2764-fe0f-200d-1f48b-200d-1f469": [["\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d\udc69"], "", "", ["woman-kiss-woman"], 42, 14, 53, 0],
        "1f46e-200d-2640-fe0f": [["\ud83d\udc6e\u200d\u2640\ufe0f"], "", "", ["female-police-officer"], 42, 15, 5, 0],
        "1f46e-200d-2642-fe0f": [["\ud83d\udc6e\u200d\u2642\ufe0f", "\ud83d\udc6e"], "", "", ["male-police-officer", "cop"], 42, 21, 5, 0],
        "1f46f-200d-2640-fe0f": [["\ud83d\udc6f\u200d\u2640\ufe0f", "\ud83d\udc6f"], "", "", ["woman-with-bunny-ears-partying", "dancers"], 42, 27, 5, 0],
        "1f46f-200d-2642-fe0f": [["\ud83d\udc6f\u200d\u2642\ufe0f"], "", "", ["man-with-bunny-ears-partying"], 42, 28, 5, 0],
        "1f471-200d-2640-fe0f": [["\ud83d\udc71\u200d\u2640\ufe0f"], "", "", ["blond-haired-woman"], 42, 29, 5, 0],
        "1f471-200d-2642-fe0f": [["\ud83d\udc71\u200d\u2642\ufe0f", "\ud83d\udc71"], "", "", ["blond-haired-man", "person_with_blond_hair"], 42, 35, 5, 0],
        "1f473-200d-2640-fe0f": [["\ud83d\udc73\u200d\u2640\ufe0f"], "", "", ["woman-wearing-turban"], 42, 41, 5, 0],
        "1f473-200d-2642-fe0f": [["\ud83d\udc73\u200d\u2642\ufe0f", "\ud83d\udc73"], "", "", ["man-wearing-turban", "man_with_turban"], 42, 47, 5, 0],
        "1f477-200d-2640-fe0f": [["\ud83d\udc77\u200d\u2640\ufe0f"], "", "", ["female-construction-worker"], 43, 4, 5, 0],
        "1f477-200d-2642-fe0f": [["\ud83d\udc77\u200d\u2642\ufe0f", "\ud83d\udc77"], "", "", ["male-construction-worker", "construction_worker"], 43, 10, 5, 0],
        "1f481-200d-2640-fe0f": [["\ud83d\udc81\u200d\u2640\ufe0f", "\ud83d\udc81"], "", "", ["woman-tipping-hand", "information_desk_person"], 43, 16, 5, 0],
        "1f481-200d-2642-fe0f": [["\ud83d\udc81\u200d\u2642\ufe0f"], "", "", ["man-tipping-hand"], 43, 22, 5, 0],
        "1f482-200d-2640-fe0f": [["\ud83d\udc82\u200d\u2640\ufe0f"], "", "", ["female-guard"], 43, 28, 5, 0],
        "1f482-200d-2642-fe0f": [["\ud83d\udc82\u200d\u2642\ufe0f", "\ud83d\udc82"], "", "", ["male-guard", "guardsman"], 43, 34, 5, 0],
        "1f486-200d-2640-fe0f": [["\ud83d\udc86\u200d\u2640\ufe0f", "\ud83d\udc86"], "", "", ["woman-getting-massage", "massage"], 43, 40, 5, 0],
        "1f486-200d-2642-fe0f": [["\ud83d\udc86\u200d\u2642\ufe0f"], "", "", ["man-getting-massage"], 43, 46, 5, 0],
        "1f487-200d-2640-fe0f": [["\ud83d\udc87\u200d\u2640\ufe0f", "\ud83d\udc87"], "", "", ["woman-getting-haircut", "haircut"], 44, 3, 5, 0],
        "1f487-200d-2642-fe0f": [["\ud83d\udc87\u200d\u2642\ufe0f"], "", "", ["man-getting-haircut"], 44, 9, 5, 0],
        "1f575-fe0f-200d-2640-fe0f": [["\ud83d\udd75\ufe0f\u200d\u2640\ufe0f"], "", "", ["female-detective"], 44, 15, 5, 0],
        "1f575-fe0f-200d-2642-fe0f": [["\ud83d\udd75\ufe0f\u200d\u2642\ufe0f", "\ud83d\udd75\ufe0f", "\ud83d\udd75"], "", "", ["male-detective", "sleuth_or_spy"], 44, 21, 5, 0],
        "1f645-200d-2640-fe0f": [["\ud83d\ude45\u200d\u2640\ufe0f", "\ud83d\ude45"], "", "", ["woman-gesturing-no", "no_good"], 44, 27, 5, 0],
        "1f645-200d-2642-fe0f": [["\ud83d\ude45\u200d\u2642\ufe0f"], "", "", ["man-gesturing-no"], 44, 33, 5, 0],
        "1f646-200d-2640-fe0f": [["\ud83d\ude46\u200d\u2640\ufe0f", "\ud83d\ude46"], "", "", ["woman-gesturing-ok", "ok_woman"], 44, 39, 5, 0],
        "1f646-200d-2642-fe0f": [["\ud83d\ude46\u200d\u2642\ufe0f"], "", "", ["man-gesturing-ok"], 44, 45, 5, 0],
        "1f647-200d-2640-fe0f": [["\ud83d\ude47\u200d\u2640\ufe0f"], "", "", ["woman-bowing"], 45, 2, 5, 0],
        "1f647-200d-2642-fe0f": [["\ud83d\ude47\u200d\u2642\ufe0f", "\ud83d\ude47"], "", "", ["man-bowing", "bow"], 45, 8, 5, 0],
        "1f64b-200d-2640-fe0f": [["\ud83d\ude4b\u200d\u2640\ufe0f", "\ud83d\ude4b"], "", "", ["woman-raising-hand", "raising_hand"], 45, 14, 5, 0],
        "1f64b-200d-2642-fe0f": [["\ud83d\ude4b\u200d\u2642\ufe0f"], "", "", ["man-raising-hand"], 45, 20, 5, 0],
        "1f64d-200d-2640-fe0f": [["\ud83d\ude4d\u200d\u2640\ufe0f", "\ud83d\ude4d"], "", "", ["woman-frowning", "person_frowning"], 45, 26, 5, 0],
        "1f64d-200d-2642-fe0f": [["\ud83d\ude4d\u200d\u2642\ufe0f"], "", "", ["man-frowning"], 45, 32, 5, 0],
        "1f64e-200d-2640-fe0f": [["\ud83d\ude4e\u200d\u2640\ufe0f", "\ud83d\ude4e"], "", "", ["woman-pouting", "person_with_pouting_face"], 45, 38, 5, 0],
        "1f64e-200d-2642-fe0f": [["\ud83d\ude4e\u200d\u2642\ufe0f"], "", "", ["man-pouting"], 45, 44, 5, 0],
        "1f6a3-200d-2640-fe0f": [["\ud83d\udea3\u200d\u2640\ufe0f"], "", "", ["woman-rowing-boat"], 46, 1, 5, 0],
        "1f6a3-200d-2642-fe0f": [["\ud83d\udea3\u200d\u2642\ufe0f", "\ud83d\udea3"], "", "", ["man-rowing-boat", "rowboat"], 46, 7, 5, 0],
        "1f6b4-200d-2640-fe0f": [["\ud83d\udeb4\u200d\u2640\ufe0f"], "", "", ["woman-biking"], 46, 13, 5, 0],
        "1f6b4-200d-2642-fe0f": [["\ud83d\udeb4\u200d\u2642\ufe0f", "\ud83d\udeb4"], "", "", ["man-biking", "bicyclist"], 46, 19, 5, 0],
        "1f6b5-200d-2640-fe0f": [["\ud83d\udeb5\u200d\u2640\ufe0f"], "", "", ["woman-mountain-biking"], 46, 25, 5, 0],
        "1f6b5-200d-2642-fe0f": [["\ud83d\udeb5\u200d\u2642\ufe0f", "\ud83d\udeb5"], "", "", ["man-mountain-biking", "mountain_bicyclist"], 46, 31, 5, 0],
        "1f6b6-200d-2640-fe0f": [["\ud83d\udeb6\u200d\u2640\ufe0f"], "", "", ["woman-walking"], 46, 37, 5, 0],
        "1f6b6-200d-2642-fe0f": [["\ud83d\udeb6\u200d\u2642\ufe0f", "\ud83d\udeb6"], "", "", ["man-walking", "walking"], 46, 43, 5, 0],
        "1f926-200d-2640-fe0f": [["\ud83e\udd26\u200d\u2640\ufe0f"], "", "", ["woman-facepalming"], 47, 0, 5, 0],
        "1f926-200d-2642-fe0f": [["\ud83e\udd26\u200d\u2642\ufe0f"], "", "", ["man-facepalming"], 47, 6, 5, 0],
        "1f937-200d-2640-fe0f": [["\ud83e\udd37\u200d\u2640\ufe0f"], "", "", ["woman-shrugging"], 47, 12, 5, 0],
        "1f937-200d-2642-fe0f": [["\ud83e\udd37\u200d\u2642\ufe0f"], "", "", ["man-shrugging"], 47, 18, 5, 0],
        "1f938-200d-2640-fe0f": [["\ud83e\udd38\u200d\u2640\ufe0f"], "", "", ["woman-cartwheeling"], 47, 24, 5, 0],
        "1f938-200d-2642-fe0f": [["\ud83e\udd38\u200d\u2642\ufe0f"], "", "", ["man-cartwheeling"], 47, 30, 5, 0],
        "1f939-200d-2640-fe0f": [["\ud83e\udd39\u200d\u2640\ufe0f"], "", "", ["woman-juggling"], 47, 36, 5, 0],
        "1f939-200d-2642-fe0f": [["\ud83e\udd39\u200d\u2642\ufe0f"], "", "", ["man-juggling"], 47, 42, 5, 0],
        "1f93c-200d-2640-fe0f": [["\ud83e\udd3c\u200d\u2640\ufe0f"], "", "", ["woman-wrestling"], 47, 48, 5, 0],
        "1f93c-200d-2642-fe0f": [["\ud83e\udd3c\u200d\u2642\ufe0f"], "", "", ["man-wrestling"], 48, 0, 5, 0],
        "1f93d-200d-2640-fe0f": [["\ud83e\udd3d\u200d\u2640\ufe0f"], "", "", ["woman-playing-water-polo"], 48, 1, 5, 0],
        "1f93d-200d-2642-fe0f": [["\ud83e\udd3d\u200d\u2642\ufe0f"], "", "", ["man-playing-water-polo"], 48, 7, 5, 0],
        "1f93e-200d-2640-fe0f": [["\ud83e\udd3e\u200d\u2640\ufe0f"], "", "", ["woman-playing-handball"], 48, 13, 5, 0],
        "1f93e-200d-2642-fe0f": [["\ud83e\udd3e\u200d\u2642\ufe0f"], "", "", ["man-playing-handball"], 48, 19, 5, 0],
        "26f9-fe0f-200d-2640-fe0f": [["\u26f9\ufe0f\u200d\u2640\ufe0f"], "", "", ["woman-bouncing-ball"], 48, 25, 5, 0],
        "26f9-fe0f-200d-2642-fe0f": [["\u26f9\ufe0f\u200d\u2642\ufe0f", "\u26f9\ufe0f", "\u26f9"], "", "", ["man-bouncing-ball", "person_with_ball"], 48, 31, 5, 0]
    }, c.prototype.emoticons_data = {
        "<3": "heart",
        ":o)": "monkey_face",
        "</3": "broken_heart",
        "=)": "smiley",
        "=-)": "smiley",
        "C:": "smile",
        "c:": "smile",
        ":D": "smile",
        ":-D": "smile",
        ":>": "laughing",
        ":->": "laughing",
        ";)": "wink",
        ";-)": "wink",
        "8)": "sunglasses",
        ":|": "neutral_face",
        ":-|": "neutral_face",
        ":\\": "confused",
        ":-\\": "confused",
        ":/": "confused",
        ":-/": "confused",
        ":*": "kissing_heart",
        ":-*": "kissing_heart",
        ":p": "stuck_out_tongue",
        ":-p": "stuck_out_tongue",
        ":P": "stuck_out_tongue",
        ":-P": "stuck_out_tongue",
        ":b": "stuck_out_tongue",
        ":-b": "stuck_out_tongue",
        ";p": "stuck_out_tongue_winking_eye",
        ";-p": "stuck_out_tongue_winking_eye",
        ";b": "stuck_out_tongue_winking_eye",
        ";-b": "stuck_out_tongue_winking_eye",
        ";P": "stuck_out_tongue_winking_eye",
        ";-P": "stuck_out_tongue_winking_eye",
        "):": "disappointed",
        ":(": "disappointed",
        ":-(": "disappointed",
        ">:(": "angry",
        ">:-(": "angry",
        ":'(": "cry",
        "D:": "anguished",
        ":o": "open_mouth",
        ":-o": "open_mouth",
        ":O": "open_mouth",
        ":-O": "open_mouth",
        ":)": "slightly_smiling_face",
        "(:": "slightly_smiling_face",
        ":-)": "slightly_smiling_face"
    }, c.prototype.variations_data = {
        "261d": {
            "1f3fb": ["261d-1f3fb", 1, 3, 63, ["\u261d\ud83c\udffb"]],
            "1f3fc": ["261d-1f3fc", 1, 4, 63, ["\u261d\ud83c\udffc"]],
            "1f3fd": ["261d-1f3fd", 1, 5, 63, ["\u261d\ud83c\udffd"]],
            "1f3fe": ["261d-1f3fe", 1, 6, 63, ["\u261d\ud83c\udffe"]],
            "1f3ff": ["261d-1f3ff", 1, 7, 63, ["\u261d\ud83c\udfff"]]
        },
        "270a": {
            "1f3fb": ["270a-1f3fb", 2, 38, 63, ["\u270a\ud83c\udffb"]],
            "1f3fc": ["270a-1f3fc", 2, 39, 63, ["\u270a\ud83c\udffc"]],
            "1f3fd": ["270a-1f3fd", 2, 40, 63, ["\u270a\ud83c\udffd"]],
            "1f3fe": ["270a-1f3fe", 2, 41, 63, ["\u270a\ud83c\udffe"]],
            "1f3ff": ["270a-1f3ff", 2, 42, 63, ["\u270a\ud83c\udfff"]]
        },
        "270b": {
            "1f3fb": ["270b-1f3fb", 2, 44, 63, ["\u270b\ud83c\udffb"]],
            "1f3fc": ["270b-1f3fc", 2, 45, 63, ["\u270b\ud83c\udffc"]],
            "1f3fd": ["270b-1f3fd", 2, 46, 63, ["\u270b\ud83c\udffd"]],
            "1f3fe": ["270b-1f3fe", 2, 47, 63, ["\u270b\ud83c\udffe"]],
            "1f3ff": ["270b-1f3ff", 2, 48, 63, ["\u270b\ud83c\udfff"]]
        },
        "270c": {
            "1f3fb": ["270c-1f3fb", 3, 1, 63, ["\u270c\ud83c\udffb"]],
            "1f3fc": ["270c-1f3fc", 3, 2, 63, ["\u270c\ud83c\udffc"]],
            "1f3fd": ["270c-1f3fd", 3, 3, 63, ["\u270c\ud83c\udffd"]],
            "1f3fe": ["270c-1f3fe", 3, 4, 63, ["\u270c\ud83c\udffe"]],
            "1f3ff": ["270c-1f3ff", 3, 5, 63, ["\u270c\ud83c\udfff"]]
        },
        "270d": {
            "1f3fb": ["270d-1f3fb", 3, 7, 31, ["\u270d\ud83c\udffb"]],
            "1f3fc": ["270d-1f3fc", 3, 8, 31, ["\u270d\ud83c\udffc"]],
            "1f3fd": ["270d-1f3fd", 3, 9, 31, ["\u270d\ud83c\udffd"]],
            "1f3fe": ["270d-1f3fe", 3, 10, 31, ["\u270d\ud83c\udffe"]],
            "1f3ff": ["270d-1f3ff", 3, 11, 31, ["\u270d\ud83c\udfff"]]
        },
        "1f385": {
            "1f3fb": ["1f385-1f3fb", 7, 18, 63, ["\ud83c\udf85\ud83c\udffb"]],
            "1f3fc": ["1f385-1f3fc", 7, 19, 63, ["\ud83c\udf85\ud83c\udffc"]],
            "1f3fd": ["1f385-1f3fd", 7, 20, 63, ["\ud83c\udf85\ud83c\udffd"]],
            "1f3fe": ["1f385-1f3fe", 7, 21, 63, ["\ud83c\udf85\ud83c\udffe"]],
            "1f3ff": ["1f385-1f3ff", 7, 22, 63, ["\ud83c\udf85\ud83c\udfff"]]
        },
        "1f3c2": {
            "1f3fb": ["1f3c2-1f3fb", 8, 30, 53, ["\ud83c\udfc2\ud83c\udffb"]],
            "1f3fc": ["1f3c2-1f3fc", 8, 31, 53, ["\ud83c\udfc2\ud83c\udffc"]],
            "1f3fd": ["1f3c2-1f3fd", 8, 32, 53, ["\ud83c\udfc2\ud83c\udffd"]],
            "1f3fe": ["1f3c2-1f3fe", 8, 33, 53, ["\ud83c\udfc2\ud83c\udffe"]],
            "1f3ff": ["1f3c2-1f3ff", 8, 34, 53, ["\ud83c\udfc2\ud83c\udfff"]]
        },
        "1f3c7": {
            "1f3fb": ["1f3c7-1f3fb", 9, 1, 61, ["\ud83c\udfc7\ud83c\udffb"]],
            "1f3fc": ["1f3c7-1f3fc", 9, 2, 61, ["\ud83c\udfc7\ud83c\udffc"]],
            "1f3fd": ["1f3c7-1f3fd", 9, 3, 61, ["\ud83c\udfc7\ud83c\udffd"]],
            "1f3fe": ["1f3c7-1f3fe", 9, 4, 61, ["\ud83c\udfc7\ud83c\udffe"]],
            "1f3ff": ["1f3c7-1f3ff", 9, 5, 61, ["\ud83c\udfc7\ud83c\udfff"]]
        },
        "1f442": {
            "1f3fb": ["1f442-1f3fb", 11, 43, 63, ["\ud83d\udc42\ud83c\udffb"]],
            "1f3fc": ["1f442-1f3fc", 11, 44, 63, ["\ud83d\udc42\ud83c\udffc"]],
            "1f3fd": ["1f442-1f3fd", 11, 45, 63, ["\ud83d\udc42\ud83c\udffd"]],
            "1f3fe": ["1f442-1f3fe", 11, 46, 63, ["\ud83d\udc42\ud83c\udffe"]],
            "1f3ff": ["1f442-1f3ff", 11, 47, 63, ["\ud83d\udc42\ud83c\udfff"]]
        },
        "1f443": {
            "1f3fb": ["1f443-1f3fb", 12, 0, 63, ["\ud83d\udc43\ud83c\udffb"]],
            "1f3fc": ["1f443-1f3fc", 12, 1, 63, ["\ud83d\udc43\ud83c\udffc"]],
            "1f3fd": ["1f443-1f3fd", 12, 2, 63, ["\ud83d\udc43\ud83c\udffd"]],
            "1f3fe": ["1f443-1f3fe", 12, 3, 63, ["\ud83d\udc43\ud83c\udffe"]],
            "1f3ff": ["1f443-1f3ff", 12, 4, 63, ["\ud83d\udc43\ud83c\udfff"]]
        },
        "1f446": {
            "1f3fb": ["1f446-1f3fb", 12, 8, 63, ["\ud83d\udc46\ud83c\udffb"]],
            "1f3fc": ["1f446-1f3fc", 12, 9, 63, ["\ud83d\udc46\ud83c\udffc"]],
            "1f3fd": ["1f446-1f3fd", 12, 10, 63, ["\ud83d\udc46\ud83c\udffd"]],
            "1f3fe": ["1f446-1f3fe", 12, 11, 63, ["\ud83d\udc46\ud83c\udffe"]],
            "1f3ff": ["1f446-1f3ff", 12, 12, 63, ["\ud83d\udc46\ud83c\udfff"]]
        },
        "1f447": {
            "1f3fb": ["1f447-1f3fb", 12, 14, 63, ["\ud83d\udc47\ud83c\udffb"]],
            "1f3fc": ["1f447-1f3fc", 12, 15, 63, ["\ud83d\udc47\ud83c\udffc"]],
            "1f3fd": ["1f447-1f3fd", 12, 16, 63, ["\ud83d\udc47\ud83c\udffd"]],
            "1f3fe": ["1f447-1f3fe", 12, 17, 63, ["\ud83d\udc47\ud83c\udffe"]],
            "1f3ff": ["1f447-1f3ff", 12, 18, 63, ["\ud83d\udc47\ud83c\udfff"]]
        },
        "1f448": {
            "1f3fb": ["1f448-1f3fb", 12, 20, 63, ["\ud83d\udc48\ud83c\udffb"]],
            "1f3fc": ["1f448-1f3fc", 12, 21, 63, ["\ud83d\udc48\ud83c\udffc"]],
            "1f3fd": ["1f448-1f3fd", 12, 22, 63, ["\ud83d\udc48\ud83c\udffd"]],
            "1f3fe": ["1f448-1f3fe", 12, 23, 63, ["\ud83d\udc48\ud83c\udffe"]],
            "1f3ff": ["1f448-1f3ff", 12, 24, 63, ["\ud83d\udc48\ud83c\udfff"]]
        },
        "1f449": {
            "1f3fb": ["1f449-1f3fb", 12, 26, 63, ["\ud83d\udc49\ud83c\udffb"]],
            "1f3fc": ["1f449-1f3fc", 12, 27, 63, ["\ud83d\udc49\ud83c\udffc"]],
            "1f3fd": ["1f449-1f3fd", 12, 28, 63, ["\ud83d\udc49\ud83c\udffd"]],
            "1f3fe": ["1f449-1f3fe", 12, 29, 63, ["\ud83d\udc49\ud83c\udffe"]],
            "1f3ff": ["1f449-1f3ff", 12, 30, 63, ["\ud83d\udc49\ud83c\udfff"]]
        },
        "1f44a": {
            "1f3fb": ["1f44a-1f3fb", 12, 32, 63, ["\ud83d\udc4a\ud83c\udffb"]],
            "1f3fc": ["1f44a-1f3fc", 12, 33, 63, ["\ud83d\udc4a\ud83c\udffc"]],
            "1f3fd": ["1f44a-1f3fd", 12, 34, 63, ["\ud83d\udc4a\ud83c\udffd"]],
            "1f3fe": ["1f44a-1f3fe", 12, 35, 63, ["\ud83d\udc4a\ud83c\udffe"]],
            "1f3ff": ["1f44a-1f3ff", 12, 36, 63, ["\ud83d\udc4a\ud83c\udfff"]]
        },
        "1f44b": {
            "1f3fb": ["1f44b-1f3fb", 12, 38, 63, ["\ud83d\udc4b\ud83c\udffb"]],
            "1f3fc": ["1f44b-1f3fc", 12, 39, 63, ["\ud83d\udc4b\ud83c\udffc"]],
            "1f3fd": ["1f44b-1f3fd", 12, 40, 63, ["\ud83d\udc4b\ud83c\udffd"]],
            "1f3fe": ["1f44b-1f3fe", 12, 41, 63, ["\ud83d\udc4b\ud83c\udffe"]],
            "1f3ff": ["1f44b-1f3ff", 12, 42, 63, ["\ud83d\udc4b\ud83c\udfff"]]
        },
        "1f44c": {
            "1f3fb": ["1f44c-1f3fb", 12, 44, 63, ["\ud83d\udc4c\ud83c\udffb"]],
            "1f3fc": ["1f44c-1f3fc", 12, 45, 63, ["\ud83d\udc4c\ud83c\udffc"]],
            "1f3fd": ["1f44c-1f3fd", 12, 46, 63, ["\ud83d\udc4c\ud83c\udffd"]],
            "1f3fe": ["1f44c-1f3fe", 12, 47, 63, ["\ud83d\udc4c\ud83c\udffe"]],
            "1f3ff": ["1f44c-1f3ff", 12, 48, 63, ["\ud83d\udc4c\ud83c\udfff"]]
        },
        "1f44d": {
            "1f3fb": ["1f44d-1f3fb", 13, 1, 63, ["\ud83d\udc4d\ud83c\udffb"]],
            "1f3fc": ["1f44d-1f3fc", 13, 2, 63, ["\ud83d\udc4d\ud83c\udffc"]],
            "1f3fd": ["1f44d-1f3fd", 13, 3, 63, ["\ud83d\udc4d\ud83c\udffd"]],
            "1f3fe": ["1f44d-1f3fe", 13, 4, 63, ["\ud83d\udc4d\ud83c\udffe"]],
            "1f3ff": ["1f44d-1f3ff", 13, 5, 63, ["\ud83d\udc4d\ud83c\udfff"]]
        },
        "1f44e": {
            "1f3fb": ["1f44e-1f3fb", 13, 7, 63, ["\ud83d\udc4e\ud83c\udffb"]],
            "1f3fc": ["1f44e-1f3fc", 13, 8, 63, ["\ud83d\udc4e\ud83c\udffc"]],
            "1f3fd": ["1f44e-1f3fd", 13, 9, 63, ["\ud83d\udc4e\ud83c\udffd"]],
            "1f3fe": ["1f44e-1f3fe", 13, 10, 63, ["\ud83d\udc4e\ud83c\udffe"]],
            "1f3ff": ["1f44e-1f3ff", 13, 11, 63, ["\ud83d\udc4e\ud83c\udfff"]]
        },
        "1f44f": {
            "1f3fb": ["1f44f-1f3fb", 13, 13, 63, ["\ud83d\udc4f\ud83c\udffb"]],
            "1f3fc": ["1f44f-1f3fc", 13, 14, 63, ["\ud83d\udc4f\ud83c\udffc"]],
            "1f3fd": ["1f44f-1f3fd", 13, 15, 63, ["\ud83d\udc4f\ud83c\udffd"]],
            "1f3fe": ["1f44f-1f3fe", 13, 16, 63, ["\ud83d\udc4f\ud83c\udffe"]],
            "1f3ff": ["1f44f-1f3ff", 13, 17, 63, ["\ud83d\udc4f\ud83c\udfff"]]
        },
        "1f450": {
            "1f3fb": ["1f450-1f3fb", 13, 19, 63, ["\ud83d\udc50\ud83c\udffb"]],
            "1f3fc": ["1f450-1f3fc", 13, 20, 63, ["\ud83d\udc50\ud83c\udffc"]],
            "1f3fd": ["1f450-1f3fd", 13, 21, 63, ["\ud83d\udc50\ud83c\udffd"]],
            "1f3fe": ["1f450-1f3fe", 13, 22, 63, ["\ud83d\udc50\ud83c\udffe"]],
            "1f3ff": ["1f450-1f3ff", 13, 23, 63, ["\ud83d\udc50\ud83c\udfff"]]
        },
        "1f466": {
            "1f3fb": ["1f466-1f3fb", 13, 46, 63, ["\ud83d\udc66\ud83c\udffb"]],
            "1f3fc": ["1f466-1f3fc", 13, 47, 63, ["\ud83d\udc66\ud83c\udffc"]],
            "1f3fd": ["1f466-1f3fd", 13, 48, 63, ["\ud83d\udc66\ud83c\udffd"]],
            "1f3fe": ["1f466-1f3fe", 14, 0, 63, ["\ud83d\udc66\ud83c\udffe"]],
            "1f3ff": ["1f466-1f3ff", 14, 1, 63, ["\ud83d\udc66\ud83c\udfff"]]
        },
        "1f467": {
            "1f3fb": ["1f467-1f3fb", 14, 3, 63, ["\ud83d\udc67\ud83c\udffb"]],
            "1f3fc": ["1f467-1f3fc", 14, 4, 63, ["\ud83d\udc67\ud83c\udffc"]],
            "1f3fd": ["1f467-1f3fd", 14, 5, 63, ["\ud83d\udc67\ud83c\udffd"]],
            "1f3fe": ["1f467-1f3fe", 14, 6, 63, ["\ud83d\udc67\ud83c\udffe"]],
            "1f3ff": ["1f467-1f3ff", 14, 7, 63, ["\ud83d\udc67\ud83c\udfff"]]
        },
        "1f468": {
            "1f3fb": ["1f468-1f3fb", 14, 9, 63, ["\ud83d\udc68\ud83c\udffb"]],
            "1f3fc": ["1f468-1f3fc", 14, 10, 63, ["\ud83d\udc68\ud83c\udffc"]],
            "1f3fd": ["1f468-1f3fd", 14, 11, 63, ["\ud83d\udc68\ud83c\udffd"]],
            "1f3fe": ["1f468-1f3fe", 14, 12, 63, ["\ud83d\udc68\ud83c\udffe"]],
            "1f3ff": ["1f468-1f3ff", 14, 13, 63, ["\ud83d\udc68\ud83c\udfff"]]
        },
        "1f469": {
            "1f3fb": ["1f469-1f3fb", 14, 15, 63, ["\ud83d\udc69\ud83c\udffb"]],
            "1f3fc": ["1f469-1f3fc", 14, 16, 63, ["\ud83d\udc69\ud83c\udffc"]],
            "1f3fd": ["1f469-1f3fd", 14, 17, 63, ["\ud83d\udc69\ud83c\udffd"]],
            "1f3fe": ["1f469-1f3fe", 14, 18, 63, ["\ud83d\udc69\ud83c\udffe"]],
            "1f3ff": ["1f469-1f3ff", 14, 19, 63, ["\ud83d\udc69\ud83c\udfff"]]
        },
        "1f470": {
            "1f3fb": ["1f470-1f3fb", 14, 32, 63, ["\ud83d\udc70\ud83c\udffb"]],
            "1f3fc": ["1f470-1f3fc", 14, 33, 63, ["\ud83d\udc70\ud83c\udffc"]],
            "1f3fd": ["1f470-1f3fd", 14, 34, 63, ["\ud83d\udc70\ud83c\udffd"]],
            "1f3fe": ["1f470-1f3fe", 14, 35, 63, ["\ud83d\udc70\ud83c\udffe"]],
            "1f3ff": ["1f470-1f3ff", 14, 36, 63, ["\ud83d\udc70\ud83c\udfff"]]
        },
        "1f472": {
            "1f3fb": ["1f472-1f3fb", 14, 44, 63, ["\ud83d\udc72\ud83c\udffb"]],
            "1f3fc": ["1f472-1f3fc", 14, 45, 63, ["\ud83d\udc72\ud83c\udffc"]],
            "1f3fd": ["1f472-1f3fd", 14, 46, 63, ["\ud83d\udc72\ud83c\udffd"]],
            "1f3fe": ["1f472-1f3fe", 14, 47, 63, ["\ud83d\udc72\ud83c\udffe"]],
            "1f3ff": ["1f472-1f3ff", 14, 48, 63, ["\ud83d\udc72\ud83c\udfff"]]
        },
        "1f474": {
            "1f3fb": ["1f474-1f3fb", 15, 7, 63, ["\ud83d\udc74\ud83c\udffb"]],
            "1f3fc": ["1f474-1f3fc", 15, 8, 63, ["\ud83d\udc74\ud83c\udffc"]],
            "1f3fd": ["1f474-1f3fd", 15, 9, 63, ["\ud83d\udc74\ud83c\udffd"]],
            "1f3fe": ["1f474-1f3fe", 15, 10, 63, ["\ud83d\udc74\ud83c\udffe"]],
            "1f3ff": ["1f474-1f3ff", 15, 11, 63, ["\ud83d\udc74\ud83c\udfff"]]
        },
        "1f475": {
            "1f3fb": ["1f475-1f3fb", 15, 13, 63, ["\ud83d\udc75\ud83c\udffb"]],
            "1f3fc": ["1f475-1f3fc", 15, 14, 63, ["\ud83d\udc75\ud83c\udffc"]],
            "1f3fd": ["1f475-1f3fd", 15, 15, 63, ["\ud83d\udc75\ud83c\udffd"]],
            "1f3fe": ["1f475-1f3fe", 15, 16, 63, ["\ud83d\udc75\ud83c\udffe"]],
            "1f3ff": ["1f475-1f3ff", 15, 17, 63, ["\ud83d\udc75\ud83c\udfff"]]
        },
        "1f476": {
            "1f3fb": ["1f476-1f3fb", 15, 19, 63, ["\ud83d\udc76\ud83c\udffb"]],
            "1f3fc": ["1f476-1f3fc", 15, 20, 63, ["\ud83d\udc76\ud83c\udffc"]],
            "1f3fd": ["1f476-1f3fd", 15, 21, 63, ["\ud83d\udc76\ud83c\udffd"]],
            "1f3fe": ["1f476-1f3fe", 15, 22, 63, ["\ud83d\udc76\ud83c\udffe"]],
            "1f3ff": ["1f476-1f3ff", 15, 23, 63, ["\ud83d\udc76\ud83c\udfff"]]
        },
        "1f478": {
            "1f3fb": ["1f478-1f3fb", 15, 31, 63, ["\ud83d\udc78\ud83c\udffb"]],
            "1f3fc": ["1f478-1f3fc", 15, 32, 63, ["\ud83d\udc78\ud83c\udffc"]],
            "1f3fd": ["1f478-1f3fd", 15, 33, 63, ["\ud83d\udc78\ud83c\udffd"]],
            "1f3fe": ["1f478-1f3fe", 15, 34, 63, ["\ud83d\udc78\ud83c\udffe"]],
            "1f3ff": ["1f478-1f3ff", 15, 35, 63, ["\ud83d\udc78\ud83c\udfff"]]
        },
        "1f47c": {
            "1f3fb": ["1f47c-1f3fb", 15, 40, 63, ["\ud83d\udc7c\ud83c\udffb"]],
            "1f3fc": ["1f47c-1f3fc", 15, 41, 63, ["\ud83d\udc7c\ud83c\udffc"]],
            "1f3fd": ["1f47c-1f3fd", 15, 42, 63, ["\ud83d\udc7c\ud83c\udffd"]],
            "1f3fe": ["1f47c-1f3fe", 15, 43, 63, ["\ud83d\udc7c\ud83c\udffe"]],
            "1f3ff": ["1f47c-1f3ff", 15, 44, 63, ["\ud83d\udc7c\ud83c\udfff"]]
        },
        "1f483": {
            "1f3fb": ["1f483-1f3fb", 16, 13, 63, ["\ud83d\udc83\ud83c\udffb"]],
            "1f3fc": ["1f483-1f3fc", 16, 14, 63, ["\ud83d\udc83\ud83c\udffc"]],
            "1f3fd": ["1f483-1f3fd", 16, 15, 63, ["\ud83d\udc83\ud83c\udffd"]],
            "1f3fe": ["1f483-1f3fe", 16, 16, 63, ["\ud83d\udc83\ud83c\udffe"]],
            "1f3ff": ["1f483-1f3ff", 16, 17, 63, ["\ud83d\udc83\ud83c\udfff"]]
        },
        "1f485": {
            "1f3fb": ["1f485-1f3fb", 16, 20, 63, ["\ud83d\udc85\ud83c\udffb"]],
            "1f3fc": ["1f485-1f3fc", 16, 21, 63, ["\ud83d\udc85\ud83c\udffc"]],
            "1f3fd": ["1f485-1f3fd", 16, 22, 63, ["\ud83d\udc85\ud83c\udffd"]],
            "1f3fe": ["1f485-1f3fe", 16, 23, 63, ["\ud83d\udc85\ud83c\udffe"]],
            "1f3ff": ["1f485-1f3ff", 16, 24, 63, ["\ud83d\udc85\ud83c\udfff"]]
        },
        "1f4aa": {
            "1f3fb": ["1f4aa-1f3fb", 17, 23, 63, ["\ud83d\udcaa\ud83c\udffb"]],
            "1f3fc": ["1f4aa-1f3fc", 17, 24, 63, ["\ud83d\udcaa\ud83c\udffc"]],
            "1f3fd": ["1f4aa-1f3fd", 17, 25, 63, ["\ud83d\udcaa\ud83c\udffd"]],
            "1f3fe": ["1f4aa-1f3fe", 17, 26, 63, ["\ud83d\udcaa\ud83c\udffe"]],
            "1f3ff": ["1f4aa-1f3ff", 17, 27, 63, ["\ud83d\udcaa\ud83c\udfff"]]
        },
        "1f574": {
            "1f3fb": ["1f574-1f3fb", 21, 12, 21, ["\ud83d\udd74\ud83c\udffb"]],
            "1f3fc": ["1f574-1f3fc", 21, 13, 21, ["\ud83d\udd74\ud83c\udffc"]],
            "1f3fd": ["1f574-1f3fd", 21, 14, 21, ["\ud83d\udd74\ud83c\udffd"]],
            "1f3fe": ["1f574-1f3fe", 21, 15, 21, ["\ud83d\udd74\ud83c\udffe"]],
            "1f3ff": ["1f574-1f3ff", 21, 16, 21, ["\ud83d\udd74\ud83c\udfff"]]
        },
        "1f57a": {
            "1f3fb": ["1f57a-1f3fb", 21, 28, 31, ["\ud83d\udd7a\ud83c\udffb"]],
            "1f3fc": ["1f57a-1f3fc", 21, 29, 31, ["\ud83d\udd7a\ud83c\udffc"]],
            "1f3fd": ["1f57a-1f3fd", 21, 30, 31, ["\ud83d\udd7a\ud83c\udffd"]],
            "1f3fe": ["1f57a-1f3fe", 21, 31, 31, ["\ud83d\udd7a\ud83c\udffe"]],
            "1f3ff": ["1f57a-1f3ff", 21, 32, 31, ["\ud83d\udd7a\ud83c\udfff"]]
        },
        "1f590": {
            "1f3fb": ["1f590-1f3fb", 21, 39, 31, ["\ud83d\udd90\ud83c\udffb"]],
            "1f3fc": ["1f590-1f3fc", 21, 40, 31, ["\ud83d\udd90\ud83c\udffc"]],
            "1f3fd": ["1f590-1f3fd", 21, 41, 31, ["\ud83d\udd90\ud83c\udffd"]],
            "1f3fe": ["1f590-1f3fe", 21, 42, 31, ["\ud83d\udd90\ud83c\udffe"]],
            "1f3ff": ["1f590-1f3ff", 21, 43, 31, ["\ud83d\udd90\ud83c\udfff"]]
        },
        "1f595": {
            "1f3fb": ["1f595-1f3fb", 21, 45, 31, ["\ud83d\udd95\ud83c\udffb"]],
            "1f3fc": ["1f595-1f3fc", 21, 46, 31, ["\ud83d\udd95\ud83c\udffc"]],
            "1f3fd": ["1f595-1f3fd", 21, 47, 31, ["\ud83d\udd95\ud83c\udffd"]],
            "1f3fe": ["1f595-1f3fe", 21, 48, 31, ["\ud83d\udd95\ud83c\udffe"]],
            "1f3ff": ["1f595-1f3ff", 22, 0, 31, ["\ud83d\udd95\ud83c\udfff"]]
        },
        "1f596": {
            "1f3fb": ["1f596-1f3fb", 22, 2, 31, ["\ud83d\udd96\ud83c\udffb"]],
            "1f3fc": ["1f596-1f3fc", 22, 3, 31, ["\ud83d\udd96\ud83c\udffc"]],
            "1f3fd": ["1f596-1f3fd", 22, 4, 31, ["\ud83d\udd96\ud83c\udffd"]],
            "1f3fe": ["1f596-1f3fe", 22, 5, 31, ["\ud83d\udd96\ud83c\udffe"]],
            "1f3ff": ["1f596-1f3ff", 22, 6, 31, ["\ud83d\udd96\ud83c\udfff"]]
        },
        "1f64c": {
            "1f3fb": ["1f64c-1f3fb", 24, 32, 63, ["\ud83d\ude4c\ud83c\udffb"]],
            "1f3fc": ["1f64c-1f3fc", 24, 33, 63, ["\ud83d\ude4c\ud83c\udffc"]],
            "1f3fd": ["1f64c-1f3fd", 24, 34, 63, ["\ud83d\ude4c\ud83c\udffd"]],
            "1f3fe": ["1f64c-1f3fe", 24, 35, 63, ["\ud83d\ude4c\ud83c\udffe"]],
            "1f3ff": ["1f64c-1f3ff", 24, 36, 63, ["\ud83d\ude4c\ud83c\udfff"]]
        },
        "1f64f": {
            "1f3fb": ["1f64f-1f3fb", 25, 1, 63, ["\ud83d\ude4f\ud83c\udffb"]],
            "1f3fc": ["1f64f-1f3fc", 25, 2, 63, ["\ud83d\ude4f\ud83c\udffc"]],
            "1f3fd": ["1f64f-1f3fd", 25, 3, 63, ["\ud83d\ude4f\ud83c\udffd"]],
            "1f3fe": ["1f64f-1f3fe", 25, 4, 63, ["\ud83d\ude4f\ud83c\udffe"]],
            "1f3ff": ["1f64f-1f3ff", 25, 5, 63, ["\ud83d\ude4f\ud83c\udfff"]]
        },
        "1f6c0": {
            "1f3fb": ["1f6c0-1f3fb", 26, 42, 63, ["\ud83d\udec0\ud83c\udffb"]],
            "1f3fc": ["1f6c0-1f3fc", 26, 43, 63, ["\ud83d\udec0\ud83c\udffc"]],
            "1f3fd": ["1f6c0-1f3fd", 26, 44, 63, ["\ud83d\udec0\ud83c\udffd"]],
            "1f3fe": ["1f6c0-1f3fe", 26, 45, 63, ["\ud83d\udec0\ud83c\udffe"]],
            "1f3ff": ["1f6c0-1f3ff", 26, 46, 63, ["\ud83d\udec0\ud83c\udfff"]]
        },
        "1f6cc": {
            "1f3fb": ["1f6cc-1f3fb", 27, 5, 21, ["\ud83d\udecc\ud83c\udffb"]],
            "1f3fc": ["1f6cc-1f3fc", 27, 6, 21, ["\ud83d\udecc\ud83c\udffc"]],
            "1f3fd": ["1f6cc-1f3fd", 27, 7, 21, ["\ud83d\udecc\ud83c\udffd"]],
            "1f3fe": ["1f6cc-1f3fe", 27, 8, 21, ["\ud83d\udecc\ud83c\udffe"]],
            "1f3ff": ["1f6cc-1f3ff", 27, 9, 21, ["\ud83d\udecc\ud83c\udfff"]]
        },
        "1f918": {
            "1f3fb": ["1f918-1f3fb", 27, 39, 31, ["\ud83e\udd18\ud83c\udffb"]],
            "1f3fc": ["1f918-1f3fc", 27, 40, 31, ["\ud83e\udd18\ud83c\udffc"]],
            "1f3fd": ["1f918-1f3fd", 27, 41, 31, ["\ud83e\udd18\ud83c\udffd"]],
            "1f3fe": ["1f918-1f3fe", 27, 42, 31, ["\ud83e\udd18\ud83c\udffe"]],
            "1f3ff": ["1f918-1f3ff", 27, 43, 31, ["\ud83e\udd18\ud83c\udfff"]]
        },
        "1f919": {
            "1f3fb": ["1f919-1f3fb", 27, 45, 31, ["\ud83e\udd19\ud83c\udffb"]],
            "1f3fc": ["1f919-1f3fc", 27, 46, 31, ["\ud83e\udd19\ud83c\udffc"]],
            "1f3fd": ["1f919-1f3fd", 27, 47, 31, ["\ud83e\udd19\ud83c\udffd"]],
            "1f3fe": ["1f919-1f3fe", 27, 48, 31, ["\ud83e\udd19\ud83c\udffe"]],
            "1f3ff": ["1f919-1f3ff", 28, 0, 31, ["\ud83e\udd19\ud83c\udfff"]]
        },
        "1f91a": {
            "1f3fb": ["1f91a-1f3fb", 28, 2, 31, ["\ud83e\udd1a\ud83c\udffb"]],
            "1f3fc": ["1f91a-1f3fc", 28, 3, 31, ["\ud83e\udd1a\ud83c\udffc"]],
            "1f3fd": ["1f91a-1f3fd", 28, 4, 31, ["\ud83e\udd1a\ud83c\udffd"]],
            "1f3fe": ["1f91a-1f3fe", 28, 5, 31, ["\ud83e\udd1a\ud83c\udffe"]],
            "1f3ff": ["1f91a-1f3ff", 28, 6, 31, ["\ud83e\udd1a\ud83c\udfff"]]
        },
        "1f91b": {
            "1f3fb": ["1f91b-1f3fb", 28, 8, 31, ["\ud83e\udd1b\ud83c\udffb"]],
            "1f3fc": ["1f91b-1f3fc", 28, 9, 31, ["\ud83e\udd1b\ud83c\udffc"]],
            "1f3fd": ["1f91b-1f3fd", 28, 10, 31, ["\ud83e\udd1b\ud83c\udffd"]],
            "1f3fe": ["1f91b-1f3fe", 28, 11, 31, ["\ud83e\udd1b\ud83c\udffe"]],
            "1f3ff": ["1f91b-1f3ff", 28, 12, 31, ["\ud83e\udd1b\ud83c\udfff"]]
        },
        "1f91c": {
            "1f3fb": ["1f91c-1f3fb", 28, 14, 31, ["\ud83e\udd1c\ud83c\udffb"]],
            "1f3fc": ["1f91c-1f3fc", 28, 15, 31, ["\ud83e\udd1c\ud83c\udffc"]],
            "1f3fd": ["1f91c-1f3fd", 28, 16, 31, ["\ud83e\udd1c\ud83c\udffd"]],
            "1f3fe": ["1f91c-1f3fe", 28, 17, 31, ["\ud83e\udd1c\ud83c\udffe"]],
            "1f3ff": ["1f91c-1f3ff", 28, 18, 31, ["\ud83e\udd1c\ud83c\udfff"]]
        },
        "1f91e": {
            "1f3fb": ["1f91e-1f3fb", 28, 21, 31, ["\ud83e\udd1e\ud83c\udffb"]],
            "1f3fc": ["1f91e-1f3fc", 28, 22, 31, ["\ud83e\udd1e\ud83c\udffc"]],
            "1f3fd": ["1f91e-1f3fd", 28, 23, 31, ["\ud83e\udd1e\ud83c\udffd"]],
            "1f3fe": ["1f91e-1f3fe", 28, 24, 31, ["\ud83e\udd1e\ud83c\udffe"]],
            "1f3ff": ["1f91e-1f3ff", 28, 25, 31, ["\ud83e\udd1e\ud83c\udfff"]]
        },
        "1f926": {
            "1f3fb": ["1f926-1f3fb", 28, 33, 31, ["\ud83e\udd26\ud83c\udffb"]],
            "1f3fc": ["1f926-1f3fc", 28, 34, 31, ["\ud83e\udd26\ud83c\udffc"]],
            "1f3fd": ["1f926-1f3fd", 28, 35, 31, ["\ud83e\udd26\ud83c\udffd"]],
            "1f3fe": ["1f926-1f3fe", 28, 36, 31, ["\ud83e\udd26\ud83c\udffe"]],
            "1f3ff": ["1f926-1f3ff", 28, 37, 31, ["\ud83e\udd26\ud83c\udfff"]]
        },
        "1f930": {
            "1f3fb": ["1f930-1f3fb", 28, 40, 31, ["\ud83e\udd30\ud83c\udffb"]],
            "1f3fc": ["1f930-1f3fc", 28, 41, 31, ["\ud83e\udd30\ud83c\udffc"]],
            "1f3fd": ["1f930-1f3fd", 28, 42, 31, ["\ud83e\udd30\ud83c\udffd"]],
            "1f3fe": ["1f930-1f3fe", 28, 43, 31, ["\ud83e\udd30\ud83c\udffe"]],
            "1f3ff": ["1f930-1f3ff", 28, 44, 31, ["\ud83e\udd30\ud83c\udfff"]]
        },
        "1f933": {
            "1f3fb": ["1f933-1f3fb", 28, 46, 31, ["\ud83e\udd33\ud83c\udffb"]],
            "1f3fc": ["1f933-1f3fc", 28, 47, 31, ["\ud83e\udd33\ud83c\udffc"]],
            "1f3fd": ["1f933-1f3fd", 28, 48, 31, ["\ud83e\udd33\ud83c\udffd"]],
            "1f3fe": ["1f933-1f3fe", 29, 0, 31, ["\ud83e\udd33\ud83c\udffe"]],
            "1f3ff": ["1f933-1f3ff", 29, 1, 31, ["\ud83e\udd33\ud83c\udfff"]]
        },
        "1f934": {
            "1f3fb": ["1f934-1f3fb", 29, 3, 31, ["\ud83e\udd34\ud83c\udffb"]],
            "1f3fc": ["1f934-1f3fc", 29, 4, 31, ["\ud83e\udd34\ud83c\udffc"]],
            "1f3fd": ["1f934-1f3fd", 29, 5, 31, ["\ud83e\udd34\ud83c\udffd"]],
            "1f3fe": ["1f934-1f3fe", 29, 6, 31, ["\ud83e\udd34\ud83c\udffe"]],
            "1f3ff": ["1f934-1f3ff", 29, 7, 31, ["\ud83e\udd34\ud83c\udfff"]]
        },
        "1f935": {
            "1f3fb": ["1f935-1f3fb", 29, 9, 31, ["\ud83e\udd35\ud83c\udffb"]],
            "1f3fc": ["1f935-1f3fc", 29, 10, 31, ["\ud83e\udd35\ud83c\udffc"]],
            "1f3fd": ["1f935-1f3fd", 29, 11, 31, ["\ud83e\udd35\ud83c\udffd"]],
            "1f3fe": ["1f935-1f3fe", 29, 12, 31, ["\ud83e\udd35\ud83c\udffe"]],
            "1f3ff": ["1f935-1f3ff", 29, 13, 31, ["\ud83e\udd35\ud83c\udfff"]]
        },
        "1f936": {
            "1f3fb": ["1f936-1f3fb", 29, 15, 31, ["\ud83e\udd36\ud83c\udffb"]],
            "1f3fc": ["1f936-1f3fc", 29, 16, 31, ["\ud83e\udd36\ud83c\udffc"]],
            "1f3fd": ["1f936-1f3fd", 29, 17, 31, ["\ud83e\udd36\ud83c\udffd"]],
            "1f3fe": ["1f936-1f3fe", 29, 18, 31, ["\ud83e\udd36\ud83c\udffe"]],
            "1f3ff": ["1f936-1f3ff", 29, 19, 31, ["\ud83e\udd36\ud83c\udfff"]]
        },
        "1f937": {
            "1f3fb": ["1f937-1f3fb", 29, 21, 31, ["\ud83e\udd37\ud83c\udffb"]],
            "1f3fc": ["1f937-1f3fc", 29, 22, 31, ["\ud83e\udd37\ud83c\udffc"]],
            "1f3fd": ["1f937-1f3fd", 29, 23, 31, ["\ud83e\udd37\ud83c\udffd"]],
            "1f3fe": ["1f937-1f3fe", 29, 24, 31, ["\ud83e\udd37\ud83c\udffe"]],
            "1f3ff": ["1f937-1f3ff", 29, 25, 31, ["\ud83e\udd37\ud83c\udfff"]]
        },
        "1f938": {
            "1f3fb": ["1f938-1f3fb", 29, 27, 31, ["\ud83e\udd38\ud83c\udffb"]],
            "1f3fc": ["1f938-1f3fc", 29, 28, 31, ["\ud83e\udd38\ud83c\udffc"]],
            "1f3fd": ["1f938-1f3fd", 29, 29, 31, ["\ud83e\udd38\ud83c\udffd"]],
            "1f3fe": ["1f938-1f3fe", 29, 30, 31, ["\ud83e\udd38\ud83c\udffe"]],
            "1f3ff": ["1f938-1f3ff", 29, 31, 31, ["\ud83e\udd38\ud83c\udfff"]]
        },
        "1f939": {
            "1f3fb": ["1f939-1f3fb", 29, 33, 31, ["\ud83e\udd39\ud83c\udffb"]],
            "1f3fc": ["1f939-1f3fc", 29, 34, 31, ["\ud83e\udd39\ud83c\udffc"]],
            "1f3fd": ["1f939-1f3fd", 29, 35, 31, ["\ud83e\udd39\ud83c\udffd"]],
            "1f3fe": ["1f939-1f3fe", 29, 36, 31, ["\ud83e\udd39\ud83c\udffe"]],
            "1f3ff": ["1f939-1f3ff", 29, 37, 31, ["\ud83e\udd39\ud83c\udfff"]]
        },
        "1f93d": {
            "1f3fb": ["1f93d-1f3fb", 29, 41, 31, ["\ud83e\udd3d\ud83c\udffb"]],
            "1f3fc": ["1f93d-1f3fc", 29, 42, 31, ["\ud83e\udd3d\ud83c\udffc"]],
            "1f3fd": ["1f93d-1f3fd", 29, 43, 31, ["\ud83e\udd3d\ud83c\udffd"]],
            "1f3fe": ["1f93d-1f3fe", 29, 44, 31, ["\ud83e\udd3d\ud83c\udffe"]],
            "1f3ff": ["1f93d-1f3ff", 29, 45, 31, ["\ud83e\udd3d\ud83c\udfff"]]
        },
        "1f93e": {
            "1f3fb": ["1f93e-1f3fb", 29, 47, 31, ["\ud83e\udd3e\ud83c\udffb"]],
            "1f3fc": ["1f93e-1f3fc", 29, 48, 31, ["\ud83e\udd3e\ud83c\udffc"]],
            "1f3fd": ["1f93e-1f3fd", 30, 0, 31, ["\ud83e\udd3e\ud83c\udffd"]],
            "1f3fe": ["1f93e-1f3fe", 30, 1, 31, ["\ud83e\udd3e\ud83c\udffe"]],
            "1f3ff": ["1f93e-1f3ff", 30, 2, 31, ["\ud83e\udd3e\ud83c\udfff"]]
        },
        "1f468-200d-1f33e": {
            "1f3fb": ["1f468-1f3fb-200d-1f33e", 36, 25, 23, ["\ud83d\udc68\ud83c\udffb\u200d\ud83c\udf3e"]],
            "1f3fc": ["1f468-1f3fc-200d-1f33e", 36, 26, 23, ["\ud83d\udc68\ud83c\udffc\u200d\ud83c\udf3e"]],
            "1f3fd": ["1f468-1f3fd-200d-1f33e", 36, 27, 23, ["\ud83d\udc68\ud83c\udffd\u200d\ud83c\udf3e"]],
            "1f3fe": ["1f468-1f3fe-200d-1f33e", 36, 28, 23, ["\ud83d\udc68\ud83c\udffe\u200d\ud83c\udf3e"]],
            "1f3ff": ["1f468-1f3ff-200d-1f33e", 36, 29, 23, ["\ud83d\udc68\ud83c\udfff\u200d\ud83c\udf3e"]]
        },
        "1f468-200d-1f373": {
            "1f3fb": ["1f468-1f3fb-200d-1f373", 36, 31, 23, ["\ud83d\udc68\ud83c\udffb\u200d\ud83c\udf73"]],
            "1f3fc": ["1f468-1f3fc-200d-1f373", 36, 32, 23, ["\ud83d\udc68\ud83c\udffc\u200d\ud83c\udf73"]],
            "1f3fd": ["1f468-1f3fd-200d-1f373", 36, 33, 23, ["\ud83d\udc68\ud83c\udffd\u200d\ud83c\udf73"]],
            "1f3fe": ["1f468-1f3fe-200d-1f373", 36, 34, 23, ["\ud83d\udc68\ud83c\udffe\u200d\ud83c\udf73"]],
            "1f3ff": ["1f468-1f3ff-200d-1f373", 36, 35, 23, ["\ud83d\udc68\ud83c\udfff\u200d\ud83c\udf73"]]
        },
        "1f468-200d-1f393": {
            "1f3fb": ["1f468-1f3fb-200d-1f393", 36, 37, 23, ["\ud83d\udc68\ud83c\udffb\u200d\ud83c\udf93"]],
            "1f3fc": ["1f468-1f3fc-200d-1f393", 36, 38, 23, ["\ud83d\udc68\ud83c\udffc\u200d\ud83c\udf93"]],
            "1f3fd": ["1f468-1f3fd-200d-1f393", 36, 39, 23, ["\ud83d\udc68\ud83c\udffd\u200d\ud83c\udf93"]],
            "1f3fe": ["1f468-1f3fe-200d-1f393", 36, 40, 23, ["\ud83d\udc68\ud83c\udffe\u200d\ud83c\udf93"]],
            "1f3ff": ["1f468-1f3ff-200d-1f393", 36, 41, 23, ["\ud83d\udc68\ud83c\udfff\u200d\ud83c\udf93"]]
        },
        "1f468-200d-1f3a4": {
            "1f3fb": ["1f468-1f3fb-200d-1f3a4", 36, 43, 23, ["\ud83d\udc68\ud83c\udffb\u200d\ud83c\udfa4"]],
            "1f3fc": ["1f468-1f3fc-200d-1f3a4", 36, 44, 23, ["\ud83d\udc68\ud83c\udffc\u200d\ud83c\udfa4"]],
            "1f3fd": ["1f468-1f3fd-200d-1f3a4", 36, 45, 23, ["\ud83d\udc68\ud83c\udffd\u200d\ud83c\udfa4"]],
            "1f3fe": ["1f468-1f3fe-200d-1f3a4", 36, 46, 23, ["\ud83d\udc68\ud83c\udffe\u200d\ud83c\udfa4"]],
            "1f3ff": ["1f468-1f3ff-200d-1f3a4", 36, 47, 23, ["\ud83d\udc68\ud83c\udfff\u200d\ud83c\udfa4"]]
        },
        "1f468-200d-1f3a8": {
            "1f3fb": ["1f468-1f3fb-200d-1f3a8", 37, 0, 23, ["\ud83d\udc68\ud83c\udffb\u200d\ud83c\udfa8"]],
            "1f3fc": ["1f468-1f3fc-200d-1f3a8", 37, 1, 23, ["\ud83d\udc68\ud83c\udffc\u200d\ud83c\udfa8"]],
            "1f3fd": ["1f468-1f3fd-200d-1f3a8", 37, 2, 23, ["\ud83d\udc68\ud83c\udffd\u200d\ud83c\udfa8"]],
            "1f3fe": ["1f468-1f3fe-200d-1f3a8", 37, 3, 23, ["\ud83d\udc68\ud83c\udffe\u200d\ud83c\udfa8"]],
            "1f3ff": ["1f468-1f3ff-200d-1f3a8", 37, 4, 23, ["\ud83d\udc68\ud83c\udfff\u200d\ud83c\udfa8"]]
        },
        "1f468-200d-1f3eb": {
            "1f3fb": ["1f468-1f3fb-200d-1f3eb", 37, 6, 23, ["\ud83d\udc68\ud83c\udffb\u200d\ud83c\udfeb"]],
            "1f3fc": ["1f468-1f3fc-200d-1f3eb", 37, 7, 23, ["\ud83d\udc68\ud83c\udffc\u200d\ud83c\udfeb"]],
            "1f3fd": ["1f468-1f3fd-200d-1f3eb", 37, 8, 23, ["\ud83d\udc68\ud83c\udffd\u200d\ud83c\udfeb"]],
            "1f3fe": ["1f468-1f3fe-200d-1f3eb", 37, 9, 23, ["\ud83d\udc68\ud83c\udffe\u200d\ud83c\udfeb"]],
            "1f3ff": ["1f468-1f3ff-200d-1f3eb", 37, 10, 23, ["\ud83d\udc68\ud83c\udfff\u200d\ud83c\udfeb"]]
        },
        "1f468-200d-1f3ed": {
            "1f3fb": ["1f468-1f3fb-200d-1f3ed", 37, 12, 23, ["\ud83d\udc68\ud83c\udffb\u200d\ud83c\udfed"]],
            "1f3fc": ["1f468-1f3fc-200d-1f3ed", 37, 13, 23, ["\ud83d\udc68\ud83c\udffc\u200d\ud83c\udfed"]],
            "1f3fd": ["1f468-1f3fd-200d-1f3ed", 37, 14, 23, ["\ud83d\udc68\ud83c\udffd\u200d\ud83c\udfed"]],
            "1f3fe": ["1f468-1f3fe-200d-1f3ed", 37, 15, 23, ["\ud83d\udc68\ud83c\udffe\u200d\ud83c\udfed"]],
            "1f3ff": ["1f468-1f3ff-200d-1f3ed", 37, 16, 23, ["\ud83d\udc68\ud83c\udfff\u200d\ud83c\udfed"]]
        },
        "1f468-200d-1f4bb": {
            "1f3fb": ["1f468-1f3fb-200d-1f4bb", 37, 20, 23, ["\ud83d\udc68\ud83c\udffb\u200d\ud83d\udcbb"]],
            "1f3fc": ["1f468-1f3fc-200d-1f4bb", 37, 21, 23, ["\ud83d\udc68\ud83c\udffc\u200d\ud83d\udcbb"]],
            "1f3fd": ["1f468-1f3fd-200d-1f4bb", 37, 22, 23, ["\ud83d\udc68\ud83c\udffd\u200d\ud83d\udcbb"]],
            "1f3fe": ["1f468-1f3fe-200d-1f4bb", 37, 23, 23, ["\ud83d\udc68\ud83c\udffe\u200d\ud83d\udcbb"]],
            "1f3ff": ["1f468-1f3ff-200d-1f4bb", 37, 24, 23, ["\ud83d\udc68\ud83c\udfff\u200d\ud83d\udcbb"]]
        },
        "1f468-200d-1f4bc": {
            "1f3fb": ["1f468-1f3fb-200d-1f4bc", 37, 26, 23, ["\ud83d\udc68\ud83c\udffb\u200d\ud83d\udcbc"]],
            "1f3fc": ["1f468-1f3fc-200d-1f4bc", 37, 27, 23, ["\ud83d\udc68\ud83c\udffc\u200d\ud83d\udcbc"]],
            "1f3fd": ["1f468-1f3fd-200d-1f4bc", 37, 28, 23, ["\ud83d\udc68\ud83c\udffd\u200d\ud83d\udcbc"]],
            "1f3fe": ["1f468-1f3fe-200d-1f4bc", 37, 29, 23, ["\ud83d\udc68\ud83c\udffe\u200d\ud83d\udcbc"]],
            "1f3ff": ["1f468-1f3ff-200d-1f4bc", 37, 30, 23, ["\ud83d\udc68\ud83c\udfff\u200d\ud83d\udcbc"]]
        },
        "1f468-200d-1f527": {
            "1f3fb": ["1f468-1f3fb-200d-1f527", 37, 32, 23, ["\ud83d\udc68\ud83c\udffb\u200d\ud83d\udd27"]],
            "1f3fc": ["1f468-1f3fc-200d-1f527", 37, 33, 23, ["\ud83d\udc68\ud83c\udffc\u200d\ud83d\udd27"]],
            "1f3fd": ["1f468-1f3fd-200d-1f527", 37, 34, 23, ["\ud83d\udc68\ud83c\udffd\u200d\ud83d\udd27"]],
            "1f3fe": ["1f468-1f3fe-200d-1f527", 37, 35, 23, ["\ud83d\udc68\ud83c\udffe\u200d\ud83d\udd27"]],
            "1f3ff": ["1f468-1f3ff-200d-1f527", 37, 36, 23, ["\ud83d\udc68\ud83c\udfff\u200d\ud83d\udd27"]]
        },
        "1f468-200d-1f52c": {
            "1f3fb": ["1f468-1f3fb-200d-1f52c", 37, 38, 23, ["\ud83d\udc68\ud83c\udffb\u200d\ud83d\udd2c"]],
            "1f3fc": ["1f468-1f3fc-200d-1f52c", 37, 39, 23, ["\ud83d\udc68\ud83c\udffc\u200d\ud83d\udd2c"]],
            "1f3fd": ["1f468-1f3fd-200d-1f52c", 37, 40, 23, ["\ud83d\udc68\ud83c\udffd\u200d\ud83d\udd2c"]],
            "1f3fe": ["1f468-1f3fe-200d-1f52c", 37, 41, 23, ["\ud83d\udc68\ud83c\udffe\u200d\ud83d\udd2c"]],
            "1f3ff": ["1f468-1f3ff-200d-1f52c", 37, 42, 23, ["\ud83d\udc68\ud83c\udfff\u200d\ud83d\udd2c"]]
        },
        "1f468-200d-1f680": {
            "1f3fb": ["1f468-1f3fb-200d-1f680", 37, 44, 23, ["\ud83d\udc68\ud83c\udffb\u200d\ud83d\ude80"]],
            "1f3fc": ["1f468-1f3fc-200d-1f680", 37, 45, 23, ["\ud83d\udc68\ud83c\udffc\u200d\ud83d\ude80"]],
            "1f3fd": ["1f468-1f3fd-200d-1f680", 37, 46, 23, ["\ud83d\udc68\ud83c\udffd\u200d\ud83d\ude80"]],
            "1f3fe": ["1f468-1f3fe-200d-1f680", 37, 47, 23, ["\ud83d\udc68\ud83c\udffe\u200d\ud83d\ude80"]],
            "1f3ff": ["1f468-1f3ff-200d-1f680", 37, 48, 23, ["\ud83d\udc68\ud83c\udfff\u200d\ud83d\ude80"]]
        },
        "1f468-200d-1f692": {
            "1f3fb": ["1f468-1f3fb-200d-1f692", 38, 1, 23, ["\ud83d\udc68\ud83c\udffb\u200d\ud83d\ude92"]],
            "1f3fc": ["1f468-1f3fc-200d-1f692", 38, 2, 23, ["\ud83d\udc68\ud83c\udffc\u200d\ud83d\ude92"]],
            "1f3fd": ["1f468-1f3fd-200d-1f692", 38, 3, 23, ["\ud83d\udc68\ud83c\udffd\u200d\ud83d\ude92"]],
            "1f3fe": ["1f468-1f3fe-200d-1f692", 38, 4, 23, ["\ud83d\udc68\ud83c\udffe\u200d\ud83d\ude92"]],
            "1f3ff": ["1f468-1f3ff-200d-1f692", 38, 5, 23, ["\ud83d\udc68\ud83c\udfff\u200d\ud83d\ude92"]]
        },
        "1f469-200d-1f33e": {
            "1f3fb": ["1f469-1f3fb-200d-1f33e", 38, 7, 23, ["\ud83d\udc69\ud83c\udffb\u200d\ud83c\udf3e"]],
            "1f3fc": ["1f469-1f3fc-200d-1f33e", 38, 8, 23, ["\ud83d\udc69\ud83c\udffc\u200d\ud83c\udf3e"]],
            "1f3fd": ["1f469-1f3fd-200d-1f33e", 38, 9, 23, ["\ud83d\udc69\ud83c\udffd\u200d\ud83c\udf3e"]],
            "1f3fe": ["1f469-1f3fe-200d-1f33e", 38, 10, 23, ["\ud83d\udc69\ud83c\udffe\u200d\ud83c\udf3e"]],
            "1f3ff": ["1f469-1f3ff-200d-1f33e", 38, 11, 23, ["\ud83d\udc69\ud83c\udfff\u200d\ud83c\udf3e"]]
        },
        "1f469-200d-1f373": {
            "1f3fb": ["1f469-1f3fb-200d-1f373", 38, 13, 23, ["\ud83d\udc69\ud83c\udffb\u200d\ud83c\udf73"]],
            "1f3fc": ["1f469-1f3fc-200d-1f373", 38, 14, 23, ["\ud83d\udc69\ud83c\udffc\u200d\ud83c\udf73"]],
            "1f3fd": ["1f469-1f3fd-200d-1f373", 38, 15, 23, ["\ud83d\udc69\ud83c\udffd\u200d\ud83c\udf73"]],
            "1f3fe": ["1f469-1f3fe-200d-1f373", 38, 16, 23, ["\ud83d\udc69\ud83c\udffe\u200d\ud83c\udf73"]],
            "1f3ff": ["1f469-1f3ff-200d-1f373", 38, 17, 23, ["\ud83d\udc69\ud83c\udfff\u200d\ud83c\udf73"]]
        },
        "1f469-200d-1f393": {
            "1f3fb": ["1f469-1f3fb-200d-1f393", 38, 19, 23, ["\ud83d\udc69\ud83c\udffb\u200d\ud83c\udf93"]],
            "1f3fc": ["1f469-1f3fc-200d-1f393", 38, 20, 23, ["\ud83d\udc69\ud83c\udffc\u200d\ud83c\udf93"]],
            "1f3fd": ["1f469-1f3fd-200d-1f393", 38, 21, 23, ["\ud83d\udc69\ud83c\udffd\u200d\ud83c\udf93"]],
            "1f3fe": ["1f469-1f3fe-200d-1f393", 38, 22, 23, ["\ud83d\udc69\ud83c\udffe\u200d\ud83c\udf93"]],
            "1f3ff": ["1f469-1f3ff-200d-1f393", 38, 23, 23, ["\ud83d\udc69\ud83c\udfff\u200d\ud83c\udf93"]]
        },
        "1f469-200d-1f3a4": {
            "1f3fb": ["1f469-1f3fb-200d-1f3a4", 38, 25, 23, ["\ud83d\udc69\ud83c\udffb\u200d\ud83c\udfa4"]],
            "1f3fc": ["1f469-1f3fc-200d-1f3a4", 38, 26, 23, ["\ud83d\udc69\ud83c\udffc\u200d\ud83c\udfa4"]],
            "1f3fd": ["1f469-1f3fd-200d-1f3a4", 38, 27, 23, ["\ud83d\udc69\ud83c\udffd\u200d\ud83c\udfa4"]],
            "1f3fe": ["1f469-1f3fe-200d-1f3a4", 38, 28, 23, ["\ud83d\udc69\ud83c\udffe\u200d\ud83c\udfa4"]],
            "1f3ff": ["1f469-1f3ff-200d-1f3a4", 38, 29, 23, ["\ud83d\udc69\ud83c\udfff\u200d\ud83c\udfa4"]]
        },
        "1f469-200d-1f3a8": {
            "1f3fb": ["1f469-1f3fb-200d-1f3a8", 38, 31, 23, ["\ud83d\udc69\ud83c\udffb\u200d\ud83c\udfa8"]],
            "1f3fc": ["1f469-1f3fc-200d-1f3a8", 38, 32, 23, ["\ud83d\udc69\ud83c\udffc\u200d\ud83c\udfa8"]],
            "1f3fd": ["1f469-1f3fd-200d-1f3a8", 38, 33, 23, ["\ud83d\udc69\ud83c\udffd\u200d\ud83c\udfa8"]],
            "1f3fe": ["1f469-1f3fe-200d-1f3a8", 38, 34, 23, ["\ud83d\udc69\ud83c\udffe\u200d\ud83c\udfa8"]],
            "1f3ff": ["1f469-1f3ff-200d-1f3a8", 38, 35, 23, ["\ud83d\udc69\ud83c\udfff\u200d\ud83c\udfa8"]]
        },
        "1f469-200d-1f3eb": {
            "1f3fb": ["1f469-1f3fb-200d-1f3eb", 38, 37, 23, ["\ud83d\udc69\ud83c\udffb\u200d\ud83c\udfeb"]],
            "1f3fc": ["1f469-1f3fc-200d-1f3eb", 38, 38, 23, ["\ud83d\udc69\ud83c\udffc\u200d\ud83c\udfeb"]],
            "1f3fd": ["1f469-1f3fd-200d-1f3eb", 38, 39, 23, ["\ud83d\udc69\ud83c\udffd\u200d\ud83c\udfeb"]],
            "1f3fe": ["1f469-1f3fe-200d-1f3eb", 38, 40, 23, ["\ud83d\udc69\ud83c\udffe\u200d\ud83c\udfeb"]],
            "1f3ff": ["1f469-1f3ff-200d-1f3eb", 38, 41, 23, ["\ud83d\udc69\ud83c\udfff\u200d\ud83c\udfeb"]]
        },
        "1f469-200d-1f3ed": {
            "1f3fb": ["1f469-1f3fb-200d-1f3ed", 38, 43, 23, ["\ud83d\udc69\ud83c\udffb\u200d\ud83c\udfed"]],
            "1f3fc": ["1f469-1f3fc-200d-1f3ed", 38, 44, 23, ["\ud83d\udc69\ud83c\udffc\u200d\ud83c\udfed"]],
            "1f3fd": ["1f469-1f3fd-200d-1f3ed", 38, 45, 23, ["\ud83d\udc69\ud83c\udffd\u200d\ud83c\udfed"]],
            "1f3fe": ["1f469-1f3fe-200d-1f3ed", 38, 46, 23, ["\ud83d\udc69\ud83c\udffe\u200d\ud83c\udfed"]],
            "1f3ff": ["1f469-1f3ff-200d-1f3ed", 38, 47, 23, ["\ud83d\udc69\ud83c\udfff\u200d\ud83c\udfed"]]
        },
        "1f469-200d-1f4bb": {
            "1f3fb": ["1f469-1f3fb-200d-1f4bb", 39, 2, 23, ["\ud83d\udc69\ud83c\udffb\u200d\ud83d\udcbb"]],
            "1f3fc": ["1f469-1f3fc-200d-1f4bb", 39, 3, 23, ["\ud83d\udc69\ud83c\udffc\u200d\ud83d\udcbb"]],
            "1f3fd": ["1f469-1f3fd-200d-1f4bb", 39, 4, 23, ["\ud83d\udc69\ud83c\udffd\u200d\ud83d\udcbb"]],
            "1f3fe": ["1f469-1f3fe-200d-1f4bb", 39, 5, 23, ["\ud83d\udc69\ud83c\udffe\u200d\ud83d\udcbb"]],
            "1f3ff": ["1f469-1f3ff-200d-1f4bb", 39, 6, 23, ["\ud83d\udc69\ud83c\udfff\u200d\ud83d\udcbb"]]
        },
        "1f469-200d-1f4bc": {
            "1f3fb": ["1f469-1f3fb-200d-1f4bc", 39, 8, 23, ["\ud83d\udc69\ud83c\udffb\u200d\ud83d\udcbc"]],
            "1f3fc": ["1f469-1f3fc-200d-1f4bc", 39, 9, 23, ["\ud83d\udc69\ud83c\udffc\u200d\ud83d\udcbc"]],
            "1f3fd": ["1f469-1f3fd-200d-1f4bc", 39, 10, 23, ["\ud83d\udc69\ud83c\udffd\u200d\ud83d\udcbc"]],
            "1f3fe": ["1f469-1f3fe-200d-1f4bc", 39, 11, 23, ["\ud83d\udc69\ud83c\udffe\u200d\ud83d\udcbc"]],
            "1f3ff": ["1f469-1f3ff-200d-1f4bc", 39, 12, 23, ["\ud83d\udc69\ud83c\udfff\u200d\ud83d\udcbc"]]
        },
        "1f469-200d-1f527": {
            "1f3fb": ["1f469-1f3fb-200d-1f527", 39, 14, 23, ["\ud83d\udc69\ud83c\udffb\u200d\ud83d\udd27"]],
            "1f3fc": ["1f469-1f3fc-200d-1f527", 39, 15, 23, ["\ud83d\udc69\ud83c\udffc\u200d\ud83d\udd27"]],
            "1f3fd": ["1f469-1f3fd-200d-1f527", 39, 16, 23, ["\ud83d\udc69\ud83c\udffd\u200d\ud83d\udd27"]],
            "1f3fe": ["1f469-1f3fe-200d-1f527", 39, 17, 23, ["\ud83d\udc69\ud83c\udffe\u200d\ud83d\udd27"]],
            "1f3ff": ["1f469-1f3ff-200d-1f527", 39, 18, 23, ["\ud83d\udc69\ud83c\udfff\u200d\ud83d\udd27"]]
        },
        "1f469-200d-1f52c": {
            "1f3fb": ["1f469-1f3fb-200d-1f52c", 39, 20, 23, ["\ud83d\udc69\ud83c\udffb\u200d\ud83d\udd2c"]],
            "1f3fc": ["1f469-1f3fc-200d-1f52c", 39, 21, 23, ["\ud83d\udc69\ud83c\udffc\u200d\ud83d\udd2c"]],
            "1f3fd": ["1f469-1f3fd-200d-1f52c", 39, 22, 23, ["\ud83d\udc69\ud83c\udffd\u200d\ud83d\udd2c"]],
            "1f3fe": ["1f469-1f3fe-200d-1f52c", 39, 23, 23, ["\ud83d\udc69\ud83c\udffe\u200d\ud83d\udd2c"]],
            "1f3ff": ["1f469-1f3ff-200d-1f52c", 39, 24, 23, ["\ud83d\udc69\ud83c\udfff\u200d\ud83d\udd2c"]]
        },
        "1f469-200d-1f680": {
            "1f3fb": ["1f469-1f3fb-200d-1f680", 39, 26, 23, ["\ud83d\udc69\ud83c\udffb\u200d\ud83d\ude80"]],
            "1f3fc": ["1f469-1f3fc-200d-1f680", 39, 27, 23, ["\ud83d\udc69\ud83c\udffc\u200d\ud83d\ude80"]],
            "1f3fd": ["1f469-1f3fd-200d-1f680", 39, 28, 23, ["\ud83d\udc69\ud83c\udffd\u200d\ud83d\ude80"]],
            "1f3fe": ["1f469-1f3fe-200d-1f680", 39, 29, 23, ["\ud83d\udc69\ud83c\udffe\u200d\ud83d\ude80"]],
            "1f3ff": ["1f469-1f3ff-200d-1f680", 39, 30, 23, ["\ud83d\udc69\ud83c\udfff\u200d\ud83d\ude80"]]
        },
        "1f469-200d-1f692": {
            "1f3fb": ["1f469-1f3fb-200d-1f692", 39, 32, 23, ["\ud83d\udc69\ud83c\udffb\u200d\ud83d\ude92"]],
            "1f3fc": ["1f469-1f3fc-200d-1f692", 39, 33, 23, ["\ud83d\udc69\ud83c\udffc\u200d\ud83d\ude92"]],
            "1f3fd": ["1f469-1f3fd-200d-1f692", 39, 34, 23, ["\ud83d\udc69\ud83c\udffd\u200d\ud83d\ude92"]],
            "1f3fe": ["1f469-1f3fe-200d-1f692", 39, 35, 23, ["\ud83d\udc69\ud83c\udffe\u200d\ud83d\ude92"]],
            "1f3ff": ["1f469-1f3ff-200d-1f692", 39, 36, 23, ["\ud83d\udc69\ud83c\udfff\u200d\ud83d\ude92"]]
        },
        "1f3c3-200d-2640-fe0f": {
            "1f3fb": ["1f3c3-1f3fb-200d-2640-fe0f", 39, 38, 5, ["\ud83c\udfc3\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f3c3-1f3fc-200d-2640-fe0f", 39, 39, 5, ["\ud83c\udfc3\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f3c3-1f3fd-200d-2640-fe0f", 39, 40, 5, ["\ud83c\udfc3\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f3c3-1f3fe-200d-2640-fe0f", 39, 41, 5, ["\ud83c\udfc3\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f3c3-1f3ff-200d-2640-fe0f", 39, 42, 5, ["\ud83c\udfc3\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f3c3-200d-2642-fe0f": {
            "1f3fb": ["1f3c3-1f3fb-200d-2642-fe0f", 39, 44, 5, ["\ud83c\udfc3\ud83c\udffb\u200d\u2642\ufe0f", "\ud83c\udfc3\ud83c\udffb"]],
            "1f3fc": ["1f3c3-1f3fc-200d-2642-fe0f", 39, 45, 5, ["\ud83c\udfc3\ud83c\udffc\u200d\u2642\ufe0f", "\ud83c\udfc3\ud83c\udffc"]],
            "1f3fd": ["1f3c3-1f3fd-200d-2642-fe0f", 39, 46, 5, ["\ud83c\udfc3\ud83c\udffd\u200d\u2642\ufe0f", "\ud83c\udfc3\ud83c\udffd"]],
            "1f3fe": ["1f3c3-1f3fe-200d-2642-fe0f", 39, 47, 5, ["\ud83c\udfc3\ud83c\udffe\u200d\u2642\ufe0f", "\ud83c\udfc3\ud83c\udffe"]],
            "1f3ff": ["1f3c3-1f3ff-200d-2642-fe0f", 39, 48, 5, ["\ud83c\udfc3\ud83c\udfff\u200d\u2642\ufe0f", "\ud83c\udfc3\ud83c\udfff"]]
        },
        "1f3c4-200d-2640-fe0f": {
            "1f3fb": ["1f3c4-1f3fb-200d-2640-fe0f", 40, 1, 5, ["\ud83c\udfc4\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f3c4-1f3fc-200d-2640-fe0f", 40, 2, 5, ["\ud83c\udfc4\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f3c4-1f3fd-200d-2640-fe0f", 40, 3, 5, ["\ud83c\udfc4\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f3c4-1f3fe-200d-2640-fe0f", 40, 4, 5, ["\ud83c\udfc4\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f3c4-1f3ff-200d-2640-fe0f", 40, 5, 5, ["\ud83c\udfc4\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f3c4-200d-2642-fe0f": {
            "1f3fb": ["1f3c4-1f3fb-200d-2642-fe0f", 40, 7, 5, ["\ud83c\udfc4\ud83c\udffb\u200d\u2642\ufe0f", "\ud83c\udfc4\ud83c\udffb"]],
            "1f3fc": ["1f3c4-1f3fc-200d-2642-fe0f", 40, 8, 5, ["\ud83c\udfc4\ud83c\udffc\u200d\u2642\ufe0f", "\ud83c\udfc4\ud83c\udffc"]],
            "1f3fd": ["1f3c4-1f3fd-200d-2642-fe0f", 40, 9, 5, ["\ud83c\udfc4\ud83c\udffd\u200d\u2642\ufe0f", "\ud83c\udfc4\ud83c\udffd"]],
            "1f3fe": ["1f3c4-1f3fe-200d-2642-fe0f", 40, 10, 5, ["\ud83c\udfc4\ud83c\udffe\u200d\u2642\ufe0f", "\ud83c\udfc4\ud83c\udffe"]],
            "1f3ff": ["1f3c4-1f3ff-200d-2642-fe0f", 40, 11, 5, ["\ud83c\udfc4\ud83c\udfff\u200d\u2642\ufe0f", "\ud83c\udfc4\ud83c\udfff"]]
        },
        "1f3ca-200d-2640-fe0f": {
            "1f3fb": ["1f3ca-1f3fb-200d-2640-fe0f", 40, 13, 5, ["\ud83c\udfca\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f3ca-1f3fc-200d-2640-fe0f", 40, 14, 5, ["\ud83c\udfca\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f3ca-1f3fd-200d-2640-fe0f", 40, 15, 5, ["\ud83c\udfca\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f3ca-1f3fe-200d-2640-fe0f", 40, 16, 5, ["\ud83c\udfca\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f3ca-1f3ff-200d-2640-fe0f", 40, 17, 5, ["\ud83c\udfca\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f3ca-200d-2642-fe0f": {
            "1f3fb": ["1f3ca-1f3fb-200d-2642-fe0f", 40, 19, 5, ["\ud83c\udfca\ud83c\udffb\u200d\u2642\ufe0f", "\ud83c\udfca\ud83c\udffb"]],
            "1f3fc": ["1f3ca-1f3fc-200d-2642-fe0f", 40, 20, 5, ["\ud83c\udfca\ud83c\udffc\u200d\u2642\ufe0f", "\ud83c\udfca\ud83c\udffc"]],
            "1f3fd": ["1f3ca-1f3fd-200d-2642-fe0f", 40, 21, 5, ["\ud83c\udfca\ud83c\udffd\u200d\u2642\ufe0f", "\ud83c\udfca\ud83c\udffd"]],
            "1f3fe": ["1f3ca-1f3fe-200d-2642-fe0f", 40, 22, 5, ["\ud83c\udfca\ud83c\udffe\u200d\u2642\ufe0f", "\ud83c\udfca\ud83c\udffe"]],
            "1f3ff": ["1f3ca-1f3ff-200d-2642-fe0f", 40, 23, 5, ["\ud83c\udfca\ud83c\udfff\u200d\u2642\ufe0f", "\ud83c\udfca\ud83c\udfff"]]
        },
        "1f3cb-fe0f-200d-2640-fe0f": {
            "1f3fb": ["1f3cb-1f3fb-200d-2640-fe0f", 40, 25, 5, ["\ud83c\udfcb\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f3cb-1f3fc-200d-2640-fe0f", 40, 26, 5, ["\ud83c\udfcb\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f3cb-1f3fd-200d-2640-fe0f", 40, 27, 5, ["\ud83c\udfcb\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f3cb-1f3fe-200d-2640-fe0f", 40, 28, 5, ["\ud83c\udfcb\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f3cb-1f3ff-200d-2640-fe0f", 40, 29, 5, ["\ud83c\udfcb\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f3cb-fe0f-200d-2642-fe0f": {
            "1f3fb": ["1f3cb-1f3fb-200d-2642-fe0f", 40, 31, 5, ["\ud83c\udfcb\ud83c\udffb\u200d\u2642\ufe0f", "\ud83c\udfcb\ud83c\udffb"]],
            "1f3fc": ["1f3cb-1f3fc-200d-2642-fe0f", 40, 32, 5, ["\ud83c\udfcb\ud83c\udffc\u200d\u2642\ufe0f", "\ud83c\udfcb\ud83c\udffc"]],
            "1f3fd": ["1f3cb-1f3fd-200d-2642-fe0f", 40, 33, 5, ["\ud83c\udfcb\ud83c\udffd\u200d\u2642\ufe0f", "\ud83c\udfcb\ud83c\udffd"]],
            "1f3fe": ["1f3cb-1f3fe-200d-2642-fe0f", 40, 34, 5, ["\ud83c\udfcb\ud83c\udffe\u200d\u2642\ufe0f", "\ud83c\udfcb\ud83c\udffe"]],
            "1f3ff": ["1f3cb-1f3ff-200d-2642-fe0f", 40, 35, 5, ["\ud83c\udfcb\ud83c\udfff\u200d\u2642\ufe0f", "\ud83c\udfcb\ud83c\udfff"]]
        },
        "1f3cc-fe0f-200d-2640-fe0f": {
            "1f3fb": ["1f3cc-1f3fb-200d-2640-fe0f", 40, 37, 5, ["\ud83c\udfcc\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f3cc-1f3fc-200d-2640-fe0f", 40, 38, 5, ["\ud83c\udfcc\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f3cc-1f3fd-200d-2640-fe0f", 40, 39, 5, ["\ud83c\udfcc\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f3cc-1f3fe-200d-2640-fe0f", 40, 40, 5, ["\ud83c\udfcc\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f3cc-1f3ff-200d-2640-fe0f", 40, 41, 5, ["\ud83c\udfcc\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f3cc-fe0f-200d-2642-fe0f": {
            "1f3fb": ["1f3cc-1f3fb-200d-2642-fe0f", 40, 43, 5, ["\ud83c\udfcc\ud83c\udffb\u200d\u2642\ufe0f", "\ud83c\udfcc\ud83c\udffb"]],
            "1f3fc": ["1f3cc-1f3fc-200d-2642-fe0f", 40, 44, 5, ["\ud83c\udfcc\ud83c\udffc\u200d\u2642\ufe0f", "\ud83c\udfcc\ud83c\udffc"]],
            "1f3fd": ["1f3cc-1f3fd-200d-2642-fe0f", 40, 45, 5, ["\ud83c\udfcc\ud83c\udffd\u200d\u2642\ufe0f", "\ud83c\udfcc\ud83c\udffd"]],
            "1f3fe": ["1f3cc-1f3fe-200d-2642-fe0f", 40, 46, 5, ["\ud83c\udfcc\ud83c\udffe\u200d\u2642\ufe0f", "\ud83c\udfcc\ud83c\udffe"]],
            "1f3ff": ["1f3cc-1f3ff-200d-2642-fe0f", 40, 47, 5, ["\ud83c\udfcc\ud83c\udfff\u200d\u2642\ufe0f", "\ud83c\udfcc\ud83c\udfff"]]
        },
        "1f468-200d-2695-fe0f": {
            "1f3fb": ["1f468-1f3fb-200d-2695-fe0f", 41, 15, 5, ["\ud83d\udc68\ud83c\udffb\u200d\u2695\ufe0f"]],
            "1f3fc": ["1f468-1f3fc-200d-2695-fe0f", 41, 16, 5, ["\ud83d\udc68\ud83c\udffc\u200d\u2695\ufe0f"]],
            "1f3fd": ["1f468-1f3fd-200d-2695-fe0f", 41, 17, 5, ["\ud83d\udc68\ud83c\udffd\u200d\u2695\ufe0f"]],
            "1f3fe": ["1f468-1f3fe-200d-2695-fe0f", 41, 18, 5, ["\ud83d\udc68\ud83c\udffe\u200d\u2695\ufe0f"]],
            "1f3ff": ["1f468-1f3ff-200d-2695-fe0f", 41, 19, 5, ["\ud83d\udc68\ud83c\udfff\u200d\u2695\ufe0f"]]
        },
        "1f468-200d-2696-fe0f": {
            "1f3fb": ["1f468-1f3fb-200d-2696-fe0f", 41, 21, 5, ["\ud83d\udc68\ud83c\udffb\u200d\u2696\ufe0f"]],
            "1f3fc": ["1f468-1f3fc-200d-2696-fe0f", 41, 22, 5, ["\ud83d\udc68\ud83c\udffc\u200d\u2696\ufe0f"]],
            "1f3fd": ["1f468-1f3fd-200d-2696-fe0f", 41, 23, 5, ["\ud83d\udc68\ud83c\udffd\u200d\u2696\ufe0f"]],
            "1f3fe": ["1f468-1f3fe-200d-2696-fe0f", 41, 24, 5, ["\ud83d\udc68\ud83c\udffe\u200d\u2696\ufe0f"]],
            "1f3ff": ["1f468-1f3ff-200d-2696-fe0f", 41, 25, 5, ["\ud83d\udc68\ud83c\udfff\u200d\u2696\ufe0f"]]
        },
        "1f468-200d-2708-fe0f": {
            "1f3fb": ["1f468-1f3fb-200d-2708-fe0f", 41, 27, 5, ["\ud83d\udc68\ud83c\udffb\u200d\u2708\ufe0f"]],
            "1f3fc": ["1f468-1f3fc-200d-2708-fe0f", 41, 28, 5, ["\ud83d\udc68\ud83c\udffc\u200d\u2708\ufe0f"]],
            "1f3fd": ["1f468-1f3fd-200d-2708-fe0f", 41, 29, 5, ["\ud83d\udc68\ud83c\udffd\u200d\u2708\ufe0f"]],
            "1f3fe": ["1f468-1f3fe-200d-2708-fe0f", 41, 30, 5, ["\ud83d\udc68\ud83c\udffe\u200d\u2708\ufe0f"]],
            "1f3ff": ["1f468-1f3ff-200d-2708-fe0f", 41, 31, 5, ["\ud83d\udc68\ud83c\udfff\u200d\u2708\ufe0f"]]
        },
        "1f469-200d-2695-fe0f": {
            "1f3fb": ["1f469-1f3fb-200d-2695-fe0f", 41, 43, 5, ["\ud83d\udc69\ud83c\udffb\u200d\u2695\ufe0f"]],
            "1f3fc": ["1f469-1f3fc-200d-2695-fe0f", 41, 44, 5, ["\ud83d\udc69\ud83c\udffc\u200d\u2695\ufe0f"]],
            "1f3fd": ["1f469-1f3fd-200d-2695-fe0f", 41, 45, 5, ["\ud83d\udc69\ud83c\udffd\u200d\u2695\ufe0f"]],
            "1f3fe": ["1f469-1f3fe-200d-2695-fe0f", 41, 46, 5, ["\ud83d\udc69\ud83c\udffe\u200d\u2695\ufe0f"]],
            "1f3ff": ["1f469-1f3ff-200d-2695-fe0f", 41, 47, 5, ["\ud83d\udc69\ud83c\udfff\u200d\u2695\ufe0f"]]
        },
        "1f469-200d-2696-fe0f": {
            "1f3fb": ["1f469-1f3fb-200d-2696-fe0f", 42, 0, 5, ["\ud83d\udc69\ud83c\udffb\u200d\u2696\ufe0f"]],
            "1f3fc": ["1f469-1f3fc-200d-2696-fe0f", 42, 1, 5, ["\ud83d\udc69\ud83c\udffc\u200d\u2696\ufe0f"]],
            "1f3fd": ["1f469-1f3fd-200d-2696-fe0f", 42, 2, 5, ["\ud83d\udc69\ud83c\udffd\u200d\u2696\ufe0f"]],
            "1f3fe": ["1f469-1f3fe-200d-2696-fe0f", 42, 3, 5, ["\ud83d\udc69\ud83c\udffe\u200d\u2696\ufe0f"]],
            "1f3ff": ["1f469-1f3ff-200d-2696-fe0f", 42, 4, 5, ["\ud83d\udc69\ud83c\udfff\u200d\u2696\ufe0f"]]
        },
        "1f469-200d-2708-fe0f": {
            "1f3fb": ["1f469-1f3fb-200d-2708-fe0f", 42, 6, 5, ["\ud83d\udc69\ud83c\udffb\u200d\u2708\ufe0f"]],
            "1f3fc": ["1f469-1f3fc-200d-2708-fe0f", 42, 7, 5, ["\ud83d\udc69\ud83c\udffc\u200d\u2708\ufe0f"]],
            "1f3fd": ["1f469-1f3fd-200d-2708-fe0f", 42, 8, 5, ["\ud83d\udc69\ud83c\udffd\u200d\u2708\ufe0f"]],
            "1f3fe": ["1f469-1f3fe-200d-2708-fe0f", 42, 9, 5, ["\ud83d\udc69\ud83c\udffe\u200d\u2708\ufe0f"]],
            "1f3ff": ["1f469-1f3ff-200d-2708-fe0f", 42, 10, 5, ["\ud83d\udc69\ud83c\udfff\u200d\u2708\ufe0f"]]
        },
        "1f46e-200d-2640-fe0f": {
            "1f3fb": ["1f46e-1f3fb-200d-2640-fe0f", 42, 16, 5, ["\ud83d\udc6e\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f46e-1f3fc-200d-2640-fe0f", 42, 17, 5, ["\ud83d\udc6e\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f46e-1f3fd-200d-2640-fe0f", 42, 18, 5, ["\ud83d\udc6e\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f46e-1f3fe-200d-2640-fe0f", 42, 19, 5, ["\ud83d\udc6e\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f46e-1f3ff-200d-2640-fe0f", 42, 20, 5, ["\ud83d\udc6e\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f46e-200d-2642-fe0f": {
            "1f3fb": ["1f46e-1f3fb-200d-2642-fe0f", 42, 22, 5, ["\ud83d\udc6e\ud83c\udffb\u200d\u2642\ufe0f", "\ud83d\udc6e\ud83c\udffb"]],
            "1f3fc": ["1f46e-1f3fc-200d-2642-fe0f", 42, 23, 5, ["\ud83d\udc6e\ud83c\udffc\u200d\u2642\ufe0f", "\ud83d\udc6e\ud83c\udffc"]],
            "1f3fd": ["1f46e-1f3fd-200d-2642-fe0f", 42, 24, 5, ["\ud83d\udc6e\ud83c\udffd\u200d\u2642\ufe0f", "\ud83d\udc6e\ud83c\udffd"]],
            "1f3fe": ["1f46e-1f3fe-200d-2642-fe0f", 42, 25, 5, ["\ud83d\udc6e\ud83c\udffe\u200d\u2642\ufe0f", "\ud83d\udc6e\ud83c\udffe"]],
            "1f3ff": ["1f46e-1f3ff-200d-2642-fe0f", 42, 26, 5, ["\ud83d\udc6e\ud83c\udfff\u200d\u2642\ufe0f", "\ud83d\udc6e\ud83c\udfff"]]
        },
        "1f471-200d-2640-fe0f": {
            "1f3fb": ["1f471-1f3fb-200d-2640-fe0f", 42, 30, 5, ["\ud83d\udc71\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f471-1f3fc-200d-2640-fe0f", 42, 31, 5, ["\ud83d\udc71\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f471-1f3fd-200d-2640-fe0f", 42, 32, 5, ["\ud83d\udc71\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f471-1f3fe-200d-2640-fe0f", 42, 33, 5, ["\ud83d\udc71\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f471-1f3ff-200d-2640-fe0f", 42, 34, 5, ["\ud83d\udc71\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f471-200d-2642-fe0f": {
            "1f3fb": ["1f471-1f3fb-200d-2642-fe0f", 42, 36, 5, ["\ud83d\udc71\ud83c\udffb\u200d\u2642\ufe0f", "\ud83d\udc71\ud83c\udffb"]],
            "1f3fc": ["1f471-1f3fc-200d-2642-fe0f", 42, 37, 5, ["\ud83d\udc71\ud83c\udffc\u200d\u2642\ufe0f", "\ud83d\udc71\ud83c\udffc"]],
            "1f3fd": ["1f471-1f3fd-200d-2642-fe0f", 42, 38, 5, ["\ud83d\udc71\ud83c\udffd\u200d\u2642\ufe0f", "\ud83d\udc71\ud83c\udffd"]],
            "1f3fe": ["1f471-1f3fe-200d-2642-fe0f", 42, 39, 5, ["\ud83d\udc71\ud83c\udffe\u200d\u2642\ufe0f", "\ud83d\udc71\ud83c\udffe"]],
            "1f3ff": ["1f471-1f3ff-200d-2642-fe0f", 42, 40, 5, ["\ud83d\udc71\ud83c\udfff\u200d\u2642\ufe0f", "\ud83d\udc71\ud83c\udfff"]]
        },
        "1f473-200d-2640-fe0f": {
            "1f3fb": ["1f473-1f3fb-200d-2640-fe0f", 42, 42, 5, ["\ud83d\udc73\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f473-1f3fc-200d-2640-fe0f", 42, 43, 5, ["\ud83d\udc73\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f473-1f3fd-200d-2640-fe0f", 42, 44, 5, ["\ud83d\udc73\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f473-1f3fe-200d-2640-fe0f", 42, 45, 5, ["\ud83d\udc73\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f473-1f3ff-200d-2640-fe0f", 42, 46, 5, ["\ud83d\udc73\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f473-200d-2642-fe0f": {
            "1f3fb": ["1f473-1f3fb-200d-2642-fe0f", 42, 48, 5, ["\ud83d\udc73\ud83c\udffb\u200d\u2642\ufe0f", "\ud83d\udc73\ud83c\udffb"]],
            "1f3fc": ["1f473-1f3fc-200d-2642-fe0f", 43, 0, 5, ["\ud83d\udc73\ud83c\udffc\u200d\u2642\ufe0f", "\ud83d\udc73\ud83c\udffc"]],
            "1f3fd": ["1f473-1f3fd-200d-2642-fe0f", 43, 1, 5, ["\ud83d\udc73\ud83c\udffd\u200d\u2642\ufe0f", "\ud83d\udc73\ud83c\udffd"]],
            "1f3fe": ["1f473-1f3fe-200d-2642-fe0f", 43, 2, 5, ["\ud83d\udc73\ud83c\udffe\u200d\u2642\ufe0f", "\ud83d\udc73\ud83c\udffe"]],
            "1f3ff": ["1f473-1f3ff-200d-2642-fe0f", 43, 3, 5, ["\ud83d\udc73\ud83c\udfff\u200d\u2642\ufe0f", "\ud83d\udc73\ud83c\udfff"]]
        },
        "1f477-200d-2640-fe0f": {
            "1f3fb": ["1f477-1f3fb-200d-2640-fe0f", 43, 5, 5, ["\ud83d\udc77\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f477-1f3fc-200d-2640-fe0f", 43, 6, 5, ["\ud83d\udc77\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f477-1f3fd-200d-2640-fe0f", 43, 7, 5, ["\ud83d\udc77\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f477-1f3fe-200d-2640-fe0f", 43, 8, 5, ["\ud83d\udc77\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f477-1f3ff-200d-2640-fe0f", 43, 9, 5, ["\ud83d\udc77\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f477-200d-2642-fe0f": {
            "1f3fb": ["1f477-1f3fb-200d-2642-fe0f", 43, 11, 5, ["\ud83d\udc77\ud83c\udffb\u200d\u2642\ufe0f", "\ud83d\udc77\ud83c\udffb"]],
            "1f3fc": ["1f477-1f3fc-200d-2642-fe0f", 43, 12, 5, ["\ud83d\udc77\ud83c\udffc\u200d\u2642\ufe0f", "\ud83d\udc77\ud83c\udffc"]],
            "1f3fd": ["1f477-1f3fd-200d-2642-fe0f", 43, 13, 5, ["\ud83d\udc77\ud83c\udffd\u200d\u2642\ufe0f", "\ud83d\udc77\ud83c\udffd"]],
            "1f3fe": ["1f477-1f3fe-200d-2642-fe0f", 43, 14, 5, ["\ud83d\udc77\ud83c\udffe\u200d\u2642\ufe0f", "\ud83d\udc77\ud83c\udffe"]],
            "1f3ff": ["1f477-1f3ff-200d-2642-fe0f", 43, 15, 5, ["\ud83d\udc77\ud83c\udfff\u200d\u2642\ufe0f", "\ud83d\udc77\ud83c\udfff"]]
        },
        "1f481-200d-2640-fe0f": {
            "1f3fb": ["1f481-1f3fb-200d-2640-fe0f", 43, 17, 5, ["\ud83d\udc81\ud83c\udffb\u200d\u2640\ufe0f", "\ud83d\udc81\ud83c\udffb"]],
            "1f3fc": ["1f481-1f3fc-200d-2640-fe0f", 43, 18, 5, ["\ud83d\udc81\ud83c\udffc\u200d\u2640\ufe0f", "\ud83d\udc81\ud83c\udffc"]],
            "1f3fd": ["1f481-1f3fd-200d-2640-fe0f", 43, 19, 5, ["\ud83d\udc81\ud83c\udffd\u200d\u2640\ufe0f", "\ud83d\udc81\ud83c\udffd"]],
            "1f3fe": ["1f481-1f3fe-200d-2640-fe0f", 43, 20, 5, ["\ud83d\udc81\ud83c\udffe\u200d\u2640\ufe0f", "\ud83d\udc81\ud83c\udffe"]],
            "1f3ff": ["1f481-1f3ff-200d-2640-fe0f", 43, 21, 5, ["\ud83d\udc81\ud83c\udfff\u200d\u2640\ufe0f", "\ud83d\udc81\ud83c\udfff"]]
        },
        "1f481-200d-2642-fe0f": {
            "1f3fb": ["1f481-1f3fb-200d-2642-fe0f", 43, 23, 5, ["\ud83d\udc81\ud83c\udffb\u200d\u2642\ufe0f"]],
            "1f3fc": ["1f481-1f3fc-200d-2642-fe0f", 43, 24, 5, ["\ud83d\udc81\ud83c\udffc\u200d\u2642\ufe0f"]],
            "1f3fd": ["1f481-1f3fd-200d-2642-fe0f", 43, 25, 5, ["\ud83d\udc81\ud83c\udffd\u200d\u2642\ufe0f"]],
            "1f3fe": ["1f481-1f3fe-200d-2642-fe0f", 43, 26, 5, ["\ud83d\udc81\ud83c\udffe\u200d\u2642\ufe0f"]],
            "1f3ff": ["1f481-1f3ff-200d-2642-fe0f", 43, 27, 5, ["\ud83d\udc81\ud83c\udfff\u200d\u2642\ufe0f"]]
        },
        "1f482-200d-2640-fe0f": {
            "1f3fb": ["1f482-1f3fb-200d-2640-fe0f", 43, 29, 5, ["\ud83d\udc82\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f482-1f3fc-200d-2640-fe0f", 43, 30, 5, ["\ud83d\udc82\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f482-1f3fd-200d-2640-fe0f", 43, 31, 5, ["\ud83d\udc82\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f482-1f3fe-200d-2640-fe0f", 43, 32, 5, ["\ud83d\udc82\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f482-1f3ff-200d-2640-fe0f", 43, 33, 5, ["\ud83d\udc82\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f482-200d-2642-fe0f": {
            "1f3fb": ["1f482-1f3fb-200d-2642-fe0f", 43, 35, 5, ["\ud83d\udc82\ud83c\udffb\u200d\u2642\ufe0f", "\ud83d\udc82\ud83c\udffb"]],
            "1f3fc": ["1f482-1f3fc-200d-2642-fe0f", 43, 36, 5, ["\ud83d\udc82\ud83c\udffc\u200d\u2642\ufe0f", "\ud83d\udc82\ud83c\udffc"]],
            "1f3fd": ["1f482-1f3fd-200d-2642-fe0f", 43, 37, 5, ["\ud83d\udc82\ud83c\udffd\u200d\u2642\ufe0f", "\ud83d\udc82\ud83c\udffd"]],
            "1f3fe": ["1f482-1f3fe-200d-2642-fe0f", 43, 38, 5, ["\ud83d\udc82\ud83c\udffe\u200d\u2642\ufe0f", "\ud83d\udc82\ud83c\udffe"]],
            "1f3ff": ["1f482-1f3ff-200d-2642-fe0f", 43, 39, 5, ["\ud83d\udc82\ud83c\udfff\u200d\u2642\ufe0f", "\ud83d\udc82\ud83c\udfff"]]
        },
        "1f486-200d-2640-fe0f": {
            "1f3fb": ["1f486-1f3fb-200d-2640-fe0f", 43, 41, 5, ["\ud83d\udc86\ud83c\udffb\u200d\u2640\ufe0f", "\ud83d\udc86\ud83c\udffb"]],
            "1f3fc": ["1f486-1f3fc-200d-2640-fe0f", 43, 42, 5, ["\ud83d\udc86\ud83c\udffc\u200d\u2640\ufe0f", "\ud83d\udc86\ud83c\udffc"]],
            "1f3fd": ["1f486-1f3fd-200d-2640-fe0f", 43, 43, 5, ["\ud83d\udc86\ud83c\udffd\u200d\u2640\ufe0f", "\ud83d\udc86\ud83c\udffd"]],
            "1f3fe": ["1f486-1f3fe-200d-2640-fe0f", 43, 44, 5, ["\ud83d\udc86\ud83c\udffe\u200d\u2640\ufe0f", "\ud83d\udc86\ud83c\udffe"]],
            "1f3ff": ["1f486-1f3ff-200d-2640-fe0f", 43, 45, 5, ["\ud83d\udc86\ud83c\udfff\u200d\u2640\ufe0f", "\ud83d\udc86\ud83c\udfff"]]
        },
        "1f486-200d-2642-fe0f": {
            "1f3fb": ["1f486-1f3fb-200d-2642-fe0f", 43, 47, 5, ["\ud83d\udc86\ud83c\udffb\u200d\u2642\ufe0f"]],
            "1f3fc": ["1f486-1f3fc-200d-2642-fe0f", 43, 48, 5, ["\ud83d\udc86\ud83c\udffc\u200d\u2642\ufe0f"]],
            "1f3fd": ["1f486-1f3fd-200d-2642-fe0f", 44, 0, 5, ["\ud83d\udc86\ud83c\udffd\u200d\u2642\ufe0f"]],
            "1f3fe": ["1f486-1f3fe-200d-2642-fe0f", 44, 1, 5, ["\ud83d\udc86\ud83c\udffe\u200d\u2642\ufe0f"]],
            "1f3ff": ["1f486-1f3ff-200d-2642-fe0f", 44, 2, 5, ["\ud83d\udc86\ud83c\udfff\u200d\u2642\ufe0f"]]
        },
        "1f487-200d-2640-fe0f": {
            "1f3fb": ["1f487-1f3fb-200d-2640-fe0f", 44, 4, 5, ["\ud83d\udc87\ud83c\udffb\u200d\u2640\ufe0f", "\ud83d\udc87\ud83c\udffb"]],
            "1f3fc": ["1f487-1f3fc-200d-2640-fe0f", 44, 5, 5, ["\ud83d\udc87\ud83c\udffc\u200d\u2640\ufe0f", "\ud83d\udc87\ud83c\udffc"]],
            "1f3fd": ["1f487-1f3fd-200d-2640-fe0f", 44, 6, 5, ["\ud83d\udc87\ud83c\udffd\u200d\u2640\ufe0f", "\ud83d\udc87\ud83c\udffd"]],
            "1f3fe": ["1f487-1f3fe-200d-2640-fe0f", 44, 7, 5, ["\ud83d\udc87\ud83c\udffe\u200d\u2640\ufe0f", "\ud83d\udc87\ud83c\udffe"]],
            "1f3ff": ["1f487-1f3ff-200d-2640-fe0f", 44, 8, 5, ["\ud83d\udc87\ud83c\udfff\u200d\u2640\ufe0f", "\ud83d\udc87\ud83c\udfff"]]
        },
        "1f487-200d-2642-fe0f": {
            "1f3fb": ["1f487-1f3fb-200d-2642-fe0f", 44, 10, 5, ["\ud83d\udc87\ud83c\udffb\u200d\u2642\ufe0f"]],
            "1f3fc": ["1f487-1f3fc-200d-2642-fe0f", 44, 11, 5, ["\ud83d\udc87\ud83c\udffc\u200d\u2642\ufe0f"]],
            "1f3fd": ["1f487-1f3fd-200d-2642-fe0f", 44, 12, 5, ["\ud83d\udc87\ud83c\udffd\u200d\u2642\ufe0f"]],
            "1f3fe": ["1f487-1f3fe-200d-2642-fe0f", 44, 13, 5, ["\ud83d\udc87\ud83c\udffe\u200d\u2642\ufe0f"]],
            "1f3ff": ["1f487-1f3ff-200d-2642-fe0f", 44, 14, 5, ["\ud83d\udc87\ud83c\udfff\u200d\u2642\ufe0f"]]
        },
        "1f575-fe0f-200d-2640-fe0f": {
            "1f3fb": ["1f575-1f3fb-200d-2640-fe0f", 44, 16, 5, ["\ud83d\udd75\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f575-1f3fc-200d-2640-fe0f", 44, 17, 5, ["\ud83d\udd75\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f575-1f3fd-200d-2640-fe0f", 44, 18, 5, ["\ud83d\udd75\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f575-1f3fe-200d-2640-fe0f", 44, 19, 5, ["\ud83d\udd75\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f575-1f3ff-200d-2640-fe0f", 44, 20, 5, ["\ud83d\udd75\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f575-fe0f-200d-2642-fe0f": {
            "1f3fb": ["1f575-1f3fb-200d-2642-fe0f", 44, 22, 5, ["\ud83d\udd75\ud83c\udffb\u200d\u2642\ufe0f", "\ud83d\udd75\ud83c\udffb"]],
            "1f3fc": ["1f575-1f3fc-200d-2642-fe0f", 44, 23, 5, ["\ud83d\udd75\ud83c\udffc\u200d\u2642\ufe0f", "\ud83d\udd75\ud83c\udffc"]],
            "1f3fd": ["1f575-1f3fd-200d-2642-fe0f", 44, 24, 5, ["\ud83d\udd75\ud83c\udffd\u200d\u2642\ufe0f", "\ud83d\udd75\ud83c\udffd"]],
            "1f3fe": ["1f575-1f3fe-200d-2642-fe0f", 44, 25, 5, ["\ud83d\udd75\ud83c\udffe\u200d\u2642\ufe0f", "\ud83d\udd75\ud83c\udffe"]],
            "1f3ff": ["1f575-1f3ff-200d-2642-fe0f", 44, 26, 5, ["\ud83d\udd75\ud83c\udfff\u200d\u2642\ufe0f", "\ud83d\udd75\ud83c\udfff"]]
        },
        "1f645-200d-2640-fe0f": {
            "1f3fb": ["1f645-1f3fb-200d-2640-fe0f", 44, 28, 5, ["\ud83d\ude45\ud83c\udffb\u200d\u2640\ufe0f", "\ud83d\ude45\ud83c\udffb"]],
            "1f3fc": ["1f645-1f3fc-200d-2640-fe0f", 44, 29, 5, ["\ud83d\ude45\ud83c\udffc\u200d\u2640\ufe0f", "\ud83d\ude45\ud83c\udffc"]],
            "1f3fd": ["1f645-1f3fd-200d-2640-fe0f", 44, 30, 5, ["\ud83d\ude45\ud83c\udffd\u200d\u2640\ufe0f", "\ud83d\ude45\ud83c\udffd"]],
            "1f3fe": ["1f645-1f3fe-200d-2640-fe0f", 44, 31, 5, ["\ud83d\ude45\ud83c\udffe\u200d\u2640\ufe0f", "\ud83d\ude45\ud83c\udffe"]],
            "1f3ff": ["1f645-1f3ff-200d-2640-fe0f", 44, 32, 5, ["\ud83d\ude45\ud83c\udfff\u200d\u2640\ufe0f", "\ud83d\ude45\ud83c\udfff"]]
        },
        "1f645-200d-2642-fe0f": {
            "1f3fb": ["1f645-1f3fb-200d-2642-fe0f", 44, 34, 5, ["\ud83d\ude45\ud83c\udffb\u200d\u2642\ufe0f"]],
            "1f3fc": ["1f645-1f3fc-200d-2642-fe0f", 44, 35, 5, ["\ud83d\ude45\ud83c\udffc\u200d\u2642\ufe0f"]],
            "1f3fd": ["1f645-1f3fd-200d-2642-fe0f", 44, 36, 5, ["\ud83d\ude45\ud83c\udffd\u200d\u2642\ufe0f"]],
            "1f3fe": ["1f645-1f3fe-200d-2642-fe0f", 44, 37, 5, ["\ud83d\ude45\ud83c\udffe\u200d\u2642\ufe0f"]],
            "1f3ff": ["1f645-1f3ff-200d-2642-fe0f", 44, 38, 5, ["\ud83d\ude45\ud83c\udfff\u200d\u2642\ufe0f"]]
        },
        "1f646-200d-2640-fe0f": {
            "1f3fb": ["1f646-1f3fb-200d-2640-fe0f", 44, 40, 5, ["\ud83d\ude46\ud83c\udffb\u200d\u2640\ufe0f", "\ud83d\ude46\ud83c\udffb"]],
            "1f3fc": ["1f646-1f3fc-200d-2640-fe0f", 44, 41, 5, ["\ud83d\ude46\ud83c\udffc\u200d\u2640\ufe0f", "\ud83d\ude46\ud83c\udffc"]],
            "1f3fd": ["1f646-1f3fd-200d-2640-fe0f", 44, 42, 5, ["\ud83d\ude46\ud83c\udffd\u200d\u2640\ufe0f", "\ud83d\ude46\ud83c\udffd"]],
            "1f3fe": ["1f646-1f3fe-200d-2640-fe0f", 44, 43, 5, ["\ud83d\ude46\ud83c\udffe\u200d\u2640\ufe0f", "\ud83d\ude46\ud83c\udffe"]],
            "1f3ff": ["1f646-1f3ff-200d-2640-fe0f", 44, 44, 5, ["\ud83d\ude46\ud83c\udfff\u200d\u2640\ufe0f", "\ud83d\ude46\ud83c\udfff"]]
        },
        "1f646-200d-2642-fe0f": {
            "1f3fb": ["1f646-1f3fb-200d-2642-fe0f", 44, 46, 5, ["\ud83d\ude46\ud83c\udffb\u200d\u2642\ufe0f"]],
            "1f3fc": ["1f646-1f3fc-200d-2642-fe0f", 44, 47, 5, ["\ud83d\ude46\ud83c\udffc\u200d\u2642\ufe0f"]],
            "1f3fd": ["1f646-1f3fd-200d-2642-fe0f", 44, 48, 5, ["\ud83d\ude46\ud83c\udffd\u200d\u2642\ufe0f"]],
            "1f3fe": ["1f646-1f3fe-200d-2642-fe0f", 45, 0, 5, ["\ud83d\ude46\ud83c\udffe\u200d\u2642\ufe0f"]],
            "1f3ff": ["1f646-1f3ff-200d-2642-fe0f", 45, 1, 5, ["\ud83d\ude46\ud83c\udfff\u200d\u2642\ufe0f"]]
        },
        "1f647-200d-2640-fe0f": {
            "1f3fb": ["1f647-1f3fb-200d-2640-fe0f", 45, 3, 5, ["\ud83d\ude47\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f647-1f3fc-200d-2640-fe0f", 45, 4, 5, ["\ud83d\ude47\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f647-1f3fd-200d-2640-fe0f", 45, 5, 5, ["\ud83d\ude47\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f647-1f3fe-200d-2640-fe0f", 45, 6, 5, ["\ud83d\ude47\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f647-1f3ff-200d-2640-fe0f", 45, 7, 5, ["\ud83d\ude47\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f647-200d-2642-fe0f": {
            "1f3fb": ["1f647-1f3fb-200d-2642-fe0f", 45, 9, 5, ["\ud83d\ude47\ud83c\udffb\u200d\u2642\ufe0f", "\ud83d\ude47\ud83c\udffb"]],
            "1f3fc": ["1f647-1f3fc-200d-2642-fe0f", 45, 10, 5, ["\ud83d\ude47\ud83c\udffc\u200d\u2642\ufe0f", "\ud83d\ude47\ud83c\udffc"]],
            "1f3fd": ["1f647-1f3fd-200d-2642-fe0f", 45, 11, 5, ["\ud83d\ude47\ud83c\udffd\u200d\u2642\ufe0f", "\ud83d\ude47\ud83c\udffd"]],
            "1f3fe": ["1f647-1f3fe-200d-2642-fe0f", 45, 12, 5, ["\ud83d\ude47\ud83c\udffe\u200d\u2642\ufe0f", "\ud83d\ude47\ud83c\udffe"]],
            "1f3ff": ["1f647-1f3ff-200d-2642-fe0f", 45, 13, 5, ["\ud83d\ude47\ud83c\udfff\u200d\u2642\ufe0f", "\ud83d\ude47\ud83c\udfff"]]
        },
        "1f64b-200d-2640-fe0f": {
            "1f3fb": ["1f64b-1f3fb-200d-2640-fe0f", 45, 15, 5, ["\ud83d\ude4b\ud83c\udffb\u200d\u2640\ufe0f", "\ud83d\ude4b\ud83c\udffb"]],
            "1f3fc": ["1f64b-1f3fc-200d-2640-fe0f", 45, 16, 5, ["\ud83d\ude4b\ud83c\udffc\u200d\u2640\ufe0f", "\ud83d\ude4b\ud83c\udffc"]],
            "1f3fd": ["1f64b-1f3fd-200d-2640-fe0f", 45, 17, 5, ["\ud83d\ude4b\ud83c\udffd\u200d\u2640\ufe0f", "\ud83d\ude4b\ud83c\udffd"]],
            "1f3fe": ["1f64b-1f3fe-200d-2640-fe0f", 45, 18, 5, ["\ud83d\ude4b\ud83c\udffe\u200d\u2640\ufe0f", "\ud83d\ude4b\ud83c\udffe"]],
            "1f3ff": ["1f64b-1f3ff-200d-2640-fe0f", 45, 19, 5, ["\ud83d\ude4b\ud83c\udfff\u200d\u2640\ufe0f", "\ud83d\ude4b\ud83c\udfff"]]
        },
        "1f64b-200d-2642-fe0f": {
            "1f3fb": ["1f64b-1f3fb-200d-2642-fe0f", 45, 21, 5, ["\ud83d\ude4b\ud83c\udffb\u200d\u2642\ufe0f"]],
            "1f3fc": ["1f64b-1f3fc-200d-2642-fe0f", 45, 22, 5, ["\ud83d\ude4b\ud83c\udffc\u200d\u2642\ufe0f"]],
            "1f3fd": ["1f64b-1f3fd-200d-2642-fe0f", 45, 23, 5, ["\ud83d\ude4b\ud83c\udffd\u200d\u2642\ufe0f"]],
            "1f3fe": ["1f64b-1f3fe-200d-2642-fe0f", 45, 24, 5, ["\ud83d\ude4b\ud83c\udffe\u200d\u2642\ufe0f"]],
            "1f3ff": ["1f64b-1f3ff-200d-2642-fe0f", 45, 25, 5, ["\ud83d\ude4b\ud83c\udfff\u200d\u2642\ufe0f"]]
        },
        "1f64d-200d-2640-fe0f": {
            "1f3fb": ["1f64d-1f3fb-200d-2640-fe0f", 45, 27, 5, ["\ud83d\ude4d\ud83c\udffb\u200d\u2640\ufe0f", "\ud83d\ude4d\ud83c\udffb"]],
            "1f3fc": ["1f64d-1f3fc-200d-2640-fe0f", 45, 28, 5, ["\ud83d\ude4d\ud83c\udffc\u200d\u2640\ufe0f", "\ud83d\ude4d\ud83c\udffc"]],
            "1f3fd": ["1f64d-1f3fd-200d-2640-fe0f", 45, 29, 5, ["\ud83d\ude4d\ud83c\udffd\u200d\u2640\ufe0f", "\ud83d\ude4d\ud83c\udffd"]],
            "1f3fe": ["1f64d-1f3fe-200d-2640-fe0f", 45, 30, 5, ["\ud83d\ude4d\ud83c\udffe\u200d\u2640\ufe0f", "\ud83d\ude4d\ud83c\udffe"]],
            "1f3ff": ["1f64d-1f3ff-200d-2640-fe0f", 45, 31, 5, ["\ud83d\ude4d\ud83c\udfff\u200d\u2640\ufe0f", "\ud83d\ude4d\ud83c\udfff"]]
        },
        "1f64d-200d-2642-fe0f": {
            "1f3fb": ["1f64d-1f3fb-200d-2642-fe0f", 45, 33, 5, ["\ud83d\ude4d\ud83c\udffb\u200d\u2642\ufe0f"]],
            "1f3fc": ["1f64d-1f3fc-200d-2642-fe0f", 45, 34, 5, ["\ud83d\ude4d\ud83c\udffc\u200d\u2642\ufe0f"]],
            "1f3fd": ["1f64d-1f3fd-200d-2642-fe0f", 45, 35, 5, ["\ud83d\ude4d\ud83c\udffd\u200d\u2642\ufe0f"]],
            "1f3fe": ["1f64d-1f3fe-200d-2642-fe0f", 45, 36, 5, ["\ud83d\ude4d\ud83c\udffe\u200d\u2642\ufe0f"]],
            "1f3ff": ["1f64d-1f3ff-200d-2642-fe0f", 45, 37, 5, ["\ud83d\ude4d\ud83c\udfff\u200d\u2642\ufe0f"]]
        },
        "1f64e-200d-2640-fe0f": {
            "1f3fb": ["1f64e-1f3fb-200d-2640-fe0f", 45, 39, 5, ["\ud83d\ude4e\ud83c\udffb\u200d\u2640\ufe0f", "\ud83d\ude4e\ud83c\udffb"]],
            "1f3fc": ["1f64e-1f3fc-200d-2640-fe0f", 45, 40, 5, ["\ud83d\ude4e\ud83c\udffc\u200d\u2640\ufe0f", "\ud83d\ude4e\ud83c\udffc"]],
            "1f3fd": ["1f64e-1f3fd-200d-2640-fe0f", 45, 41, 5, ["\ud83d\ude4e\ud83c\udffd\u200d\u2640\ufe0f", "\ud83d\ude4e\ud83c\udffd"]],
            "1f3fe": ["1f64e-1f3fe-200d-2640-fe0f", 45, 42, 5, ["\ud83d\ude4e\ud83c\udffe\u200d\u2640\ufe0f", "\ud83d\ude4e\ud83c\udffe"]],
            "1f3ff": ["1f64e-1f3ff-200d-2640-fe0f", 45, 43, 5, ["\ud83d\ude4e\ud83c\udfff\u200d\u2640\ufe0f", "\ud83d\ude4e\ud83c\udfff"]]
        },
        "1f64e-200d-2642-fe0f": {
            "1f3fb": ["1f64e-1f3fb-200d-2642-fe0f", 45, 45, 5, ["\ud83d\ude4e\ud83c\udffb\u200d\u2642\ufe0f"]],
            "1f3fc": ["1f64e-1f3fc-200d-2642-fe0f", 45, 46, 5, ["\ud83d\ude4e\ud83c\udffc\u200d\u2642\ufe0f"]],
            "1f3fd": ["1f64e-1f3fd-200d-2642-fe0f", 45, 47, 5, ["\ud83d\ude4e\ud83c\udffd\u200d\u2642\ufe0f"]],
            "1f3fe": ["1f64e-1f3fe-200d-2642-fe0f", 45, 48, 5, ["\ud83d\ude4e\ud83c\udffe\u200d\u2642\ufe0f"]],
            "1f3ff": ["1f64e-1f3ff-200d-2642-fe0f", 46, 0, 5, ["\ud83d\ude4e\ud83c\udfff\u200d\u2642\ufe0f"]]
        },
        "1f6a3-200d-2640-fe0f": {
            "1f3fb": ["1f6a3-1f3fb-200d-2640-fe0f", 46, 2, 5, ["\ud83d\udea3\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f6a3-1f3fc-200d-2640-fe0f", 46, 3, 5, ["\ud83d\udea3\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f6a3-1f3fd-200d-2640-fe0f", 46, 4, 5, ["\ud83d\udea3\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f6a3-1f3fe-200d-2640-fe0f", 46, 5, 5, ["\ud83d\udea3\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f6a3-1f3ff-200d-2640-fe0f", 46, 6, 5, ["\ud83d\udea3\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f6a3-200d-2642-fe0f": {
            "1f3fb": ["1f6a3-1f3fb-200d-2642-fe0f", 46, 8, 5, ["\ud83d\udea3\ud83c\udffb\u200d\u2642\ufe0f", "\ud83d\udea3\ud83c\udffb"]],
            "1f3fc": ["1f6a3-1f3fc-200d-2642-fe0f", 46, 9, 5, ["\ud83d\udea3\ud83c\udffc\u200d\u2642\ufe0f", "\ud83d\udea3\ud83c\udffc"]],
            "1f3fd": ["1f6a3-1f3fd-200d-2642-fe0f", 46, 10, 5, ["\ud83d\udea3\ud83c\udffd\u200d\u2642\ufe0f", "\ud83d\udea3\ud83c\udffd"]],
            "1f3fe": ["1f6a3-1f3fe-200d-2642-fe0f", 46, 11, 5, ["\ud83d\udea3\ud83c\udffe\u200d\u2642\ufe0f", "\ud83d\udea3\ud83c\udffe"]],
            "1f3ff": ["1f6a3-1f3ff-200d-2642-fe0f", 46, 12, 5, ["\ud83d\udea3\ud83c\udfff\u200d\u2642\ufe0f", "\ud83d\udea3\ud83c\udfff"]]
        },
        "1f6b4-200d-2640-fe0f": {
            "1f3fb": ["1f6b4-1f3fb-200d-2640-fe0f", 46, 14, 5, ["\ud83d\udeb4\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f6b4-1f3fc-200d-2640-fe0f", 46, 15, 5, ["\ud83d\udeb4\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f6b4-1f3fd-200d-2640-fe0f", 46, 16, 5, ["\ud83d\udeb4\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f6b4-1f3fe-200d-2640-fe0f", 46, 17, 5, ["\ud83d\udeb4\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f6b4-1f3ff-200d-2640-fe0f", 46, 18, 5, ["\ud83d\udeb4\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f6b4-200d-2642-fe0f": {
            "1f3fb": ["1f6b4-1f3fb-200d-2642-fe0f", 46, 20, 5, ["\ud83d\udeb4\ud83c\udffb\u200d\u2642\ufe0f", "\ud83d\udeb4\ud83c\udffb"]],
            "1f3fc": ["1f6b4-1f3fc-200d-2642-fe0f", 46, 21, 5, ["\ud83d\udeb4\ud83c\udffc\u200d\u2642\ufe0f", "\ud83d\udeb4\ud83c\udffc"]],
            "1f3fd": ["1f6b4-1f3fd-200d-2642-fe0f", 46, 22, 5, ["\ud83d\udeb4\ud83c\udffd\u200d\u2642\ufe0f", "\ud83d\udeb4\ud83c\udffd"]],
            "1f3fe": ["1f6b4-1f3fe-200d-2642-fe0f", 46, 23, 5, ["\ud83d\udeb4\ud83c\udffe\u200d\u2642\ufe0f", "\ud83d\udeb4\ud83c\udffe"]],
            "1f3ff": ["1f6b4-1f3ff-200d-2642-fe0f", 46, 24, 5, ["\ud83d\udeb4\ud83c\udfff\u200d\u2642\ufe0f", "\ud83d\udeb4\ud83c\udfff"]]
        },
        "1f6b5-200d-2640-fe0f": {
            "1f3fb": ["1f6b5-1f3fb-200d-2640-fe0f", 46, 26, 5, ["\ud83d\udeb5\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f6b5-1f3fc-200d-2640-fe0f", 46, 27, 5, ["\ud83d\udeb5\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f6b5-1f3fd-200d-2640-fe0f", 46, 28, 5, ["\ud83d\udeb5\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f6b5-1f3fe-200d-2640-fe0f", 46, 29, 5, ["\ud83d\udeb5\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f6b5-1f3ff-200d-2640-fe0f", 46, 30, 5, ["\ud83d\udeb5\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f6b5-200d-2642-fe0f": {
            "1f3fb": ["1f6b5-1f3fb-200d-2642-fe0f", 46, 32, 5, ["\ud83d\udeb5\ud83c\udffb\u200d\u2642\ufe0f", "\ud83d\udeb5\ud83c\udffb"]],
            "1f3fc": ["1f6b5-1f3fc-200d-2642-fe0f", 46, 33, 5, ["\ud83d\udeb5\ud83c\udffc\u200d\u2642\ufe0f", "\ud83d\udeb5\ud83c\udffc"]],
            "1f3fd": ["1f6b5-1f3fd-200d-2642-fe0f", 46, 34, 5, ["\ud83d\udeb5\ud83c\udffd\u200d\u2642\ufe0f", "\ud83d\udeb5\ud83c\udffd"]],
            "1f3fe": ["1f6b5-1f3fe-200d-2642-fe0f", 46, 35, 5, ["\ud83d\udeb5\ud83c\udffe\u200d\u2642\ufe0f", "\ud83d\udeb5\ud83c\udffe"]],
            "1f3ff": ["1f6b5-1f3ff-200d-2642-fe0f", 46, 36, 5, ["\ud83d\udeb5\ud83c\udfff\u200d\u2642\ufe0f", "\ud83d\udeb5\ud83c\udfff"]]
        },
        "1f6b6-200d-2640-fe0f": {
            "1f3fb": ["1f6b6-1f3fb-200d-2640-fe0f", 46, 38, 5, ["\ud83d\udeb6\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f6b6-1f3fc-200d-2640-fe0f", 46, 39, 5, ["\ud83d\udeb6\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f6b6-1f3fd-200d-2640-fe0f", 46, 40, 5, ["\ud83d\udeb6\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f6b6-1f3fe-200d-2640-fe0f", 46, 41, 5, ["\ud83d\udeb6\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f6b6-1f3ff-200d-2640-fe0f", 46, 42, 5, ["\ud83d\udeb6\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f6b6-200d-2642-fe0f": {
            "1f3fb": ["1f6b6-1f3fb-200d-2642-fe0f", 46, 44, 5, ["\ud83d\udeb6\ud83c\udffb\u200d\u2642\ufe0f", "\ud83d\udeb6\ud83c\udffb"]],
            "1f3fc": ["1f6b6-1f3fc-200d-2642-fe0f", 46, 45, 5, ["\ud83d\udeb6\ud83c\udffc\u200d\u2642\ufe0f", "\ud83d\udeb6\ud83c\udffc"]],
            "1f3fd": ["1f6b6-1f3fd-200d-2642-fe0f", 46, 46, 5, ["\ud83d\udeb6\ud83c\udffd\u200d\u2642\ufe0f", "\ud83d\udeb6\ud83c\udffd"]],
            "1f3fe": ["1f6b6-1f3fe-200d-2642-fe0f", 46, 47, 5, ["\ud83d\udeb6\ud83c\udffe\u200d\u2642\ufe0f", "\ud83d\udeb6\ud83c\udffe"]],
            "1f3ff": ["1f6b6-1f3ff-200d-2642-fe0f", 46, 48, 5, ["\ud83d\udeb6\ud83c\udfff\u200d\u2642\ufe0f", "\ud83d\udeb6\ud83c\udfff"]]
        },
        "1f926-200d-2640-fe0f": {
            "1f3fb": ["1f926-1f3fb-200d-2640-fe0f", 47, 1, 5, ["\ud83e\udd26\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f926-1f3fc-200d-2640-fe0f", 47, 2, 5, ["\ud83e\udd26\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f926-1f3fd-200d-2640-fe0f", 47, 3, 5, ["\ud83e\udd26\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f926-1f3fe-200d-2640-fe0f", 47, 4, 5, ["\ud83e\udd26\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f926-1f3ff-200d-2640-fe0f", 47, 5, 5, ["\ud83e\udd26\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f926-200d-2642-fe0f": {
            "1f3fb": ["1f926-1f3fb-200d-2642-fe0f", 47, 7, 5, ["\ud83e\udd26\ud83c\udffb\u200d\u2642\ufe0f"]],
            "1f3fc": ["1f926-1f3fc-200d-2642-fe0f", 47, 8, 5, ["\ud83e\udd26\ud83c\udffc\u200d\u2642\ufe0f"]],
            "1f3fd": ["1f926-1f3fd-200d-2642-fe0f", 47, 9, 5, ["\ud83e\udd26\ud83c\udffd\u200d\u2642\ufe0f"]],
            "1f3fe": ["1f926-1f3fe-200d-2642-fe0f", 47, 10, 5, ["\ud83e\udd26\ud83c\udffe\u200d\u2642\ufe0f"]],
            "1f3ff": ["1f926-1f3ff-200d-2642-fe0f", 47, 11, 5, ["\ud83e\udd26\ud83c\udfff\u200d\u2642\ufe0f"]]
        },
        "1f937-200d-2640-fe0f": {
            "1f3fb": ["1f937-1f3fb-200d-2640-fe0f", 47, 13, 5, ["\ud83e\udd37\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f937-1f3fc-200d-2640-fe0f", 47, 14, 5, ["\ud83e\udd37\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f937-1f3fd-200d-2640-fe0f", 47, 15, 5, ["\ud83e\udd37\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f937-1f3fe-200d-2640-fe0f", 47, 16, 5, ["\ud83e\udd37\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f937-1f3ff-200d-2640-fe0f", 47, 17, 5, ["\ud83e\udd37\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f937-200d-2642-fe0f": {
            "1f3fb": ["1f937-1f3fb-200d-2642-fe0f", 47, 19, 5, ["\ud83e\udd37\ud83c\udffb\u200d\u2642\ufe0f"]],
            "1f3fc": ["1f937-1f3fc-200d-2642-fe0f", 47, 20, 5, ["\ud83e\udd37\ud83c\udffc\u200d\u2642\ufe0f"]],
            "1f3fd": ["1f937-1f3fd-200d-2642-fe0f", 47, 21, 5, ["\ud83e\udd37\ud83c\udffd\u200d\u2642\ufe0f"]],
            "1f3fe": ["1f937-1f3fe-200d-2642-fe0f", 47, 22, 5, ["\ud83e\udd37\ud83c\udffe\u200d\u2642\ufe0f"]],
            "1f3ff": ["1f937-1f3ff-200d-2642-fe0f", 47, 23, 5, ["\ud83e\udd37\ud83c\udfff\u200d\u2642\ufe0f"]]
        },
        "1f938-200d-2640-fe0f": {
            "1f3fb": ["1f938-1f3fb-200d-2640-fe0f", 47, 25, 5, ["\ud83e\udd38\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f938-1f3fc-200d-2640-fe0f", 47, 26, 5, ["\ud83e\udd38\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f938-1f3fd-200d-2640-fe0f", 47, 27, 5, ["\ud83e\udd38\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f938-1f3fe-200d-2640-fe0f", 47, 28, 5, ["\ud83e\udd38\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f938-1f3ff-200d-2640-fe0f", 47, 29, 5, ["\ud83e\udd38\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f938-200d-2642-fe0f": {
            "1f3fb": ["1f938-1f3fb-200d-2642-fe0f", 47, 31, 5, ["\ud83e\udd38\ud83c\udffb\u200d\u2642\ufe0f"]],
            "1f3fc": ["1f938-1f3fc-200d-2642-fe0f", 47, 32, 5, ["\ud83e\udd38\ud83c\udffc\u200d\u2642\ufe0f"]],
            "1f3fd": ["1f938-1f3fd-200d-2642-fe0f", 47, 33, 5, ["\ud83e\udd38\ud83c\udffd\u200d\u2642\ufe0f"]],
            "1f3fe": ["1f938-1f3fe-200d-2642-fe0f", 47, 34, 5, ["\ud83e\udd38\ud83c\udffe\u200d\u2642\ufe0f"]],
            "1f3ff": ["1f938-1f3ff-200d-2642-fe0f", 47, 35, 5, ["\ud83e\udd38\ud83c\udfff\u200d\u2642\ufe0f"]]
        },
        "1f939-200d-2640-fe0f": {
            "1f3fb": ["1f939-1f3fb-200d-2640-fe0f", 47, 37, 5, ["\ud83e\udd39\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f939-1f3fc-200d-2640-fe0f", 47, 38, 5, ["\ud83e\udd39\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f939-1f3fd-200d-2640-fe0f", 47, 39, 5, ["\ud83e\udd39\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f939-1f3fe-200d-2640-fe0f", 47, 40, 5, ["\ud83e\udd39\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f939-1f3ff-200d-2640-fe0f", 47, 41, 5, ["\ud83e\udd39\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f939-200d-2642-fe0f": {
            "1f3fb": ["1f939-1f3fb-200d-2642-fe0f", 47, 43, 5, ["\ud83e\udd39\ud83c\udffb\u200d\u2642\ufe0f"]],
            "1f3fc": ["1f939-1f3fc-200d-2642-fe0f", 47, 44, 5, ["\ud83e\udd39\ud83c\udffc\u200d\u2642\ufe0f"]],
            "1f3fd": ["1f939-1f3fd-200d-2642-fe0f", 47, 45, 5, ["\ud83e\udd39\ud83c\udffd\u200d\u2642\ufe0f"]],
            "1f3fe": ["1f939-1f3fe-200d-2642-fe0f", 47, 46, 5, ["\ud83e\udd39\ud83c\udffe\u200d\u2642\ufe0f"]],
            "1f3ff": ["1f939-1f3ff-200d-2642-fe0f", 47, 47, 5, ["\ud83e\udd39\ud83c\udfff\u200d\u2642\ufe0f"]]
        },
        "1f93d-200d-2640-fe0f": {
            "1f3fb": ["1f93d-1f3fb-200d-2640-fe0f", 48, 2, 5, ["\ud83e\udd3d\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f93d-1f3fc-200d-2640-fe0f", 48, 3, 5, ["\ud83e\udd3d\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f93d-1f3fd-200d-2640-fe0f", 48, 4, 5, ["\ud83e\udd3d\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f93d-1f3fe-200d-2640-fe0f", 48, 5, 5, ["\ud83e\udd3d\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f93d-1f3ff-200d-2640-fe0f", 48, 6, 5, ["\ud83e\udd3d\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f93d-200d-2642-fe0f": {
            "1f3fb": ["1f93d-1f3fb-200d-2642-fe0f", 48, 8, 5, ["\ud83e\udd3d\ud83c\udffb\u200d\u2642\ufe0f"]],
            "1f3fc": ["1f93d-1f3fc-200d-2642-fe0f", 48, 9, 5, ["\ud83e\udd3d\ud83c\udffc\u200d\u2642\ufe0f"]],
            "1f3fd": ["1f93d-1f3fd-200d-2642-fe0f", 48, 10, 5, ["\ud83e\udd3d\ud83c\udffd\u200d\u2642\ufe0f"]],
            "1f3fe": ["1f93d-1f3fe-200d-2642-fe0f", 48, 11, 5, ["\ud83e\udd3d\ud83c\udffe\u200d\u2642\ufe0f"]],
            "1f3ff": ["1f93d-1f3ff-200d-2642-fe0f", 48, 12, 5, ["\ud83e\udd3d\ud83c\udfff\u200d\u2642\ufe0f"]]
        },
        "1f93e-200d-2640-fe0f": {
            "1f3fb": ["1f93e-1f3fb-200d-2640-fe0f", 48, 14, 5, ["\ud83e\udd3e\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["1f93e-1f3fc-200d-2640-fe0f", 48, 15, 5, ["\ud83e\udd3e\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["1f93e-1f3fd-200d-2640-fe0f", 48, 16, 5, ["\ud83e\udd3e\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["1f93e-1f3fe-200d-2640-fe0f", 48, 17, 5, ["\ud83e\udd3e\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["1f93e-1f3ff-200d-2640-fe0f", 48, 18, 5, ["\ud83e\udd3e\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "1f93e-200d-2642-fe0f": {
            "1f3fb": ["1f93e-1f3fb-200d-2642-fe0f", 48, 20, 5, ["\ud83e\udd3e\ud83c\udffb\u200d\u2642\ufe0f"]],
            "1f3fc": ["1f93e-1f3fc-200d-2642-fe0f", 48, 21, 5, ["\ud83e\udd3e\ud83c\udffc\u200d\u2642\ufe0f"]],
            "1f3fd": ["1f93e-1f3fd-200d-2642-fe0f", 48, 22, 5, ["\ud83e\udd3e\ud83c\udffd\u200d\u2642\ufe0f"]],
            "1f3fe": ["1f93e-1f3fe-200d-2642-fe0f", 48, 23, 5, ["\ud83e\udd3e\ud83c\udffe\u200d\u2642\ufe0f"]],
            "1f3ff": ["1f93e-1f3ff-200d-2642-fe0f", 48, 24, 5, ["\ud83e\udd3e\ud83c\udfff\u200d\u2642\ufe0f"]]
        },
        "26f9-fe0f-200d-2640-fe0f": {
            "1f3fb": ["26f9-1f3fb-200d-2640-fe0f", 48, 26, 5, ["\u26f9\ud83c\udffb\u200d\u2640\ufe0f"]],
            "1f3fc": ["26f9-1f3fc-200d-2640-fe0f", 48, 27, 5, ["\u26f9\ud83c\udffc\u200d\u2640\ufe0f"]],
            "1f3fd": ["26f9-1f3fd-200d-2640-fe0f", 48, 28, 5, ["\u26f9\ud83c\udffd\u200d\u2640\ufe0f"]],
            "1f3fe": ["26f9-1f3fe-200d-2640-fe0f", 48, 29, 5, ["\u26f9\ud83c\udffe\u200d\u2640\ufe0f"]],
            "1f3ff": ["26f9-1f3ff-200d-2640-fe0f", 48, 30, 5, ["\u26f9\ud83c\udfff\u200d\u2640\ufe0f"]]
        },
        "26f9-fe0f-200d-2642-fe0f": {
            "1f3fb": ["26f9-1f3fb-200d-2642-fe0f", 48, 32, 5, ["\u26f9\ud83c\udffb\u200d\u2642\ufe0f", "\u26f9\ud83c\udffb"]],
            "1f3fc": ["26f9-1f3fc-200d-2642-fe0f", 48, 33, 5, ["\u26f9\ud83c\udffc\u200d\u2642\ufe0f", "\u26f9\ud83c\udffc"]],
            "1f3fd": ["26f9-1f3fd-200d-2642-fe0f", 48, 34, 5, ["\u26f9\ud83c\udffd\u200d\u2642\ufe0f", "\u26f9\ud83c\udffd"]],
            "1f3fe": ["26f9-1f3fe-200d-2642-fe0f", 48, 35, 5, ["\u26f9\ud83c\udffe\u200d\u2642\ufe0f", "\u26f9\ud83c\udffe"]],
            "1f3ff": ["26f9-1f3ff-200d-2642-fe0f", 48, 36, 5, ["\u26f9\ud83c\udfff\u200d\u2642\ufe0f", "\u26f9\ud83c\udfff"]]
        }
    }, c.prototype.obsoletes_data = {
        "26f9-fe0f-200d-2642-fe0f": ["26f9", 2, 25, 31],
        "26f9-1f3fb-200d-2642-fe0f": ["26f9-1f3fb", 2, 26, 31],
        "26f9-1f3fc-200d-2642-fe0f": ["26f9-1f3fc", 2, 27, 31],
        "26f9-1f3fd-200d-2642-fe0f": ["26f9-1f3fd", 2, 28, 31],
        "26f9-1f3fe-200d-2642-fe0f": ["26f9-1f3fe", 2, 29, 31],
        "26f9-1f3ff-200d-2642-fe0f": ["26f9-1f3ff", 2, 30, 31],
        "1f3c3-200d-2642-fe0f": ["1f3c3", 8, 35, 63],
        "1f3c3-1f3fb-200d-2642-fe0f": ["1f3c3-1f3fb", 8, 36, 63],
        "1f3c3-1f3fc-200d-2642-fe0f": ["1f3c3-1f3fc", 8, 37, 63],
        "1f3c3-1f3fd-200d-2642-fe0f": ["1f3c3-1f3fd", 8, 38, 63],
        "1f3c3-1f3fe-200d-2642-fe0f": ["1f3c3-1f3fe", 8, 39, 63],
        "1f3c3-1f3ff-200d-2642-fe0f": ["1f3c3-1f3ff", 8, 40, 63],
        "1f3c4-200d-2642-fe0f": ["1f3c4", 8, 41, 63],
        "1f3c4-1f3fb-200d-2642-fe0f": ["1f3c4-1f3fb", 8, 42, 63],
        "1f3c4-1f3fc-200d-2642-fe0f": ["1f3c4-1f3fc", 8, 43, 63],
        "1f3c4-1f3fd-200d-2642-fe0f": ["1f3c4-1f3fd", 8, 44, 63],
        "1f3c4-1f3fe-200d-2642-fe0f": ["1f3c4-1f3fe", 8, 45, 63],
        "1f3c4-1f3ff-200d-2642-fe0f": ["1f3c4-1f3ff", 8, 46, 63],
        "1f3ca-200d-2642-fe0f": ["1f3ca", 9, 8, 63],
        "1f3ca-1f3fb-200d-2642-fe0f": ["1f3ca-1f3fb", 9, 9, 63],
        "1f3ca-1f3fc-200d-2642-fe0f": ["1f3ca-1f3fc", 9, 10, 63],
        "1f3ca-1f3fd-200d-2642-fe0f": ["1f3ca-1f3fd", 9, 11, 63],
        "1f3ca-1f3fe-200d-2642-fe0f": ["1f3ca-1f3fe", 9, 12, 63],
        "1f3ca-1f3ff-200d-2642-fe0f": ["1f3ca-1f3ff", 9, 13, 63],
        "1f3cb-fe0f-200d-2642-fe0f": ["1f3cb", 9, 14, 31],
        "1f3cb-1f3fb-200d-2642-fe0f": ["1f3cb-1f3fb", 9, 15, 31],
        "1f3cb-1f3fc-200d-2642-fe0f": ["1f3cb-1f3fc", 9, 16, 31],
        "1f3cb-1f3fd-200d-2642-fe0f": ["1f3cb-1f3fd", 9, 17, 31],
        "1f3cb-1f3fe-200d-2642-fe0f": ["1f3cb-1f3fe", 9, 18, 31],
        "1f3cb-1f3ff-200d-2642-fe0f": ["1f3cb-1f3ff", 9, 19, 31],
        "1f3cc-fe0f-200d-2642-fe0f": ["1f3cc", 9, 20, 31],
        "1f3cc-1f3fb-200d-2642-fe0f": ["1f3cc-1f3fb", 9, 21, 21],
        "1f3cc-1f3fc-200d-2642-fe0f": ["1f3cc-1f3fc", 9, 22, 21],
        "1f3cc-1f3fd-200d-2642-fe0f": ["1f3cc-1f3fd", 9, 23, 21],
        "1f3cc-1f3fe-200d-2642-fe0f": ["1f3cc-1f3fe", 9, 24, 21],
        "1f3cc-1f3ff-200d-2642-fe0f": ["1f3cc-1f3ff", 9, 25, 21],
        "1f468-200d-1f469-200d-1f466": ["1f46a", 14, 20, 63],
        "1f46e-200d-2642-fe0f": ["1f46e", 14, 24, 63],
        "1f46e-1f3fb-200d-2642-fe0f": ["1f46e-1f3fb", 14, 25, 63],
        "1f46e-1f3fc-200d-2642-fe0f": ["1f46e-1f3fc", 14, 26, 63],
        "1f46e-1f3fd-200d-2642-fe0f": ["1f46e-1f3fd", 14, 27, 63],
        "1f46e-1f3fe-200d-2642-fe0f": ["1f46e-1f3fe", 14, 28, 63],
        "1f46e-1f3ff-200d-2642-fe0f": ["1f46e-1f3ff", 14, 29, 63],
        "1f46f-200d-2640-fe0f": ["1f46f", 14, 30, 63],
        "1f471-200d-2642-fe0f": ["1f471", 14, 37, 63],
        "1f471-1f3fb-200d-2642-fe0f": ["1f471-1f3fb", 14, 38, 63],
        "1f471-1f3fc-200d-2642-fe0f": ["1f471-1f3fc", 14, 39, 63],
        "1f471-1f3fd-200d-2642-fe0f": ["1f471-1f3fd", 14, 40, 63],
        "1f471-1f3fe-200d-2642-fe0f": ["1f471-1f3fe", 14, 41, 63],
        "1f471-1f3ff-200d-2642-fe0f": ["1f471-1f3ff", 14, 42, 63],
        "1f473-200d-2642-fe0f": ["1f473", 15, 0, 63],
        "1f473-1f3fb-200d-2642-fe0f": ["1f473-1f3fb", 15, 1, 63],
        "1f473-1f3fc-200d-2642-fe0f": ["1f473-1f3fc", 15, 2, 63],
        "1f473-1f3fd-200d-2642-fe0f": ["1f473-1f3fd", 15, 3, 63],
        "1f473-1f3fe-200d-2642-fe0f": ["1f473-1f3fe", 15, 4, 63],
        "1f473-1f3ff-200d-2642-fe0f": ["1f473-1f3ff", 15, 5, 63],
        "1f477-200d-2642-fe0f": ["1f477", 15, 24, 63],
        "1f477-1f3fb-200d-2642-fe0f": ["1f477-1f3fb", 15, 25, 63],
        "1f477-1f3fc-200d-2642-fe0f": ["1f477-1f3fc", 15, 26, 63],
        "1f477-1f3fd-200d-2642-fe0f": ["1f477-1f3fd", 15, 27, 63],
        "1f477-1f3fe-200d-2642-fe0f": ["1f477-1f3fe", 15, 28, 63],
        "1f477-1f3ff-200d-2642-fe0f": ["1f477-1f3ff", 15, 29, 63],
        "1f481-200d-2640-fe0f": ["1f481", 16, 0, 63],
        "1f481-1f3fb-200d-2640-fe0f": ["1f481-1f3fb", 16, 1, 63],
        "1f481-1f3fc-200d-2640-fe0f": ["1f481-1f3fc", 16, 2, 63],
        "1f481-1f3fd-200d-2640-fe0f": ["1f481-1f3fd", 16, 3, 63],
        "1f481-1f3fe-200d-2640-fe0f": ["1f481-1f3fe", 16, 4, 63],
        "1f481-1f3ff-200d-2640-fe0f": ["1f481-1f3ff", 16, 5, 63],
        "1f482-200d-2642-fe0f": ["1f482", 16, 6, 63],
        "1f482-1f3fb-200d-2642-fe0f": ["1f482-1f3fb", 16, 7, 63],
        "1f482-1f3fc-200d-2642-fe0f": ["1f482-1f3fc", 16, 8, 63],
        "1f482-1f3fd-200d-2642-fe0f": ["1f482-1f3fd", 16, 9, 63],
        "1f482-1f3fe-200d-2642-fe0f": ["1f482-1f3fe", 16, 10, 63],
        "1f482-1f3ff-200d-2642-fe0f": ["1f482-1f3ff", 16, 11, 63],
        "1f486-200d-2640-fe0f": ["1f486", 16, 25, 63],
        "1f486-1f3fb-200d-2640-fe0f": ["1f486-1f3fb", 16, 26, 63],
        "1f486-1f3fc-200d-2640-fe0f": ["1f486-1f3fc", 16, 27, 63],
        "1f486-1f3fd-200d-2640-fe0f": ["1f486-1f3fd", 16, 28, 63],
        "1f486-1f3fe-200d-2640-fe0f": ["1f486-1f3fe", 16, 29, 63],
        "1f486-1f3ff-200d-2640-fe0f": ["1f486-1f3ff", 16, 30, 63],
        "1f487-200d-2640-fe0f": ["1f487", 16, 31, 63],
        "1f487-1f3fb-200d-2640-fe0f": ["1f487-1f3fb", 16, 32, 63],
        "1f487-1f3fc-200d-2640-fe0f": ["1f487-1f3fc", 16, 33, 63],
        "1f487-1f3fd-200d-2640-fe0f": ["1f487-1f3fd", 16, 34, 63],
        "1f487-1f3fe-200d-2640-fe0f": ["1f487-1f3fe", 16, 35, 63],
        "1f487-1f3ff-200d-2640-fe0f": ["1f487-1f3ff", 16, 36, 63],
        "1f469-200d-2764-fe0f-200d-1f48b-200d-1f468": ["1f48f", 16, 44, 61],
        "1f469-200d-2764-fe0f-200d-1f468": ["1f491", 16, 46, 61],
        "1f575-fe0f-200d-2642-fe0f": ["1f575", 21, 17, 31],
        "1f575-1f3fb-200d-2642-fe0f": ["1f575-1f3fb", 21, 18, 31],
        "1f575-1f3fc-200d-2642-fe0f": ["1f575-1f3fc", 21, 19, 31],
        "1f575-1f3fd-200d-2642-fe0f": ["1f575-1f3fd", 21, 20, 31],
        "1f575-1f3fe-200d-2642-fe0f": ["1f575-1f3fe", 21, 21, 31],
        "1f575-1f3ff-200d-2642-fe0f": ["1f575-1f3ff", 21, 22, 31],
        "1f645-200d-2640-fe0f": ["1f645", 24, 4, 63],
        "1f645-1f3fb-200d-2640-fe0f": ["1f645-1f3fb", 24, 5, 63],
        "1f645-1f3fc-200d-2640-fe0f": ["1f645-1f3fc", 24, 6, 63],
        "1f645-1f3fd-200d-2640-fe0f": ["1f645-1f3fd", 24, 7, 63],
        "1f645-1f3fe-200d-2640-fe0f": ["1f645-1f3fe", 24, 8, 63],
        "1f645-1f3ff-200d-2640-fe0f": ["1f645-1f3ff", 24, 9, 63],
        "1f646-200d-2640-fe0f": ["1f646", 24, 10, 63],
        "1f646-1f3fb-200d-2640-fe0f": ["1f646-1f3fb", 24, 11, 63],
        "1f646-1f3fc-200d-2640-fe0f": ["1f646-1f3fc", 24, 12, 63],
        "1f646-1f3fd-200d-2640-fe0f": ["1f646-1f3fd", 24, 13, 63],
        "1f646-1f3fe-200d-2640-fe0f": ["1f646-1f3fe", 24, 14, 63],
        "1f646-1f3ff-200d-2640-fe0f": ["1f646-1f3ff", 24, 15, 63],
        "1f647-200d-2642-fe0f": ["1f647", 24, 16, 63],
        "1f647-1f3fb-200d-2642-fe0f": ["1f647-1f3fb", 24, 17, 63],
        "1f647-1f3fc-200d-2642-fe0f": ["1f647-1f3fc", 24, 18, 63],
        "1f647-1f3fd-200d-2642-fe0f": ["1f647-1f3fd", 24, 19, 63],
        "1f647-1f3fe-200d-2642-fe0f": ["1f647-1f3fe", 24, 20, 63],
        "1f647-1f3ff-200d-2642-fe0f": ["1f647-1f3ff", 24, 21, 63],
        "1f64b-200d-2640-fe0f": ["1f64b", 24, 25, 63],
        "1f64b-1f3fb-200d-2640-fe0f": ["1f64b-1f3fb", 24, 26, 63],
        "1f64b-1f3fc-200d-2640-fe0f": ["1f64b-1f3fc", 24, 27, 63],
        "1f64b-1f3fd-200d-2640-fe0f": ["1f64b-1f3fd", 24, 28, 63],
        "1f64b-1f3fe-200d-2640-fe0f": ["1f64b-1f3fe", 24, 29, 63],
        "1f64b-1f3ff-200d-2640-fe0f": ["1f64b-1f3ff", 24, 30, 63],
        "1f64d-200d-2640-fe0f": ["1f64d", 24, 37, 63],
        "1f64d-1f3fb-200d-2640-fe0f": ["1f64d-1f3fb", 24, 38, 63],
        "1f64d-1f3fc-200d-2640-fe0f": ["1f64d-1f3fc", 24, 39, 63],
        "1f64d-1f3fd-200d-2640-fe0f": ["1f64d-1f3fd", 24, 40, 63],
        "1f64d-1f3fe-200d-2640-fe0f": ["1f64d-1f3fe", 24, 41, 63],
        "1f64d-1f3ff-200d-2640-fe0f": ["1f64d-1f3ff", 24, 42, 63],
        "1f64e-200d-2640-fe0f": ["1f64e", 24, 43, 63],
        "1f64e-1f3fb-200d-2640-fe0f": ["1f64e-1f3fb", 24, 44, 63],
        "1f64e-1f3fc-200d-2640-fe0f": ["1f64e-1f3fc", 24, 45, 63],
        "1f64e-1f3fd-200d-2640-fe0f": ["1f64e-1f3fd", 24, 46, 63],
        "1f64e-1f3fe-200d-2640-fe0f": ["1f64e-1f3fe", 24, 47, 63],
        "1f64e-1f3ff-200d-2640-fe0f": ["1f64e-1f3ff", 24, 48, 63],
        "1f6a3-200d-2642-fe0f": ["1f6a3", 25, 41, 63],
        "1f6a3-1f3fb-200d-2642-fe0f": ["1f6a3-1f3fb", 25, 42, 31],
        "1f6a3-1f3fc-200d-2642-fe0f": ["1f6a3-1f3fc", 25, 43, 31],
        "1f6a3-1f3fd-200d-2642-fe0f": ["1f6a3-1f3fd", 25, 44, 31],
        "1f6a3-1f3fe-200d-2642-fe0f": ["1f6a3-1f3fe", 25, 45, 31],
        "1f6a3-1f3ff-200d-2642-fe0f": ["1f6a3-1f3ff", 25, 46, 31],
        "1f6b4-200d-2642-fe0f": ["1f6b4", 26, 14, 63],
        "1f6b4-1f3fb-200d-2642-fe0f": ["1f6b4-1f3fb", 26, 15, 63],
        "1f6b4-1f3fc-200d-2642-fe0f": ["1f6b4-1f3fc", 26, 16, 63],
        "1f6b4-1f3fd-200d-2642-fe0f": ["1f6b4-1f3fd", 26, 17, 63],
        "1f6b4-1f3fe-200d-2642-fe0f": ["1f6b4-1f3fe", 26, 18, 63],
        "1f6b4-1f3ff-200d-2642-fe0f": ["1f6b4-1f3ff", 26, 19, 63],
        "1f6b5-200d-2642-fe0f": ["1f6b5", 26, 20, 63],
        "1f6b5-1f3fb-200d-2642-fe0f": ["1f6b5-1f3fb", 26, 21, 63],
        "1f6b5-1f3fc-200d-2642-fe0f": ["1f6b5-1f3fc", 26, 22, 63],
        "1f6b5-1f3fd-200d-2642-fe0f": ["1f6b5-1f3fd", 26, 23, 63],
        "1f6b5-1f3fe-200d-2642-fe0f": ["1f6b5-1f3fe", 26, 24, 63],
        "1f6b5-1f3ff-200d-2642-fe0f": ["1f6b5-1f3ff", 26, 25, 63],
        "1f6b6-200d-2642-fe0f": ["1f6b6", 26, 26, 63],
        "1f6b6-1f3fb-200d-2642-fe0f": ["1f6b6-1f3fb", 26, 27, 63],
        "1f6b6-1f3fc-200d-2642-fe0f": ["1f6b6-1f3fc", 26, 28, 63],
        "1f6b6-1f3fd-200d-2642-fe0f": ["1f6b6-1f3fd", 26, 29, 63],
        "1f6b6-1f3fe-200d-2642-fe0f": ["1f6b6-1f3fe", 26, 30, 63],
        "1f6b6-1f3ff-200d-2642-fe0f": ["1f6b6-1f3ff", 26, 31, 63]
    }, "undefined" != typeof exports ? ("undefined" != typeof module && module.exports && (exports = module.exports = c), exports.EmojiConvertor = c) : "function" == typeof define && define.amd ? define(function () {
        return c
    }) : a.EmojiConvertor = c
}).call(function () {
    return this || ("undefined" != typeof window ? window : global)
}());

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/* xxHash implementation in pure Javascript /*
 /*                                                                                  /*
 /* Copyright (C) 2013, Pierre Curto /*
 * MIT license                                                                                     /*
 /* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

var XXH = function (t) {
    function r(e) {
        if (i[e]) return i[e].exports;
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
            if (0 == n) return this;
            if (this.total_len += n, 0 == this.memsize && (this.memory = h ? "" : i ? new Uint8Array(16) : new r(16)), this.memsize + n < 16) return h ? this.memory += t : i ? this.memory.set(t.subarray(0, n), this.memsize) : t.copy(this.memory, this.memsize, 0, n), this.memsize += n, this;
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
            for (t = this.total_len >= 16 ? this.v1.rotl(1).add(this.v2.rotl(7).add(this.v3.rotl(12).add(this.v4.rotl(18)))) : this.seed.clone().add(l), t.add(c.fromNumber(this.total_len)); o - 4 >= h;) e ? c.fromBits(i.charCodeAt(h + 1) << 8 | i.charCodeAt(h), i.charCodeAt(h + 3) << 8 | i.charCodeAt(h + 2)) : c.fromBits(i[h + 1] << 8 | i[h], i[h + 3] << 8 | i[h + 2]), t.add(c.multiply(u)).rotl(17).multiply(f), h += 4;
            for (; o > h;) c.fromBits(e ? i.charCodeAt(h++) : i[h++], 0), t.add(c.multiply(l)).rotl(11).multiply(s);
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
            if (r = d(r, 0 > i ? 0 : 0 | _(i)), !t.TYPED_ARRAY_SUPPORT) for (var e = 0; i > e; e++) r[e] = 0;
            return r
        }

        function s(t, r, i) {
            ("string" != typeof i || "" === i) && (i = "utf8");
            var e = 0 | g(r, i);
            return t = d(t, e), t.write(r, i), t
        }

        function a(r, i) {
            if (t.isBuffer(i)) return u(r, i);
            if (Q(i)) return f(r, i);
            if (null == i) throw new TypeError("must start with number, buffer, array or string");
            if ("undefined" != typeof ArrayBuffer) {
                if (i.buffer instanceof ArrayBuffer) return l(r, i);
                if (i instanceof ArrayBuffer) return c(r, i)
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
            for (var e = 0; i > e; e += 1) t[e] = 255 & r[e];
            return t
        }

        function l(t, r) {
            var i = 0 | _(r.length);
            t = d(t, i);
            for (var e = 0; i > e; e += 1) t[e] = 255 & r[e];
            return t
        }

        function c(r, i) {
            return t.TYPED_ARRAY_SUPPORT ? (i.byteLength, r = t._augment(new Uint8Array(i))) : r = l(r, new Uint8Array(i)), r
        }

        function m(t, r) {
            var i = 0 | _(r.length);
            t = d(t, i);
            for (var e = 0; i > e; e += 1) t[e] = 255 & r[e];
            return t
        }

        function p(t, r) {
            var i, e = 0;
            "Buffer" === r.type && Q(r.data) && (i = r.data, e = 0 | _(i.length)), t = d(t, e);
            for (var h = 0; e > h; h += 1) t[h] = 255 & i[h];
            return t
        }

        function d(r, i) {
            t.TYPED_ARRAY_SUPPORT ? (r = t._augment(new Uint8Array(i)), r.__proto__ = t.prototype) : (r.length = i, r._isBuffer = !0);
            var e = 0 !== i && i <= t.poolSize >>> 1;
            return e && (r.parent = V), r
        }

        function _(t) {
            if (t >= o()) throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + o().toString(16) + " bytes");
            return 0 | t
        }

        function y(r, i) {
            if (!(this instanceof y)) return new y(r, i);
            var e = new t(r, i);
            return delete e.parent, e
        }

        function g(t, r) {
            "string" != typeof t && (t = "" + t);
            var i = t.length;
            if (0 === i) return 0;
            for (var e = !1; ;) switch (r) {
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
                    if (e) return j(t).length;
                    r = ("" + r).toLowerCase(), e = !0
            }
        }

        function w(t, r, i) {
            var e = !1;
            if (r = 0 | r, i = void 0 === i || i === 1 / 0 ? this.length : 0 | i, t || (t = "utf8"), 0 > r && (r = 0), i > this.length && (i = this.length), r >= i) return "";
            for (; ;) switch (t) {
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
                    if (e) throw new TypeError("Unknown encoding: " + t);
                    t = (t + "").toLowerCase(), e = !0
            }
        }

        function A(t, r, i, e) {
            i = Number(i) || 0;
            var h = t.length - i;
            e ? (e = Number(e), e > h && (e = h)) : e = h;
            var o = r.length;
            if (o % 2 !== 0) throw new Error("Invalid hex string");
            e > o / 2 && (e = o / 2);
            for (var n = 0; e > n; n++) {
                var s = parseInt(r.substr(2 * n, 2), 16);
                if (isNaN(s)) throw new Error("Invalid hex string");
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
            if (W >= r) return String.fromCharCode.apply(String, t);
            for (var i = "", e = 0; r > e;) i += String.fromCharCode.apply(String, t.slice(e, e += W));
            return i
        }

        function x(t, r, i) {
            var e = "";
            i = Math.min(t.length, i);
            for (var h = r; i > h; h++) e += String.fromCharCode(127 & t[h]);
            return e
        }

        function P(t, r, i) {
            var e = "";
            i = Math.min(t.length, i);
            for (var h = r; i > h; h++) e += String.fromCharCode(t[h]);
            return e
        }

        function T(t, r, i) {
            var e = t.length;
            (!r || 0 > r) && (r = 0), (!i || 0 > i || i > e) && (i = e);
            for (var h = "", o = r; i > o; o++) h += q(t[o]);
            return h
        }

        function S(t, r, i) {
            for (var e = t.slice(r, i), h = "", o = 0; o < e.length; o += 2) h += String.fromCharCode(e[o] + 256 * e[o + 1]);
            return h
        }

        function L(t, r, i) {
            if (t % 1 !== 0 || 0 > t) throw new RangeError("offset is not uint");
            if (t + r > i) throw new RangeError("Trying to access beyond buffer length")
        }

        function Y(r, i, e, h, o, n) {
            if (!t.isBuffer(r)) throw new TypeError("buffer must be a Buffer instance");
            if (i > o || n > i) throw new RangeError("value is out of bounds");
            if (e + h > r.length) throw new RangeError("index out of range")
        }

        function z(t, r, i, e) {
            0 > r && (r = 65535 + r + 1);
            for (var h = 0, o = Math.min(t.length - i, 2); o > h; h++) t[i + h] = (r & 255 << 8 * (e ? h : 1 - h)) >>> 8 * (e ? h : 1 - h)
        }

        function M(t, r, i, e) {
            0 > r && (r = 4294967295 + r + 1);
            for (var h = 0, o = Math.min(t.length - i, 4); o > h; h++) t[i + h] = r >>> 8 * (e ? h : 3 - h) & 255
        }

        function D(t, r, i, e, h, o) {
            if (r > h || o > r) throw new RangeError("value is out of bounds");
            if (i + e > t.length) throw new RangeError("index out of range");
            if (0 > i) throw new RangeError("index out of range")
        }

        function O(t, r, i, e, h) {
            return h || D(t, r, i, 4, 3.4028234663852886e38, -3.4028234663852886e38), K.write(t, r, i, e, 23, 4), i + 4
        }

        function N(t, r, i, e, h) {
            return h || D(t, r, i, 8, 1.7976931348623157e308, -1.7976931348623157e308), K.write(t, r, i, e, 52, 8), i + 8
        }

        function F(t) {
            if (t = k(t).replace(tt, ""), t.length < 2) return "";
            for (; t.length % 4 !== 0;) t += "=";
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
                    if ((r -= 1) < 0) break;
                    o.push(i)
                } else if (2048 > i) {
                    if ((r -= 2) < 0) break;
                    o.push(i >> 6 | 192, 63 & i | 128)
                } else if (65536 > i) {
                    if ((r -= 3) < 0) break;
                    o.push(i >> 12 | 224, i >> 6 & 63 | 128, 63 & i | 128)
                } else {
                    if (!(1114112 > i)) throw new Error("Invalid code point");
                    if ((r -= 4) < 0) break;
                    o.push(i >> 18 | 240, i >> 12 & 63 | 128, i >> 6 & 63 | 128, 63 & i | 128)
                }
            }
            return o
        }

        function X(t) {
            for (var r = [], i = 0; i < t.length; i++) r.push(255 & t.charCodeAt(i));
            return r
        }

        function J(t, r) {
            for (var i, e, h, o = [], n = 0; n < t.length && !((r -= 2) < 0); n++) i = t.charCodeAt(n), e = i >> 8, h = i % 256, o.push(h), o.push(e);
            return o
        }

        function H(t) {
            return G.toByteArray(F(t))
        }

        function Z(t, r, i, e) {
            for (var h = 0; e > h && !(h + i >= r.length || h >= t.length); h++) r[h + i] = t[h];
            return h
        }

        var G = i(3), K = i(4), Q = i(5);
        r.Buffer = t, r.SlowBuffer = y, r.INSPECT_MAX_BYTES = 50, t.poolSize = 8192;
        var V = {};
        t.TYPED_ARRAY_SUPPORT = void 0 !== e.TYPED_ARRAY_SUPPORT ? e.TYPED_ARRAY_SUPPORT : h(), t.TYPED_ARRAY_SUPPORT ? (t.prototype.__proto__ = Uint8Array.prototype, t.__proto__ = Uint8Array) : (t.prototype.length = void 0, t.prototype.parent = void 0), t.isBuffer = function (t) {
            return !(null == t || !t._isBuffer)
        }, t.compare = function (r, i) {
            if (!t.isBuffer(r) || !t.isBuffer(i)) throw new TypeError("Arguments must be Buffers");
            if (r === i) return 0;
            for (var e = r.length, h = i.length, o = 0, n = Math.min(e, h); n > o && r[o] === i[o];) ++o;
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
            if (!Q(r)) throw new TypeError("list argument must be an Array of Buffers.");
            if (0 === r.length) return new t(0);
            var e;
            if (void 0 === i) for (i = 0, e = 0; e < r.length; e++) i += r[e].length;
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
            if (!t.isBuffer(r)) throw new TypeError("Argument must be a Buffer");
            return this === r ? !0 : 0 === t.compare(this, r)
        }, t.prototype.inspect = function () {
            var t = "", i = r.INSPECT_MAX_BYTES;
            return this.length > 0 && (t = this.toString("hex", 0, i).match(/.{2}/g).join(" "), this.length > i && (t += " ... ")), "<Buffer " + t + ">"
        }, t.prototype.compare = function (r) {
            if (!t.isBuffer(r)) throw new TypeError("Argument must be a Buffer");
            return this === r ? 0 : t.compare(this, r)
        }, t.prototype.indexOf = function (r, i) {
            function e(t, r, i) {
                for (var e = -1, h = 0; i + h < t.length; h++) if (t[i + h] === r[-1 === e ? 0 : h - e]) {
                    if (-1 === e && (e = h), h - e + 1 === r.length) return i + e
                } else e = -1;
                return -1
            }

            if (i > 2147483647 ? i = 2147483647 : -2147483648 > i && (i = -2147483648), i >>= 0, 0 === this.length) return -1;
            if (i >= this.length) return -1;
            if (0 > i && (i = Math.max(this.length + i, 0)), "string" == typeof r) return 0 === r.length ? -1 : String.prototype.indexOf.call(this, r, i);
            if (t.isBuffer(r)) return e(this, r, i);
            if ("number" == typeof r) return t.TYPED_ARRAY_SUPPORT && "function" === Uint8Array.prototype.indexOf ? Uint8Array.prototype.indexOf.call(this, r, i) : e(this, [r], i);
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
            if ((void 0 === i || i > o) && (i = o), t.length > 0 && (0 > i || 0 > r) || r > this.length) throw new RangeError("attempt to write outside buffer bounds");
            e || (e = "utf8");
            for (var n = !1; ;) switch (e) {
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
                    if (n) throw new TypeError("Unknown encoding: " + e);
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
                for (var n = 0; o > n; n++) h[n] = this[n + r]
            }
            return h.length && (h.parent = this.parent || this), h
        }, t.prototype.readUIntLE = function (t, r, i) {
            t = 0 | t, r = 0 | r, i || L(t, r, this.length);
            for (var e = this[t], h = 1, o = 0; ++o < r && (h *= 256);) e += this[t + o] * h;
            return e
        }, t.prototype.readUIntBE = function (t, r, i) {
            t = 0 | t, r = 0 | r, i || L(t, r, this.length);
            for (var e = this[t + --r], h = 1; r > 0 && (h *= 256);) e += this[t + --r] * h;
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
            for (var e = this[t], h = 1, o = 0; ++o < r && (h *= 256);) e += this[t + o] * h;
            return h *= 128, e >= h && (e -= Math.pow(2, 8 * r)), e
        }, t.prototype.readIntBE = function (t, r, i) {
            t = 0 | t, r = 0 | r, i || L(t, r, this.length);
            for (var e = r, h = 1, o = this[t + --e]; e > 0 && (h *= 256);) o += this[t + --e] * h;
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
            for (this[r] = 255 & t; ++o < i && (h *= 256);) this[r + o] = t / h & 255;
            return r + i
        }, t.prototype.writeUIntBE = function (t, r, i, e) {
            t = +t, r = 0 | r, i = 0 | i, e || Y(this, t, r, i, Math.pow(2, 8 * i), 0);
            var h = i - 1, o = 1;
            for (this[r + h] = 255 & t; --h >= 0 && (o *= 256);) this[r + h] = t / o & 255;
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
            for (this[r] = 255 & t; ++o < i && (n *= 256);) this[r + o] = (t / n >> 0) - s & 255;
            return r + i
        }, t.prototype.writeIntBE = function (t, r, i, e) {
            if (t = +t, r = 0 | r, !e) {
                var h = Math.pow(2, 8 * i - 1);
                Y(this, t, r, i, h - 1, -h)
            }
            var o = i - 1, n = 1, s = 0 > t ? 1 : 0;
            for (this[r + o] = 255 & t; --o >= 0 && (n *= 256);) this[r + o] = (t / n >> 0) - s & 255;
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
            if (e || (e = 0), h || 0 === h || (h = this.length), i >= r.length && (i = r.length), i || (i = 0), h > 0 && e > h && (h = e), h === e) return 0;
            if (0 === r.length || 0 === this.length) return 0;
            if (0 > i) throw new RangeError("targetStart out of bounds");
            if (0 > e || e >= this.length) throw new RangeError("sourceStart out of bounds");
            if (0 > h) throw new RangeError("sourceEnd out of bounds");
            h > this.length && (h = this.length), r.length - i < h - e && (h = r.length - i + e);
            var o, n = h - e;
            if (this === r && i > e && h > i) for (o = n - 1; o >= 0; o--) r[o + i] = this[o + e]; else if (1e3 > n || !t.TYPED_ARRAY_SUPPORT) for (o = 0; n > o; o++) r[o + i] = this[o + e]; else r._set(this.subarray(e, e + n), i);
            return n
        }, t.prototype.fill = function (t, r, i) {
            if (t || (t = 0), r || (r = 0), i || (i = this.length), r > i) throw new RangeError("end < start");
            if (i !== r && 0 !== this.length) {
                if (0 > r || r >= this.length) throw new RangeError("start out of bounds");
                if (0 > i || i > this.length) throw new RangeError("end out of bounds");
                var e;
                if ("number" == typeof t) for (e = r; i > e; e++) this[e] = t; else {
                    var h = j(t.toString()), o = h.length;
                    for (e = r; i > e; e++) this[e] = h[e % o]
                }
                return this
            }
        }, t.prototype.toArrayBuffer = function () {
            if ("undefined" != typeof Uint8Array) {
                if (t.TYPED_ARRAY_SUPPORT) return new t(this).buffer;
                for (var r = new Uint8Array(this.length), i = 0, e = r.length; e > i; i += 1) r[i] = this[i];
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
            if (t.length % 4 > 0) throw new Error("Invalid string. Length must be a multiple of 4");
            var f = t.length;
            a = "=" === t.charAt(f - 2) ? 2 : "=" === t.charAt(f - 1) ? 1 : 0, u = new o(3 * t.length / 4 - a), n = a > 0 ? t.length - 4 : t.length;
            var l = 0;
            for (e = 0, h = 0; n > e; e += 4, h += 3) s = r(t.charAt(e)) << 18 | r(t.charAt(e + 1)) << 12 | r(t.charAt(e + 2)) << 6 | r(t.charAt(e + 3)), i((16711680 & s) >> 16), i((65280 & s) >> 8), i(255 & s);
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
            for (h = 0, n = t.length - s; n > h; h += 3) o = (t[h] << 16) + (t[h + 1] << 8) + t[h + 2], a += e(o);
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
        for (l += c, o = m & (1 << -f) - 1, m >>= -f, f += s; f > 0; o = 256 * o + t[r + l], l += c, f -= 8) ;
        for (n = o & (1 << -f) - 1, o >>= -f, f += e; f > 0; n = 256 * n + t[r + l], l += c, f -= 8) ;
        if (0 === o) o = 1 - u; else {
            if (o === a) return n ? 0 / 0 : (m ? -1 : 1) * (1 / 0);
            n += Math.pow(2, e), o -= u
        }
        return (m ? -1 : 1) * n * Math.pow(2, o - e)
    }, r.write = function (t, r, i, e, h, o) {
        var n, s, a, u = 8 * o - h - 1, f = (1 << u) - 1, l = f >> 1,
            c = 23 === h ? Math.pow(2, -24) - Math.pow(2, -77) : 0, m = e ? 0 : o - 1, p = e ? 1 : -1,
            d = 0 > r || 0 === r && 0 > 1 / r ? 1 : 0;
        for (r = Math.abs(r), isNaN(r) || r === 1 / 0 ? (s = isNaN(r) ? 1 : 0, n = f) : (n = Math.floor(Math.log(r) / Math.LN2), r * (a = Math.pow(2, -n)) < 1 && (n--, a *= 2), r += n + l >= 1 ? c / a : c * Math.pow(2, 1 - l), r * a >= 2 && (n++, a /= 2), n + l >= f ? (s = 0, n = f) : n + l >= 1 ? (s = (r * a - 1) * Math.pow(2, h), n += l) : (s = r * Math.pow(2, l - 1) * Math.pow(2, h), n = 0)); h >= 8; t[i + m] = 255 & s, m += p, s /= 256, h -= 8) ;
        for (n = n << h | s, u += h; u > 0; t[i + m] = 255 & n, m += p, n /= 256, u -= 8) ;
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
            if (!this.gt(r)) return this.toNumber().toString(t);
            for (var i = this.clone(), e = new Array(32), h = 31; h >= 0 && (i.div(r), e[h] = i.remainder.toNumber().toString(t), i.gt(r)); h--) ;
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
            if (0 == t._low && 0 == t._high) throw Error("division by zero");
            if (0 == t._high && 1 == t._low) return this.remainder = new o(0), this;
            if (t.gt(this)) return this.remainder = new o(0), this._low = 0, this._high = 0, this;
            if (this.eq(t)) return this.remainder = new o(0), this._low = 1, this._high = 0, this;
            for (var r = t.clone(), i = -1; !this.lt(r);) r.shiftLeft(1, !0), i++;
            for (this.remainder = this.clone(), this._low = 0, this._high = 0; i >= 0; i--) r.shiftRight(1), this.remainder.lt(r) || (this.remainder.subtract(r), i >= 16 ? this._high |= 1 << i - 16 : this._low |= 1 << i);
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
            if (!this.gt(r)) return this.toNumber().toString(t);
            for (var i = this.clone(), e = new Array(64), h = 63; h >= 0 && (i.div(r), e[h] = i.remainder.toNumber().toString(t), i.gt(r)); h--) ;
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
                if (0 == t._a00) throw Error("division by zero");
                if (1 == t._a00) return this.remainder = new o(0), this
            }
            if (t.gt(this)) return this.remainder = new o(0), this._a00 = 0, this._a16 = 0, this._a32 = 0, this._a48 = 0, this;
            if (this.eq(t)) return this.remainder = new o(0), this._a00 = 1, this._a16 = 0, this._a32 = 0, this._a48 = 0, this;
            for (var r = t.clone(), i = -1; !this.lt(r);) r.shiftLeft(1, !0), i++;
            for (this.remainder = this.clone(), this._a00 = 0, this._a16 = 0, this._a32 = 0, this._a48 = 0; i >= 0; i--) r.shiftRight(1), this.remainder.lt(r) || (this.remainder.subtract(r), i >= 48 ? this._a48 |= 1 << i - 48 : i >= 32 ? this._a32 |= 1 << i - 32 : i >= 16 ? this._a16 |= 1 << i - 16 : this._a00 |= 1 << i);
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
            if (t %= 64, 0 == t) return this;
            if (t >= 32) {
                var r = this._a00;
                if (this._a00 = this._a32, this._a32 = r, r = this._a48, this._a48 = this._a16, this._a16 = r, 32 == t) return this;
                t -= 32
            }
            var i = this._a48 << 16 | this._a32, e = this._a16 << 16 | this._a00, h = i << t | e >>> 32 - t,
                o = e << t | i >>> 32 - t;
            return this._a00 = 65535 & o, this._a16 = o >>> 16, this._a32 = 65535 & h, this._a48 = h >>> 16, this
        }, o.prototype.rotateRight = o.prototype.rotr = function (t) {
            if (t %= 64, 0 == t) return this;
            if (t >= 32) {
                var r = this._a00;
                if (this._a00 = this._a32, this._a32 = r, r = this._a48, this._a48 = this._a16, this._a16 = r, 32 == t) return this;
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
            if (0 == u) return this;
            if (this.total_len += u, 0 == this.memsize && (this.memory = h ? "" : i ? new Uint8Array(32) : new r(32)), this.memsize + u < 32) return h ? this.memory += t : i ? this.memory.set(t.subarray(0, u), this.memsize) : t.copy(this.memory, this.memsize, 0, u), this.memsize += u, this;
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
            for (this.total_len >= 32 ? (t = this.v1.clone().rotl(1), t.add(this.v2.clone().rotl(7)), t.add(this.v3.clone().rotl(12)), t.add(this.v4.clone().rotl(18)), t.xor(this.v1.multiply(a).rotl(31).multiply(s)), t.multiply(s).add(f), t.xor(this.v2.multiply(a).rotl(31).multiply(s)), t.multiply(s).add(f), t.xor(this.v3.multiply(a).rotl(31).multiply(s)), t.multiply(s).add(f), t.xor(this.v4.multiply(a).rotl(31).multiply(s)), t.multiply(s).add(f)) : t = this.seed.clone().add(l), t.add(c.fromNumber(this.total_len)); o - 8 >= h;) e ? c.fromBits(i.charCodeAt(h + 1) << 8 | i.charCodeAt(h), i.charCodeAt(h + 3) << 8 | i.charCodeAt(h + 2), i.charCodeAt(h + 5) << 8 | i.charCodeAt(h + 4), i.charCodeAt(h + 7) << 8 | i.charCodeAt(h + 6)) : c.fromBits(i[h + 1] << 8 | i[h], i[h + 3] << 8 | i[h + 2], i[h + 5] << 8 | i[h + 4], i[h + 7] << 8 | i[h + 6]), c.multiply(a).rotl(31).multiply(s), t.xor(c).rotl(27).multiply(s).add(f), h += 8;
            for (o >= h + 4 && (e ? c.fromBits(i.charCodeAt(h + 1) << 8 | i.charCodeAt(h), i.charCodeAt(h + 3) << 8 | i.charCodeAt(h + 2), 0, 0) : c.fromBits(i[h + 1] << 8 | i[h], i[h + 3] << 8 | i[h + 2], 0, 0), t.xor(c.multiply(s)).rotl(23).multiply(a).add(u), h += 4); o > h;) c.fromBits(e ? i.charCodeAt(h++) : i[h++], 0, 0, 0), t.xor(c.multiply(l)).rotl(11).multiply(s);
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
                            if (f) continue;
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


function metaphone(str) {
    //  discuss at: http://locutus.io/php/soundex/
    // original by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
    // original by: Arnout Kazemier (http://www.3rd-Eden.com)
    // improved by: Jack
    // improved by: Kevin van Zonneveld (http://kvz.io)
    // bugfixed by: Onno Marsman (https://twitter.com/onnomarsman)
    // bugfixed by: Kevin van Zonneveld (http://kvz.io)
    //    input by: Brett Zamir (http://brett-zamir.me)
    //  revised by: Rafał Kukawski (http://blog.kukawski.pl)
    //   example 1: soundex('Kevin')
    //   returns 1: 'K150'
    //   example 2: soundex('Ellery')
    //   returns 2: 'E460'
    //   example 3: soundex('Euler')
    //   returns 3: 'E460'
    str = (str + '').toUpperCase()
    if (!str) {
        return ''
    }
    var sdx = [0, 0, 0, 0]
    var m = {
        B: 1,
        F: 1,
        P: 1,
        V: 1,
        C: 2,
        G: 2,
        J: 2,
        K: 2,
        Q: 2,
        S: 2,
        X: 2,
        Z: 2,
        D: 3,
        T: 3,
        L: 4,
        M: 5,
        N: 5,
        R: 6
    }
    var i = 0
    var j
    var s = 0
    var c
    var p
    while ((c = str.charAt(i++)) && s < 4) {
        if ((j = m[c])) {
            if (j !== p) {
                sdx[s++] = p = j
            }
        } else {
            s += i === 1
            p = 0
        }
    }
    sdx[0] = str.charAt(0)
    return sdx.join('')
}

/*
 https://github.com/kvz/locutus
 */

function metaphone_metaphone(word, maxPhonemes) {
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
