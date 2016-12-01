# HybridSearch

HybridSearch is a powerful realtime search engine written in Javascript/AngularJS with an intelligent indexing mechanism combined with by [Google Firebase](http://firebase.google.com/) (noSQL). Hybrid stands for the innovative way of streaming search results. Every search request delivers small and preselected data blocks and then they are processing on client side for calculation the search result. Whenever data of the noSQL database changes, HybridSearch performs a live update of the current search result - that's why we call it realtime search engine. The search engine was invented by Michael Egli in 2016 and it's a free open source software. Special thanks to Oliver Nightingale ([lunr.js](https://github.com/olivernn/lunr.js/)) and Wei Song ([elasticlunr.js](https://github.com/weixsong/elasticlunr.js)).

## Features
* **Search as you type** (autocomplete and autocorrect were done in background).
* **Realtime binding** (full search index and search results).
* Analyzes Google Analytics Reports for **better semantics** (optionally).
* **Provides a javascript framework for creating fantastic user experience**.
* Minimal, but **powerful configurations** (relevance boosting, filtering, facets, etc.)
* **High performance**, no Server-side utilization while searching.

## Implementations
HybridSearch comes with default integration for [Neos CMS](https://www.neos.io). Other implementations can be done very easy.

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
      ParentNodeTypeFilter: '[instanceof TYPO3.Neos:Contentcollection]'
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
      ParentNodeTypeFilter: '[instanceof TYPO3.Neos:Content]'
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

