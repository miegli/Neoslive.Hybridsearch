# HybridSearch

HybridSearch is a powerful realtime search engine written in Javascript/AngularJS based on an intelligent indexing mechanism powered by [Google Firebase](http://firebase.google.com/) (noSQL). Hybrid stands for the innovative way of streaming search results. Every search request delivers small and preselected data blocks and then they are processed client side for calculation the search result. Whenever data of the source application (Neos CMS, Magento, etc.) was changed, HybridSearch updates the search index und performs a live update of current search results - that's why we call it realtime search engine. The search engine was invented by [Michael Egli](http://www.assoftware.ch) in 2016 and it's a free open source software. Special thanks to Oliver Nightingale ([lunr.js](https://github.com/olivernn/lunr.js/)) and Wei Song ([elasticlunr.js](https://github.com/weixsong/elasticlunr.js)).


## Features
* **Search as you type** (autocomplete and autocorrect were done in background).
* **Realtime binding** (search index and results view).
* Analyzes Google Analytics Reports for **better semantics** (optionally).
* Creates search index from rendered and structured data, not just from raw data.
* No configuration needed while indexing.
* **Provides a javascript framework for creating fantastic user experience**.
* Minimal, but **powerful configurations** (relevance boosting, filtering, facets, etc.)
* **High performance**, no Server-side utilization while searching.
* Supports up to 10'000 parallel/concurrency search requests.

## Implementations
HybridSearch comes with default integration for [Neos CMS](https://www.neos.io). Other implementations can be done very easy. Default Implementation for Magento is coming soon.

## Installation with Neos

### Backend

#### Minimal configuration

 `composer require neoslive/hybridsearch`

Create new a firebase project for [free](https://console.firebase.google.com/). Then you need a database token. Open your firebase project settings and create new database secret/token (see service accounts > Database secrets).

Add to your flow Settings.yaml (minimal configuration)

```
Neoslive:
  Hybridsearch:
    Realtime: true 
    Firebase:
      endpoint: 'https://** your firebase project name**.firebaseio.com/'
      token: '** your firebase token **'
    Filter:
      GrantParentNodeTypeFilter: '[instanceof TYPO3.Neos:Document]'
      ParentNodeTypeFilter: '[instanceof TYPO3.Neos:Node]'
      NodeTypeFilter: '[instanceof TYPO3.Neos:Content]'
```

#### Optimal configuration

Example of Settings.yaml 

```
Neoslive:
  Hybridsearch:
    Realtime: true
    Firebase:
      endpoint: 'https://** your firebase project name**.firebaseio.com/'
      token: '** your firebase token **'
    Filter:
      GrantParentNodeTypeFilter: '[instanceof TYPO3.Neos:Document]'
      ParentNodeTypeFilter: '[instanceof TYPO3.Neos:Node]'
      NodeTypeFilter: '[instanceof Neoslive.Hybridsearch:Content]'
    TypoScriptPaths:
      page:
        Vendor.Package: neosliveHybridsearch
      breadcrumb:
        Vendor.Package: neosliveHybridsearchBreadcrumb

```
If you are using optimal configuration, then you need also something like following settings.

TypoScript (root.ts)

```
neosliveHybridsearch = TYPO3.TypoScript:Collection {
    collection = ${q(node)}
    itemName = 'node'
    itemRenderer = TYPO3.Neos:ContentCase
}

neosliveHybridsearchBreadcrumb = TYPO3.TypoScript:Collection {
    collection = ${q(node)}
    itemName = 'node'
    itemRenderer = Breadcrumb
}
```

NodeTypes.yaml

```
# Make your contact node searchable
'Vendor.Package:Contact:
  superTypes:
    'Neoslive.Hybridsearch:Content': TRUE
    
```

#### Indexing your data

Run flow command for initial indexing your Neos Site

`php ./flow hybridsearch:createfullindex`

For better semantic you should use optimal configuration and don't index all of your node types. The indexer is rendering every node as a standalone front-end view and not simple raw data, so initially it takes time. But the result is magic.

If you have set "Realtime: true", then all further changes are done automatically as an intelligent background job asynchronously and without any performance impacts while editing in Neos backend.

It's recommended to execute full index creating from time to time. Just create a cronjob like this one:

`1 1 * * 1 FLOW_CONTEXT=Production php -d memory_limit=8096M /home/www-data/flow hybridsearch:createfullindex >/dev/null 2>&1`

So, while your index is creating you should not waiting and do the frontend integration.

### Front-End

Add the following javascript files to your layout/template.

```
<script src="{f:uri.resource(path: 'Vendor/angular/angular.min.js', package: 'Neoslive.Hybridsearch')}"></script>
<script src="{f:uri.resource(path: 'Vendor/firebase/firebase.js', package: 'Neoslive.Hybridsearch')}"></script>
<script src="{f:uri.resource(path: 'Vendor/angularfire/dist/angularfire.min.js', package: 'Neoslive.Hybridsearch')}"></script>
<script src="{f:uri.resource(path: 'Vendor/angular-sanitize/angular-sanitize.min.js', package: 'Neoslive.Hybridsearch')}"></script>
<script src="{f:uri.resource(path: 'Vendor/elasticlunr.js/elasticlunr.min.js', package: 'Neoslive.Hybridsearch')}"></script>
<script src="{f:uri.resource(path: 'hybridsearch.js', package: 'Neoslive.Hybridsearch')}"></script>
```

Create an Angular Controller.


```  
.controller('searchCtrl', ['$scope', '$hybridsearch', '$hybridsearchObject', '$hybridsearchResultsObject', function ($scope, $hybridsearch, $hybridsearchObject, $hybridsearchResultsObject) {

// initialize scope vars
$scope.result = new $hybridsearchResultsObject();
$scope.query = '';

// initialize HybridSearch
var search = new $hybridsearchObject(
                new $hybridsearch(
                    'https://** your firebase project name**.firebaseio.com',
                    'live',
                    '** dimensionHash **',
                    '** nodename of the site'
        ));
        
// set search settings and run HybridSearch
search
.setQuery('query',$scope)
.$bind('result', $scope)
.run();     

}]);


```
                
Create an HTML search page.


```
<div data-ng-controller="searchCtrl">
    
    <h1>Search:</h1> 
    <input type="text" data-ng-model="query" placeholder="Search for...">
    
    <h1>Results {{result.count()}}</h1>
    
     <div data-ng-repeat="node in result.getNodes()">
         <h2>{{node.getProperty('title')}}</h2>
         <p>{{node.getPreview()}}</p>
     </div>
  
</div>

```

## HybridSearch own JavaScript Framework

HybridSearch provides a javascript framework for creating fantastic user experience. Create robust search-as-you-type, lists, facet-filters, etc. in minutes - and everything is wired to the realtime index without writing one line of code.

### Initializing


```
var hybridSearch = new $Hybridsearch(
 'https://<DATABASE_NAME>.firebaseio.com',
 'live',
 'fb11fdde869d0a8fcfe00a2fd35c031d',
 'site-root-node-name'
));
var mySearch = new $HybridsearchObject(hybridSearch);
```

## $HybridsearchObject (define the search request)

This is the main request object, where all methods are called that are defining the search request.

## Configuration methods

This methods are influencing the behavior of the search result.

### setNodeTypeLabels
For each resulting nodeType the search engine creates a group name by the nodeType. So you can easy create facetted search results, etc.. With the method setNodeTypeLabels you are able to combine several nodeType groups into one. 

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| nodetypelabels | Object | set nodeType labels grouped result |

##### Returns
{HybridsearchObject} the search object

##### Examples

* `setNodeTypeLabels({'vendor-package-contact': 'Persons'},{'vendor-package-customers': 'Persons'})` group contact and customers into one group called "Persons". 

-------


### setPropertiesBoost
Adjust the relevance score calculation for each nodeType property. Higher values means higher relevance score for matching properties.

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| boost | Object | Adjust the relevance score  |

##### Returns
{HybridsearchObject} the search object

##### Examples

* `setPropertiesBoost({'vendor-package-contact-name': 50},{'vendor-package-contact-lastname': 50})` query matchings in lastname are higher scored in 

-------



### setParentNodeTypeBoostFactor
Adjust the relevance score calculation for each node by parent node type. The given boost value is the factor that is applied to the relavence score of each node.

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| boost | Object | Adjust the relevance score by given factor |

##### Returns
{HybridsearchObject} the search object

##### Examples

* `setParentNodeTypeBoostFactor({'typo3-neos-contentcollection1': 1.8,'typo3-neos-contentcollection2': 1.5})` nodes in parent node contentcollection1 are higher scored than nodes in contentcollection2 

-------




## Filtering methods

This methods are restricting the search result.

### setQuery
Sets a query for the search. If scope is given, then threat the param as reference to the scopes variable and watch automatically for any changes. If param scope is undefined then search for the string itself.

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| query | String | query search for |
| scope (optional) | Scope | angular scope |

##### Returns
{HybridsearchObject} the search object

-------


### setNodeType
Sets the nodeType (example 'vendor-package-contact'). If scope is given, then threat the param as reference to the scopes variable and watch automatically for any changes. If param scope is undefined then search for the string itself. NodeTypes are equivalent to Neos NodeTypes, but all special chars a replaced with '-' and everything is lowercase.

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| nodeType | String | restrict search to given NodeType |
| scope (optional) | Scope | angular scope |

##### Returns
{HybridsearchObject} the search object

### addPropertyFilter
Adds a property filter that restrict the search result. If scope is given, then threat the param as reference to the scopes variable and watch automatically for any changes. If param scope is undefined then search for the string itself.

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| property | String | name of the property to filter |
| value | String, ArrayLike, ObjectLike | value(s) to filter |
| scope (optional) | Scope | angular scope |
| inverted (optional) | boolean | true filter is inverted  |
| booleanmode (optional) | boolean | false if all array values must match all |
| nodeType (optional) | string | apply filter only to given nodeType |

##### Returns
{HybridsearchObject} the search object

##### Examples

```
var persons = [
{'name':'michael','lastname': 'moor', primaryAdress: {'email': 'foo@bar.com'},secondaryAdress: {'email': 'foo@bar.com'}
{'name':'peter','lastname': 'moor', primaryAdress: {'email': 'peter@foo.com'},secondaryAdress: {'email': 'peter@bar.com'}
];
```

* `addPropertyFilter('persons.name',['michael','peter'])` finds persons with name 'michael' or 'peter'
* `addPropertyFilter('persons.name',{'michael': true,'peter': false})` finds persons with name 'michael' but not 'peter'
* `addPropertyFilter('persons.*.email','foo@bar.com')` finds persons with email 'foo@bar.com' in primary or secondary address.


### setNodePath
Sets the node path (or uri segment) that is the entry point searching for. If scope is given, then threat the param as reference to the scopes variable and watch automatically for any changes. If param scope is undefined then search for the string itself. NodeTypes are equivalent to Neos NodeTypes, but all special chars a replaced with '-' and everything is lowercase.

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| nodePath | String | restrict search to given node path |
| scope (optional) | Scope | angular scope |

##### Returns
{HybridsearchObject} the search object

##### Examples

* `setNodePath('/company/about/')` get only search results, that are under the uri path '/company/about/'

-------

## Preprocessing methods

This methods are called before the search filters are applied.

### addNodesByIdentifier
Add nodes to local search index by given node identifiers (uuid). If the there are no further restrictions (filters), then the added nodes are added to the search result.

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| nodes | Array | add nodes to search result |

##### Returns
{HybridsearchObject} the search object

##### Examples

* `addNodesByIdentifier(['64021902-b7d9-11e6-80f5-76304dec7eb7','57978ed3-6e41-48ce-8421-22d80beacef0'])` add the nodes to local search index.

-------



## Postprocessing methods

This methods are called after the search result was calculated.

### setOrderBy
Sets orderings for the result. You can order the result in template view, but then you cannot use the limit/paginate method. Orderings are configured per nodeType or nodeTypeLabel. Ordering cannot be DESC because its an internal behavior of complex search algorithm.

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| orderBy | Object | set orderings for each given nodeType or nodeTypeLabel |

##### Returns
{HybridsearchObject} the search object

##### Examples

* `setOrderBy({'vendor-package-contact': ['name','lastname']})` sorts result by name and lastname for contact nodes
* `setOrderBy({'*': 'title'})` sorts result by title for all other nodes

-------


### setGroupedBy
Group the result by given identifiers. With this groupedBy function you can filter out duplicates from the search result. GroupedBy are configured per nodeType or nodeTypeLabel. 

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| groupBy | Object | set groupBy for each given nodeType or nodeTypeLabel |

##### Returns
{HybridsearchObject} the search object

##### Examples

* `setGroupedBy({'vendor-package-contact': ['name','lastname']})` group result by name and lastname for contact nodes. So only persons with different fullnames were applied to the search result. 
* `setGroupedBy({'*': 'title'})` group result by title for all other nodes

-------



## Runtime methods

This methods are called not more than once while initializing.

### $watch
Watching the {HybridsearchResultsObject} for any changes.

##### Returns
{HybridsearchObject} the search object

##### Examples

* `$watch(function(data) {console.log(data);})` The function argument 'data' contains the current search result.

-------

### $bind
Bind the {HybridsearchResultsObject} to given scope variable.

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| variable | String | scope variable name for binding to|
| scope | Scope | angular scope |

##### Returns
{HybridsearchObject} the search object

##### Examples

* `$bind('result',$scope)` The search result is automatically applied to the angular scope variable 'result', that you can use in your controller.

-------


## $HybridsearchResultsObject (define the search result)

This is the main result object, where all methods are called that are presenting the search result.

## Runtime methods

### isLoading
Check if search is in progress. Return false when current search is done.

##### Returns
{boolean} if search is done or not

##### Examples

* `$scope.status = isLoading() ? 'please wait' : countAll()+' results found'` 

-------

## Counter methods

The counter methods delivers statistics about current search result.

### count
Get number of nodes in current result (excluding turbo nodes) 

##### Returns
{Integer} number of nodes excluding turbonodes

##### Examples

* `<div>Results {{result.count()}}</div>` where result is scope variable with binding to HybridsearchResultsObject (see $bind)

-------

### countAll
Get number of nodes in current result (including turbo nodes) 

##### Returns
{Integer} number of nodes including turbo nodes

-------

### countTurboNodes
Get number of turbo nodes nodes in current result

##### Returns
{Integer} number of turbo nodes

-------

### countByNodeType
Get number of nodes in current result by node type

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| nodeType | String | nodeType |


##### Returns
{Integer} number of nodes 


-------

### countByNodeTypeLabel
Get number of nodes in current result by node type label

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| nodeTypeLabel | String | nodeType label |


##### Returns
{Integer} number of nodes 

-------

### getDistinctCount
Get number of different values (distinct) of current search result.

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| property | String | name of the property for distinct calculcation |


##### Returns
{Integer} number of different values 


## Getter methods

The getter methods delivers the result as collection {HybridsearchResultsNode}.

### getNodes
Get result collection (excluding turbo nodes) 

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| limit (optional) | Integer | number of results |

##### Returns
{Array} Collection of HybridsearchResultsNode

##### Examples

* `<ul><li data-ng-repeat="node in result.getNodes()">{{node.getProperty('title')}}</li></ul>` where result is scope variable with binding to HybridsearchResultsObject (see $bind)

-------

### getTurboNodes
Get result collection (only turbo nodes) 

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| limit (optional) | Integer | number of results |

##### Returns
{Array} Collection of HybridsearchResultsNode


-------

### getNodesByNodeType
Get result collection by node type

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| nodeType | String | node type |

##### Returns
{Array} Collection of HybridsearchResultsNode

-------

### getNodesByNodeTypeLabel
Get result collection by node type label

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| nodeType | String | node type label |

##### Returns
{Array} Collection of HybridsearchResultsNode


-------

### getDistinct
Get distinct values of given property

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| property | String | name of the property for distinct calculcation |

##### Returns
{Object.value} Value
{Object.count} Number of nodes containing this value.



-------

### getGrouped
Get alle nodes from current search result a grouped object.

##### Returns
{HybridsearchResultsGroupObject} Result groups

##### Examples


```
<ul>
 <li data-ng-repeat="group in result.getGrouped().getItems()">
  <h1>{{group.getLabel()}} ({{group.count()}})</h1>
    <ul>
      <li data-ng-repeat="node in group.getNodes()">
        <h2>{{node.getProperty('title')}} </h2>
        <div data-ng-bind-html="node.getBreadcrumb()"></div>
      </li>
    </ul>
 </li>
</ul>
```

Where result is scope variable with binding to HybridsearchResultsObject (see $bind)




-------


## $HybridsearchResultsGroupObject (define a group of result)

This object is representing a grouped result.


### count
Get number of items in group object

##### Returns
{Integer} number of items


### getItems
Get group items as array

##### Returns
{array} collection of {HybridsearchResultsDataObject}




-------


## $HybridsearchResultsDataObject (define a set of results)

This object is representing a group of result items.


### count
Get number of items in this group

##### Returns
{Integer} number of items

### getLabel
Get groups label

##### Returns
{String} label of group

### getNodes
Get result collection (excluding turbo nodes) 

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| limit (optional) | Integer | number of results |

##### Returns
{Array} Collection of HybridsearchResultsNode

### getProperty
Get value of first node in the group by given property. This is useful for getting values for grouped objects.

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| property | String | Name of the property |

##### Returns
{Mixed} Properties value











-------


## $HybridsearchResultsNode (define a single result item/node)

This object is representing a single result item.

## Getter methods

The getter methods delivers all informations about the item.

### getNodeType
Get the node type.

##### Returns
{String} node type


-------

### getScore
Get the relevance score of the items.

##### Returns
{integer} relevance score (highest value is highest relevance)

-------


### isTurboNode
Check if its a turbo node or a normal node.

##### Returns
{boolean} true if is a turbo node, false is default node

-------

### getBreadcrumb
Get breadcrumb as HTML code (if its a document node).

##### Returns
{String} HTML

-------


### getUrl
Get Url (if its a document node).

##### Returns
{String} url

-------


### getPreview
Get rendered preview of node.

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| maxlength (optional) | Integer | max. length of preview text |

##### Returns
{String} preview content

-------

### getSortingIndex
Get sorting index of node.


##### Returns
{Integer} sorting index value

-------

### getProperty
Get value by given property.

##### Arguments

| Param | Type | Details
| --- | --- | --- |
| property | String | Name of the property |

##### Returns
{Mixed} Properties value

##### Examples

* `{{node.getProperty('name')}}` return the name of mixed node types
* `{{node.getProperty('vendor-package-contact-name')}}` return only the name of node type vendor-package-contact
* `{{node.getProperty('primaryAdress.email')}}` return primary email
* `{{node.getProperty('*.email')}}` return all email addresses

-------

### getDocumentNode
Get the nearest document node.


##### Returns
{HybridsearchResultsNode} HybridsearchResultsNode containing breadcrumb and url

##### Examples

```
<ul>
  <li data-ng-repeat="node in result.getNodes()">
    <h2>{{node.getDocumentNode().getProperty('title')}} </h2>
    <p>Name: {node.getProperty('name')}}</p>
    <p>Lastname: {node.getProperty('lastname')}}</p>
   </li>
</ul>
```




