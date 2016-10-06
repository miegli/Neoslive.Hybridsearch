# Hybridsearch

**Parameters**

-   `databaseURL`  {string} databaseURL, google firebase realtime database endpoint
-   `workspace`  {string} workspace, identifier of the workspace to use from indexed datebase
-   `dimension`  {string} dimension, hash of the dimension configuration to use form indexed database

**Examples**

```javascript
var hybridSearch = new $hybridsearchObject(
 'https://<DATABASE_NAME>.firebaseio.com',
 'live',
 'fb11fdde869d0a8fcfe00a2fd35c031d'
));
```

Returns **Hybridsearch** used for HybridsearchObject constructor.

# HybridsearchObject

**Parameters**

-   `Hybridsearch` **Hybridsearch** see Hybridsearch constructor
-   `hybridsearch`  

**Examples**

```javascript
var hybridSearch = new HybridsearchObject(
 'https://<DATABASE_NAME>.firebaseio.com',
 'live',
 'fb11fdde869d0a8fcfe00a2fd35c031d'
));
var mySearch = new HybridsearchObject(hybridSearch);
     mySearch.setQuery("Foo").addPropertyFilter('title', 'Foo').setNodeType('bar').$watch(function (data) {
       console.log(data);
     });
```

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

## addPropertyFilter

Adds a property filter to the query.

**Parameters**

-   `property` **string** to search only for
-   `value` **string** that property must match
-   `scope` **scope** false if is simple string otherwise angular scope required for binding data

Returns **HybridsearchObject** 

## setAgeFilter

Adds an ange filter to the query. Show only nodes, that are visited mostly by given age bracket

**Parameters**

-   `string`  18-24,25-34,35-44,45-54,55-64,65+]
-   `value`  
-   `scope` **scope** false if is simple string otherwise angular scope required for binding data

Returns **HybridsearchObject** 

## setGenderFilter

Adds a gender filter to the query. Show only nodes, that are visited mostly by given gender

**Parameters**

-   `male` **string** |female
-   `value`  
-   `scope` **scope** false if is simple string otherwise angular scope required for binding data

Returns **HybridsearchObject** 

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

# HybridsearchResultsGroupObject

HybridsearchResultsGroupObject

## count

Get number of search results.

Returns **integer** Search results length.

## getItems

Get group collection.

Returns **array** collection of {HybridsearchResultsDataObject}

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

## getNodeType

NodeType.

Returns **string** nodeType

## getParent

Parent node.

Returns **HybridsearchResultsNode** 

## getPreview

Preview html content of node.

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

## getUrl

Url if its a document node.

Returns **string** 

## isTurboNode

Is result a turbo node or not.

Returns **boolean** 

# HybridsearchResultsDataObject

HybridsearchResultsDataObject

## count

Get number of search results in this group.

Returns **integer** Search results length.

## getLabel

Get groups label.

Returns **string** Group label

## getNodes

Get all nodes for this group from current search result.

Returns **array** collection of {HybridsearchResultsNode}

# HybridsearchResultsDataObject

HybridsearchResultsDataObject

## count

Get number of search results in this group.

Returns **integer** Search results length.

## getLabel

Get groups label.

Returns **string** Group label

## getNodes

Get all nodes for this group from current search result.

Returns **array** collection of {HybridsearchResultsNode}

# HybridsearchResultsObject

Return the search results as {HybridsearchResultsObject}.

Returns **HybridsearchResultsObject** 

## count

Get number of search results.

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

## getGrouped

Get alle nodes from current search result a grouped object.

Returns **HybridsearchResultsGroupObject** 

## getNodes

Get all nodes from current search result.

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

Returns **array** collection of {HybridsearchResultsNode}
