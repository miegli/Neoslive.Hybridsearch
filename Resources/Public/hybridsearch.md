# HybridsearchObject

**Parameters**

-   `Hybridsearch` **Hybridsearch** see Hybridsearch constructor
-   `hybridsearch`  

**Examples**

```javascript
var hybridSearch = new $Hybridsearch(
 'https://<DATABASE_NAME>.firebaseio.com',
 'live',
 'fb11fdde869d0a8fcfe00a2fd35c031d',
 'site-root-node-name'
));
var mySearch = new $HybridsearchObject(hybridSearch);
     mySearch.setQuery("Foo").addPropertyFilter('title', 'Foo').setNodeType('bar').$watch(function (data) {
       console.log(data);
     });
```

## $bind

**Parameters**

-   `scopevar`  
-   `scope` **string** variable name
-   `scope` **scope** 

**Examples**

```javascript
.$bind(scopevar,scope);
```

Returns **HybridsearchObject** 

## $watch

**Parameters**

-   `callback` **function** method called whenever results are loaded

**Examples**

```javascript
.$watch(function (data) {
          $scope.result = data;
          setTimeout(function () {
              $scope.$digest();
          }, 10);
  });
```

Returns **HybridsearchObject** 

## addAdditionalKeywords

**Parameters**

-   `add` **string** hidden keyword uses in search query.
-   `input`  
-   `scope` **scope** false if is simple string otherwise angular scope required for binding data

Returns **HybridsearchObject** 

## addNodesByIdentifier

Adds nodes by identifier to search index

**Parameters**

-   `nodesArray` **array** 

Returns **HybridsearchObject** 

## addNodesByNodeTypes

Adds nodes by node types to search index

**Parameters**

-   `nodesTypesArray` **array** 

Returns **HybridsearchObject** 

## addPropertyFilter

Adds a property filter to the query.

**Parameters**

-   `property` **string** to search only for
-   `value` **string** that property must match
-   `scope` **scope** false if is simple string otherwise angular scope required for binding data
-   `boolean`  reverse (true if condition logic is reversed)
-   `boolean`  booleanmode (true if array values treated with OR conditions)
-   `reverse`  
-   `booleanmode`  
-   `nodeType`  nodeType (apply filter only to given nodeType)

Returns **HybridsearchObject** 

## disableRealtime

Disable realtime search. Use static data / cdn for better caching behaviour.


Returns **HybridsearchObject** 

## setAgeFilter

Adds an ange filter to the query. Show only nodes, that are visited mostly by given age bracket

**Parameters**

-   `age` **string** [18-24,25-34,35-44,45-54,55-64,65+]
-   `scope` **scope** false if is simple string otherwise angular scope required for binding data

Returns **HybridsearchObject** 

## setCategorizedBy

Sets categorizedBy.

**Parameters**

-   `categorizedBy` **object** 

**Examples**

```javascript
var categorizedBy = 'property-type'
```

Returns **$hybridsearchResultsObject or Any** 

## setGenderFilter

Adds a gender filter to the query. Show only nodes, that are visited mostly by given gender

**Parameters**

-   `gender` **string** male|female
-   `scope` **scope** false if is simple string otherwise angular scope required for binding data

Returns **HybridsearchObject** 

## setGroupedBy

Sets groupedBy.

**Parameters**

-   `groupedBy` **object** 

**Examples**

```javascript
var groupedBy = {
       'nodeType': ['id'],
       'nodeTypeLabel': ['name','lastname']
   }
```

Returns **$hybridsearchResultsObject or Any** 

## setNodePath

Sets a node path filter.

**Parameters**

-   `nodePath` **string** to search only for
-   `scope` **scope** false if is simple string otherwise angular scope required for binding data

Returns **HybridsearchObject** 

## setNodeType

**Parameters**

-   `nodeType` **string** to search only for
-   `scope` **scope** false if is simple string otherwise angular scope required for binding data

Returns **HybridsearchObject** 

## setNodeTypeLabels

Sets node type labels.

**Parameters**

-   `nodetypelabels` **object** 

**Examples**

```javascript
var nodetypelabels = {
       'nodeType': 'Label',
       'corporate-contact': 'Contacts',
       'corporate-headline': 'Pages',
       'corporate-onepage': 'Pages',
       'corporate-table': 'Pages',
       'corporate-file': 'Files'
   }
```

Returns **$hybridsearchResultsObject or Any** 

## setOrderBy

Sets orderBy.

**Parameters**

-   `orderBy` **object** 

**Examples**

```javascript
var orderBy = {
       'nodeTypeLabel': ['name'],
       'nodeType': ['name']
   }
```

Returns **$hybridsearchResultsObject or Any** 

## setParentNodeTypeBoostFactor

Sets parent node type boost.

**Parameters**

-   `ParentNodeTypeBoostFactor` **object** 

**Examples**

```javascript
var ParentNodeTypeBoostFactor = {
       'corporate-contact-collection': 1.5
   }
```

Returns **$hybridsearchResultsObject or Any** 

## setPropertiesBoost

Sets property boost.

**Parameters**

-   `propertiesboost` **object** 

**Examples**

```javascript
var propertiesboost = {
       'nodeType-propertyname': 1,
       'corporate-contact-lastname': 10,
       'corporate-contact-firstname': 10,
       'corporate-contact-email': 50,
       'corporate-headline-text': 60,
       'corporate-onepage-text': 1,
       'corporate-table-text': 1,
       'corporate-file-title': 3'
   }
```

Returns **$hybridsearchResultsObject or Any** 

## setQuery

Sets a search string to the query.

**Parameters**

-   `search` **string** string
-   `input`  
-   `scope` **scope** false if is simple string otherwise angular scope required for binding data

Returns **HybridsearchObject** 

## setScope

**Parameters**

-   `angular` **scope** scope
-   `scope`  

Returns **HybridsearchObject** 

# Hybridsearch

**Parameters**

-   `databaseURL`  {string} databaseURL, google firebase realtime database endpoint
-   `workspace`  {string} workspace, identifier of the workspace to use from indexed datebase
-   `dimension`  {string} dimension, hash of the dimension configuration to use form indexed database
-   `site`  {string} site identifier (uuid)
-   `cdnHost`  {string} (optional) cdn host for static data
-   `debug`  {boolean}

**Examples**

```javascript
var hybridSearch = new $hybridsearchObject(
 'https://<DATABASE_NAME>.firebaseio.com',
 'live',
 'fb11fdde869d0a8fcfe00a2fd35c031d',
 'site-root-node-name'
));
```

Returns **Hybridsearch** used for HybridsearchObject constructor.

# HybridsearchResultsNode

**Parameters**

-   `nodeData`  {object|array} Nodes properties.
-   `score`  {float} computed Relevance score.

## getBreadcrumb

Breadcrumb if its a document node.

Returns **string** 

## getDocumentNode

Nearest Document node.

Returns **HybridsearchResultsNode** 

## getGroupedNodes

**Parameters**

-   `uniqueByDocumentNode` **boolean** 

Returns **array** 

## getIdentifier

NodeType.

Returns **string** node identifier

## getNodeType

NodeType.

Returns **string** nodeType

## getParent

Parent node.

Returns **HybridsearchResultsNode** 

## getPreview

Preview html content of node.

**Parameters**

-   `maxlength`  
-   `delimiter`  

Returns **string** 

## getProperties

Properties.

Returns **object** 

## getProperty

Get property.

**Parameters**

-   `property` **string** Get single property from node data.

Returns **mixed** 

## getScore

Relevance score of search result.

Returns **float** 

## getSortingIndex

Get sorting index

Returns **integer** 

## getUrl

Url if its a document node.

Returns **string** 

## isGrouped

Returns **boolean** 

## isTurboNode

Is result a turbo node or not.

Returns **boolean** 

# HybridsearchResultsGroupObject

HybridsearchResultsGroupObject

## count

Get number of search results.

Returns **integer** Search results length.

## getItems

Get group collection.

Returns **array** collection of {HybridsearchResultsDataObject}

# getPropertyFromNode

Get property.

**Parameters**

-   `node`  
-   `property` **string** Get single property from node data.

Returns **mixed** 

# getResultNodeByIdentifier

Get node by identifier from current search result.

**Parameters**

-   `identifier` **string** 

Returns **HybridsearchResultsNode** 

# HybridsearchResultsObject

Return the search results as {HybridsearchResultsObject}.

Returns **HybridsearchResultsObject** 

## clearDistincts

clear distincts

Returns **void** 

## count

Get number of search results.

Returns **integer** Search results length.

## countAll

Get number of search results including turbonodes.

Returns **integer** Search results length.

## countByNodeType

Get number of search results by given node type..

**Parameters**

-   `nodeType` **string** 

Returns **integer** Search results length.

## countByNodeTypeLabel

Get number of search results by given node type label.

**Parameters**

-   `nodeTypeLabel` **string** 

Returns **integer** Search results length.

## countTurboNodes

Get number of turbo nodes

Returns **integer** Search results length.

## getDistinct

Get all different values from given property

**Parameters**

-   `property` **string** 
-   `counterGroupedByNode` **boolean** count existences grouped by node

Returns **array** collection of property values

## getDistinctCount

Get distinct count

**Parameters**

-   `property` **string** 

Returns **integer** count collection of property values

## getGrouped

Get alle nodes from current search result a grouped object.

Returns **HybridsearchResultsGroupObject** 

## getHash

Get hash of results

Returns **string** Search results hash

## getNodes

Get all nodes from current search result.

**Parameters**

-   `limit` **integer** max results

Returns **array** collection of {HybridsearchResultsNode}

## getNodesByNodeType

Get all nodes by given nodeType from current search result.

**Parameters**

-   `nodeType` **string** 

Returns **array** collection of {HybridsearchResultsNode}

## getNodesByNodeTypeLabel

Get all nodes by given nodeTypeLabel from current search result.

**Parameters**

-   `nodeTypeLabel` **string** 

Returns **array** collection of {HybridsearchResultsNode}

## getTurboNodes

Get all turbonodes from current search result.

**Parameters**

-   `limit` **integer** max results

Returns **array** collection of {HybridsearchResultsNode}

## isLoading

Is search executed

Returns **boolean** true if a search was executed

## isStarted

Is search executed

Returns **boolean** true if a search was executed

## updateDistincts

update distincts

Returns **HybridsearchResultsObject** 

# HybridsearchResultsDataObject

HybridsearchResultsDataObject

## count

Get number of search results in this group.

Returns **integer** Search results length.

## getCategorizedNodes

Get all nodes grouped by given facet.

**Parameters**

-   `string` **categorizedBy** 
-   `categorizedBy`  

Returns **array** collection of {HybridsearchResultsDataObject}

## getLabel

Get groups label.

Returns **string** Group label

## getNodes

Get all nodes for this group from current search result.

**Parameters**

-   `limit` **integer** max results

Returns **array** collection of {HybridsearchResultsNode}

## getProperty

Get property of group.

**Parameters**

-   `property`  

Returns **string** Group label

# HybridsearchResultsDataObject

HybridsearchResultsDataObject

## count

Get number of search results in this group.

Returns **integer** Search results length.

## getCategorizedNodes

Get all nodes grouped by given facet.

**Parameters**

-   `string` **categorizedBy** 
-   `categorizedBy`  

Returns **array** collection of {HybridsearchResultsDataObject}

## getLabel

Get groups label.

Returns **string** Group label

## getNodes

Get all nodes for this group from current search result.

**Parameters**

-   `limit` **integer** max results

Returns **array** collection of {HybridsearchResultsNode}

## getProperty

Get property of group.

**Parameters**

-   `property`  

Returns **string** Group label

# execute

execute search.

**Parameters**

-   `self`  
-   `lastSearchInstance`  

Returns **SearchIndexInstance** SearchIndexInstance

# Sha1

SHA-1 hash function reference implementation.

## hash

Generates SHA-1 hash of string.

**Parameters**

-   `msg` **string** (Unicode) string to be hashed.

Returns **string** Hash of msg as hex character string.

# getGa

init ga data

# getIndex

Run search.

Returns **SearchIndexInstance** SearchIndexInstance

# HybridsearchResultsValue

**Parameters**

-   `value`  {mixed} a value

# HybridsearchResultsValue

extends string prototype
 finds uri in string

# query

init branch master/slave

# utf8Decode

Extend String object with method to decode utf8 string to multi-byte

# utf8Encode

Extend String object with method to encode multi-byte string to utf8

-   monsur.hossa.in/2012/07/20/utf-8-in-javascript.html
