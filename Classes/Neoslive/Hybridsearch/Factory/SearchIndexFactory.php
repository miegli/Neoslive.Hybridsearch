<?php
namespace Neoslive\Hybridsearch\Factory;

/*
 * This file is part of the Neoslive.Hybridsearch package.
 *
 * (c) Contributors to the package
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */


use Neoslive\Hybridsearch\Domain\Repository\NeosliveHybridsearchNodeDataRepository;
use Neoslive\Hybridsearch\View\HybridSearchFusionView;
use Neos\Flow\Annotations as Flow;
use Neos\Flow\Configuration\ConfigurationManager;
use Neos\Flow\Error\Exception;
use Neos\Flow\Mvc\Controller\ControllerContext;
use Neos\Flow\Mvc\Routing\UriBuilder;
use Neos\Flow\Persistence\Doctrine\PersistenceManager;
use Neos\Utility\ObjectAccess;
use Neos\Flow\ResourceManagement\ResourceManager;
use Neos\Media\Domain\Model\Asset;
use Neos\Media\Domain\Model\ImageVariant;
use Neos\ContentRepository\Domain\Model\NodeData;
use Neos\ContentRepository\Domain\Model\NodeInterface;
use Neos\Flow\Mvc\Controller\Arguments;
use Neos\Neos\Domain\Repository\SiteRepository;
use Neos\Neos\Domain\Service\ContentContextFactory;
use Neos\Neos\Domain\Service\FusionService;
use Neos\ContentRepository\Domain\Model\Node;
use Neos\Neos\Domain\Model\Site;
use Neos\ContentRepository\Domain\Model\Workspace;
use Neos\ContentRepository\Domain\Repository\NodeDataRepository;
use Neos\ContentRepository\Domain\Repository\WorkspaceRepository;
use Neos\ContentRepository\Domain\Service\ContentDimensionCombinator;
use Neos\Eel\FlowQuery\FlowQuery;
use \ForceUTF8\Encoding;
use Firebase\FirebaseLib;
use Neos\Flow\Utility\Algorithms;
use Neos\Flow\Core\Booting\Scripts;
use Neos\Neos\Service\LinkingService;
use Neos\Flow\Cli\ConsoleOutput;
use Neos\Flow\Mvc\ActionRequest;
use Neos\Fusion\View\FusionView;
use Neos\Flow\Core\Bootstrap;
use Neoslive\Hybridsearch\Request\HttpRequestHandler;


class SearchIndexFactory
{

    /**
     * @Flow\InjectConfiguration(package="Neos.Flow")
     * @var array
     */
    protected $flowSettings;


    /**
     * @Flow\InjectConfiguration(package="Neos.Flow", path="http.baseUri")
     * @var string
     */
    protected $baseUri;


    /**
     * @var PersistenceManager
     * @Flow\Inject
     */
    protected $persistenceManager;
    /**
     * @var ConfigurationManager
     * @Flow\Inject
     */
    protected $configurationManager;

    /**
     * @var GoogleAnalyticsFactory
     * @Flow\Inject
     */
    protected $googleAnalyticsFactory;


    /**
     * @var ConsoleOutput
     * @Flow\Inject
     */
    protected $output;


    /**
     * @Flow\Inject
     * @var WorkspaceRepository
     */
    protected $workspaceRepository;

    /**
     * @Flow\Inject
     * @var UriBuilder
     */
    protected $uriBuilder;

    /**
     * @Flow\Inject
     * @var ResourceManager
     */
    protected $resourceManager;

    /**
     * @Flow\Inject
     * @var NodeDataRepository
     */
    protected $nodeDataRepository;

    /**
     * @Flow\Inject
     * @var NeosliveHybridsearchNodeDataRepository
     */
    protected $neosliveHybridsearchNodeDataRepository;


    /**
     * @Flow\Inject
     * @var FusionService
     */
    protected $fusionService;

    /**
     * @var \Neos\Neos\View\FusionView
     */
    protected $view;

    /**
     * @var ActionRequest
     * @Flow\Transient
     */
    protected $request;

    /**
     * @Flow\Inject
     * @var SiteRepository
     */
    protected $siteRepository;

    /**
     * @var \Neos\Flow\Utility\Environment
     */
    protected $environment;

    /**
     * @Flow\Inject
     * @var ContentContextFactory
     */
    protected $contentContextFactory;


    /**
     * @Flow\Inject
     * @var Bootstrap
     */
    protected $bootstrap;

    /**
     * @var ControllerContext
     */
    protected $controllerContext;


    /**
     * @Flow\Inject
     * @var ContentDimensionCombinator
     */
    protected $contentDimensionCombinator;


    /**
     * @Flow\Inject
     * @var LinkingService
     */
    protected $linkingService;


    /**
     * @var Site
     */
    protected $site;

    /**
     * @var array
     */
    protected $allDimensionCombinations;


    /**
     * @var array
     */
    protected $allSiteKeys;


    /**
     * @var \stdClass
     */
    protected $ga;


    /**
     * @var \stdClass
     */
    protected $index;


    /**
     * @var \stdClass
     */
    protected $keywords;


    /**
     * @var integer
     */
    protected $queuecounter;


    /**
     * @var integer
     */
    protected $proceedcounter;


    /**
     * @var integer
     */
    protected $indexcounter;


    /**
     * @Flow\InjectConfiguration(package="Neoslive.Hybridsearch")
     * @var array
     */
    protected $settings;


    /**
     * @var string
     */
    protected $temporaryDirectory;

    /**
     * @var string
     */
    protected $branch;

    /**
     * @var boolean
     */
    protected $branchWasSet;

    /**
     * @var string
     */
    protected $branchSwitch;


    /**
     * @var FirebaseLib
     */
    protected $firebase;


    /**
     * @var boolean
     */
    protected $creatingFullIndex = false;

    /**
     * @var array
     */
    protected $nodeProceeded = [];

    /**
     * @var array
     */
    protected $nodeTypeConfiguration = [];


    /**
     * @var array
     */
    protected $renderedcache = [];


    /**
     * @var integer
     */
    protected $time = 0;


    /**
     * Inject the settings
     *
     * @param array $settings
     * @return void
     */
    public function injectSettings(array $settings)
    {
        $this->settings = $settings;


        putenv('FLOW_REWRITEURLS=1');

    }

    /**
     * Injects the Environment object
     *
     * @param \Neos\Flow\Utility\Environment $environment
     * @return void
     */
    public function injectEnvironment(\Neos\Flow\Utility\Environment $environment)
    {

        if (isset($this->settings['Firebase']) && isset($this->settings['Firebase']['endpoint']) && isset($this->settings['Firebase']['token'])) {

            $this->firebase = new FirebaseLib($this->settings['Firebase']['endpoint'], $this->settings['Firebase']['token']);
            $this->firebase->setTimeOut(0);

        }

        $this->environment = $environment;

        $temporaryDirectory = $this->environment->getPathToTemporaryDirectory() . 'NeosliveHybridsearch/';

        if (!is_writable($temporaryDirectory)) {
            try {
                \Neos\Utility\Files::createDirectoryRecursively($temporaryDirectory);
            } catch (\Neos\Flow\Utility\Exception $exception) {
                throw new Exception('The temporary directory "' . $temporaryDirectory . '" could not be created.', 1264426237);
            }
        }
        if (!is_dir($temporaryDirectory) && !is_link($temporaryDirectory)) {
            throw new Exception('The temporary directory "' . $temporaryDirectory . '" does not exist.', 1203965199);
        }
        if (!is_writable($temporaryDirectory)) {
            throw new Exception('The temporary directory "' . $temporaryDirectory . '" is not writable.', 1203965200);
        }

        $this->temporaryDirectory = $temporaryDirectory;
        $this->queuecounter = 100000000;
        $this->allSiteKeys = array();
        $this->index = new \stdClass();
        $this->keywords = new \stdClass();
        $this->branch = "master";
        $this->branchSwitch = "slave";
        $this->renderedcache = [];
        $GLOBALS["neoslive.hybridsearch.insyncmode"] = true;

        $this->time = time();

        if (isset($this->settings['Realtime']) == false) {
            $this->settings['Realtime'] = false;
        }


    }


    /**
     * Set current branch
     * @param string $workspacename
     * @param string $branch
     * @return void
     */
    public function setBranch($workspacename = 'live', $branch = 'master')
    {

        $this->firebaseSet("/branches/" . $workspacename, $branch);
        $this->branch = $branch;

    }

    /**
     * get current branch
     * @param string $workspacename
     * @return string
     */
    public function getBranch($workspacename = 'live')
    {


        $branch = $this->firebase->get("/branches/" . $workspacename);
        if ($branch === null) {
            return 'master';
        }
        if ($branch) {
            return trim($branch, '"');
        } else {
            return $this->branch ? $this->branch : 'master';
        }


    }


    /**
     * switch current branch
     * @param string $workspacename
     * @return string
     */
    public function switchBranch($workspacename = 'live')
    {

        $currentBranch = $this->getBranch($workspacename);

        if ($currentBranch == $this->branch) {
            $this->branch = $this->branchSwitch;
            $this->branchSwitch = $currentBranch;
        }


    }


    /**
     * Create full search index for given workspace
     * @param string $workspacename
     * @param string $nodetype
     * @return void
     */
    public function createFullIndex($workspacename = 'live', $nodetype = null)
    {

        $sites = array();

        $this->deleteQueue();
        $this->lockReltimeIndexer();
        $this->firebase->set("/lastsync/$workspacename/" . $this->branch, time());

        $this->creatingFullIndex = true;


        foreach ($this->siteRepository->findAll() as $site) {
            $this->site = $site;
            array_push($this->allSiteKeys, $this->getSiteIdentifier());
            $this->switchBranch($workspacename);
            array_push($sites, $this->getSiteIdentifier());
        }

//

        $basenodedata = $this->nodeDataRepository->findOneByPath("/sites/" . $this->site->getNodeName(), $this->workspaceRepository->findByIdentifier($workspacename));
        $context = $this->createContext($basenodedata->getWorkspace()->getName(), $basenodedata->getDimensions(), array(), $this->site);


        /** @var Node $node */

        $basenode = new Node(
            $basenodedata,
            $context
        );

        $flowQuery = new FlowQuery(array($basenode));

        if ($nodetype) {
            $moditifedNodeData = $flowQuery->find("[instanceof $nodetype]");
        } else {
            $moditifedNodeData = $flowQuery->find($this->settings['Filter']['NodeTypeFilter']);
        }

        $this->output->progressStart($moditifedNodeData->count());


        foreach ($moditifedNodeData as $nodedata) {
            $this->output->progressAdvance(1);
            $this->updateIndexForNodeData($nodedata, $nodedata->getWorkspace(), true);


        }


        $this->save();
        $this->unlockReltimeIndexer();
        $this->proceedQueue();
        $this->updateFireBaseRules();


        // remove old sites data
        foreach ($sites as $s) {
            $this->switchBranch($workspacename);
            $this->deleteIndex($s, $this->branch);
        }

        // remove trash
        $this->firebase->delete("/trash");
        $this->output->progressFinish();


        return true;


    }


    /**
     * Sync index
     * @param string $workspaceName
     * @param NodeData $nodedata
     */
    public function syncIndexRealtime($workspaceName = 'live', $nodedata = null)
    {

        if ($this->settings['Realtime'] == true) {

            if ($nodedata) {
                Scripts::executeCommandAsync('hybridsearch:sync', $this->flowSettings, array('workspaceName' => $workspaceName, 'node' => $nodedata->getIdentifier()));
            } else {
                Scripts::executeCommandAsync('hybridsearch:sync', $this->flowSettings, array('workspaceName' => $workspaceName, 'timestamp' => time()));
            }


        }

    }


    /**
     * Removes trashes nods
     */
    private function removeTrashedNodes()
    {


        // remove nodes from trash
        $trash = json_decode($this->firebase->get("/trash"));


        if ($trash) {
            foreach ($trash as $site => $siteData) {

                if ($siteData) {


                    foreach ($siteData as $workspace => $workspaceData) {
                        if ($workspaceData) {

                            foreach ($workspaceData as $branch => $branchData) {

                                foreach ($branchData as $dimension => $dimensionData) {

                                    if ($dimensionData) {
                                        foreach ($dimensionData as $nodeIdentifier => $trashTimestamp) {

                                            if ($dimension === 'd751713988987e9331980363e24189ce') {
                                                // if no dimension is set, then iterate over all dimensions
                                                foreach ($this->getAllDimensionCombinations() as $dimensionConfiguration) {
                                                    $this->removeSingleIndex($nodeIdentifier, $workspace, $branch, $this->getDimensionConfiugurationHash($dimensionConfiguration), array(), $site);
                                                }
                                            } else {
                                                $this->removeSingleIndex($nodeIdentifier, $workspace, $branch, $dimension, array(), $site);
                                            }


                                        }

                                    }
                                }

                            }


                        }
                    }

                }


            }
        }


    }

    /**
     * Execute realtime sync
     * @return boolean
     */
    public function executeRealtimeSync()
    {

        if (isset($GLOBALS['neoslivehybridsearchrealtimequeue'])) {

            foreach ($GLOBALS['neoslivehybridsearchrealtimequeue'] as $workspaceName => $nodes) {
                   // Scripts::executeCommand('hybridsearch:sync', $this->flowSettings, true,array('workspaceName' => $workspaceName, 'nodesSerialized' => serialize($nodes)));
                    Scripts::executeCommandAsync('hybridsearch:sync', $this->flowSettings, array('workspaceName' => $workspaceName, 'nodesSerialized' => serialize($nodes)));
                    $GLOBALS['neoslivehybridsearchrealtimequeue'][$workspaceName] = array();
            }

        }


    }

    /**
     * Update index
     * @param string $workspaceName
     * @param string nodeTypeName
     * @param integer timestamp
     * @param string node identifier
     * @param string $nodesSerialized
     * @return boolean
     */
    public function sync($workspaceName = 'live', $nodeTypeName = null, $timestamp = null, $nodeIdentifier = null, $nodesSerialized = null)
    {


        $this->branch = $this->getBranch($workspaceName);


        if ($nodeTypeName) {
            $this->syncByNodeType($workspaceName, $nodeTypeName);
            return true;
        }
        if ($nodeIdentifier) {
            $this->syncByNodeIdentifier($workspaceName, $nodeIdentifier);
            $this->save(true);
            $this->proceedQueue();

            $this->output->outputLine("done");
            return true;
        }

        if ($nodesSerialized) {

            $j = unserialize($nodesSerialized);


            if (is_array($j)) {
                foreach ($j as $id => $n) {
                    $this->syncByNodeIdentifier($workspaceName, $id);
                }
            }

            $this->save();
            $this->proceedQueue();

            $this->output->outputLine("done");
            return true;

        }

        if ($timestamp == null) {
            $lastsync = $this->firebase->get("/lastsync/$workspaceName/" . $this->branch);
        } else {
            $lastsync = $timestamp;
        }

        $date = new \DateTime();

        if ($lastsync) {
            $date->setTimestamp(intval($lastsync));
            if ($timestamp) {
                $date->setTime($date->format("H"), $date->format("i"), 0);
            }
        }

        $lastSyncDateTime = new \DateTime();
        $lastSyncDateTime->setTime($lastSyncDateTime->format("H"), $lastSyncDateTime->format("i"), 0);
        $lastSyncTimestamp = $lastSyncDateTime->getTimeStamp();

        if ($timestamp == null) {
            $this->firebase->set("/lastsync/$workspaceName/" . $this->branch, $lastSyncTimestamp);
        }
        $this->output->outputLine("sync from " . $date->format("d.m.Y H:i:s"));

        $moditifedNodeData = $this->neosliveHybridsearchNodeDataRepository->findByWorkspaceAndLastModificationDateTimeDate($this->workspaceRepository->findByIdentifier($workspaceName), $date);
        $this->output->outputLine('sync ' . count($moditifedNodeData) . ' nodes');

        if (count($moditifedNodeData)) {
            $this->removeTrashedNodes();
        }

        foreach ($moditifedNodeData as $nodedata) {
            $this->updateIndexForNodeData($nodedata, $nodedata->getWorkspace());
        }

        if (count($moditifedNodeData)) {
            $this->save();
            $this->proceedQueue();
        }


        return true;

    }

    /**
     * Update index
     * @param string $workspaceName
     * @param string nodeTypeName
     */
    private function syncByNodeType($workspaceName = 'live', $nodeTypeName = null)
    {


        $this->output->outputLine("sync all nodes from type " . $nodeTypeName);

        $moditifedNodeData = $this->neosliveHybridsearchNodeDataRepository->findByWorkspaceAndNodeTypeName($this->workspaceRepository->findByIdentifier($workspaceName), $nodeTypeName);
        $this->output->outputLine('sync ' . count($moditifedNodeData) . ' nodes');

        $this->output->progressStart(count($moditifedNodeData));

        foreach ($moditifedNodeData as $nodedata) {
            $this->updateIndexForNodeData($nodedata, $nodedata->getWorkspace());
            $this->output->progressAdvance(1);
        }

        $this->output->progressFinish();


        $this->save();
        $this->proceedQueue();


        $this->output->outputLine("done");

    }

    /**
     * Update index
     * @param string $workspaceName
     * @param string $nodeIdentifier
     */
    private function syncByNodeIdentifier($workspaceName = 'live', $nodeIdentifier)
    {


        $this->output->outputLine("sync node id " . $nodeIdentifier);

        $nodedata = $this->neosliveHybridsearchNodeDataRepository->findByIdentifierWithoutReduce($nodeIdentifier, $this->workspaceRepository->findByIdentifier($workspaceName));
        foreach ($nodedata as $node) {
            $this->updateIndexForNodeData($node, $node->getWorkspace(), true);
        }



    }


    /**
     * Update index for given nodedata
     * @param NodeData $nodedata
     * @param Workspace $workspace
     * @param boolean $noparentcheck
     * @return integer count of proceed nodes
     */
    public function updateIndexForNodeData($nodedata, $workspace, $noparentcheck = false)
    {

        $counter = 0;


        if (count($this->allSiteKeys) === 0) {
            $this->allSiteKeys = json_decode($this->firebase->get('sites', array('shallow' => 'true')));
        }


        foreach ($this->getAllDimensionCombinations() as $dimensionConfiguration) {


            $targetDimension = array_map(function ($dimensionValues) {
                return array_shift($dimensionValues);
            }, $dimensionConfiguration);

            $context = $this->contentContextFactory->create(['targetDimension' => $targetDimension, 'dimensions' => $dimensionConfiguration, 'workspaceName' => $nodedata->getWorkspace()->getName()]);

            $node = $context->getNodeByIdentifier($nodedata->getIdentifier());
            if ($node) {

                if (isset($this->settings['Filter']['NodeTypeFilter'])) {


                    $flowQuery = $noparentcheck ? null : new FlowQuery(array($node));

                    if ($noparentcheck === true || $flowQuery->is($this->settings['Filter']['NodeTypeFilter'])) {
                        if ($node->isHidden() || $node->isRemoved()) {
                            $this->removeSingleIndex($node->getIdentifier(), $this->getWorkspaceHash($workspace), $this->branch, $this->getDimensionConfiugurationHash($dimensionConfiguration));
                        } else {

                            if ($noparentcheck === false) {

                                $parent = $flowQuery->closest($this->settings['Filter']['GrantParentNodeTypeFilter'])->get(0);
                                if ($parent) {

                                    $flowQueryParent = new FlowQuery(array($parent));
                                    $parentNode = $flowQueryParent->closest($this->settings['Filter']['NodeTypeFilter'])->get(0);
                                    if ($parentNode) {
                                        $this->generateSingleIndex($parentNode, $workspace, $this->getDimensionConfiugurationHash($parentNode->getContext()->getDimensions()));
                                    }

                                }

                            }


                            $this->generateSingleIndex($node, $workspace, $this->getDimensionConfiugurationHash($node->getContext()->getDimensions()));
                            $counter++;
                        }

                    } else {

                        $nextnode = $flowQuery->closest($this->settings['Filter']['NodeTypeFilter'])->get(0);
                        if ($nextnode) {

                            $this->generateSingleIndex($nextnode, $workspace, $this->getDimensionConfiugurationHash($nextnode->getContext()->getDimensions()));

                            $flowQueryNext = new FlowQuery(array($nextnode));
                            $parent = $flowQueryNext->closest($this->settings['Filter']['GrantParentNodeTypeFilter'])->get(0);

                            if ($parent) {

                                $flowQueryParent = new FlowQuery(array($parent));
                                $parentNode = $flowQueryParent->closest($this->settings['Filter']['NodeTypeFilter'])->get(0);
                                if ($parentNode) {
                                    $this->generateSingleIndex($parentNode, $workspace, $this->getDimensionConfiugurationHash($parentNode->getContext()->getDimensions()));
                                }


                            }


                        }

                    }

                }


            }


            $context = null;
            $node = null;


            unset($context);
            unset($node);
            if (isset($flowQuery)) {
                $flowQuery = null;
                unset($flowQuery);
            }

        }

        return $counter;

    }


    /**
     * Check and Remove index for given nodeData
     * @param NodeData $nodedata
     */
    public function checkIndexRealtimeForRemovingNodeData($nodedata)
    {


        if ($this->settings['Realtime'] == true) {

            $this->lockReltimeIndexer();

            $p = explode("/", $nodedata->getContextPath());

            $this->site = $this->siteRepository->findByIdentifier($p[2]);
            $context = $this->createContext($nodedata->getWorkspace()->getName(), $nodedata->getDimensions(), array(), $this->site);


            /** @var Node $node */
            $node = new Node(
                $nodedata,
                $context
            );

            $flowQuery = new FlowQuery(array($node));

            if ($flowQuery->is($this->settings['Filter']['NodeTypeFilter']) === true) {

                $this->site = $node->getContext()->getCurrentSite();

                $this->firebase->set("/trash/" . $p[2] . "/" . $this->getWorkspaceHash($nodedata->getWorkspace()) . "/" . $this->branch . "/" . $this->getDimensionConfiugurationHash($node->getDimensions()) . "/" . $nodedata->getIdentifier(), time());

                // remove parent nodes from index and set last modification time for reindexing
                $counter = 0;
                $parentNode = $node;
                $lastpublicationsdate = new \DateTime();

                while ($parentNode && $counter < 5) {

                    /* @var Node $parentNode */
                    $parentNode->getNodeData()->setLastPublicationDateTime($lastpublicationsdate);
                    $this->nodeDataRepository->update($parentNode->getNodeData());
                    $this->firebase->set("/trash/" . $p[2] . "/" . $this->getWorkspaceHash($nodedata->getWorkspace()) . "/" . $this->branch . "/" . $this->getDimensionConfiugurationHash($node->getDimensions()) . "/" . $parentNode->getIdentifier(), time());
                    $this->persistenceManager->persistAll();
                    $parentNode = $parentNode->getParent();
                    $counter++;

                }


            }

            $this->syncIndexRealtime($nodedata->getWorkspace()->getName());
        }

    }

    /**
     * Check and Remove index for given node and target workspace
     * @param Node $node
     */
    public function checkIndexRealtimeForRemovingNode($node, $targetWorkspace)
    {


        if ($this->settings['Realtime'] == true && $node->isRemoved()) {

            $flowQuery = new FlowQuery(array($node));
            if ($flowQuery->is($this->settings['Filter']['NodeTypeFilter']) === true) {
                $this->site = $node->getContext()->getCurrentSite();
                $this->firebase->set("/trash/" . $this->getSiteIdentifier() . "/" . $this->getWorkspaceHash($targetWorkspace) . "/" . $this->branch . "/" . $this->getDimensionConfiugurationHash($node->getDimensions()) . "/" . $node->getIdentifier(), time());
            }
        }

    }


    /**
     * Generates recursive search index for given root node
     *
     * @param Node $node node used as entry point for creating search index
     * @param Workspace $workspace for generating index
     * @param array $dimensionConfiguration dimension configuration array
     * @param string $nodeTypeFilter If specified, only nodes with that node type are considered
     * @return void
     */
    private function generateIndex($node, $workspace, $dimensionConfiguration, $nodeTypeFilter = '')
    {


        if ($nodeTypeFilter === '') {
            if (isset($this->settings['Filter']['NodeTypeFilter'])) {
                $nodeTypeFilter = $this->settings['Filter']['NodeTypeFilter'];
            } else {
                $nodeTypeFilter = '[instanceof Neos.Neos:Content]';
            }
        }


        $dimensionConfigurationHash = $this->getDimensionConfiugurationHash($dimensionConfiguration);


        $flowQuery = new FlowQuery(array($node));
        if ($flowQuery->is($this->settings['Filter']['NodeTypeFilter']) === true) {
            $this->generateSingleIndex($node, $workspace, $dimensionConfigurationHash);
        }


        $children = $flowQuery->find($nodeTypeFilter);


        if ($children->count()) {
            $this->output->progressStart($children->count());

            foreach ($children as $child) {
                /** @var Node $children */
                $this->generateSingleIndex($child, $workspace, $dimensionConfigurationHash);
                $this->output->progressAdvance(1);

            }

            $this->output->progressFinish();
        }


    }


    /**
     * Remove single index for given node
     *
     * @param String $nodeIdentifier
     * @param String $workspaceHash
     * @param String $branch
     * @param string $dimensionConfigurationHash
     * @param array $keywordsOfNode current keywords
     * @return void
     */
    private function removeSingleIndex($nodeIdentifier, $workspaceHash, $branch, $dimensionConfigurationHash, $keywordsOfNode = array(), $siteIdentifier = null)
    {
        if ($siteIdentifier === null) {
            $siteIdentifier = $this->getSiteIdentifier();
        }

        $keywords = \json_decode($this->firebase->get("sites/" . $siteIdentifier . "/index/$workspaceHash/$branch/$dimensionConfigurationHash" . "/___keywords/" . urlencode($nodeIdentifier)));


        if ($keywords) {
            $keywordsremove = array();
            foreach ($keywords as $keyword) {
                if (count($keywordsOfNode) === 0 || in_array($keyword, $keywordsOfNode) === false) {
                    $keywordsremove[$keyword . "/" . urlencode($nodeIdentifier)] = null;
                }
            }
            $this->firebase->update("sites/$siteIdentifier/index/$workspaceHash/$branch/$dimensionConfigurationHash", $keywordsremove);
            if (count($keywordsOfNode) === 0) {
                $this->firebase->delete("sites/" . $siteIdentifier . "/index/$workspaceHash/$branch/$dimensionConfigurationHash" . "/___keywords/" . urlencode($nodeIdentifier));
            }
        }

        $this->firebase->delete("trash/$siteIdentifier/$workspaceHash/$branch/$dimensionConfigurationHash/$nodeIdentifier");


    }

    /**
     * Generates single index for given node
     *
     * @param Node $node
     * @param Workspace $workspace
     * @param string $dimensionConfigurationHash
     * @return void
     */
    private function generateSingleIndex($node, $workspace, $dimensionConfigurationHash)
    {

        $this->indexcounter++;

        $workspaceHash = $this->getWorkspaceHash($workspace);


        if (isset($this->nodeProceeded[sha1(json_encode(array($workspaceHash, $dimensionConfigurationHash, $node->getIdentifier())))]) === false) {


            if (isset($this->index->$workspaceHash) === false) {
                $this->index->$workspaceHash = new \stdClass();
            }

            if (isset($this->index->$workspaceHash->$dimensionConfigurationHash) === false) {
                $this->index->$workspaceHash->$dimensionConfigurationHash = new \stdClass();
            }


            if (isset($this->keywords->$workspaceHash) === false) {
                $this->keywords->$workspaceHash = new \stdClass();
            }

            if (isset($this->keywords->$workspaceHash->$dimensionConfigurationHash) === false) {
                $this->keywords->$workspaceHash->$dimensionConfigurationHash = array();
            }


            $indexData = $this->convertNodeToSearchIndexResult($node);


            $identifier = $indexData->identifier;

            $keywords = $this->generateSearchIndexFromProperties($indexData->properties, $indexData->nodeType);

            $nt = "__" . $this->getNodeTypeName($node);
            $keywords->$nt = true;
            $keywords->$identifier = true;


            $keywordsOfNode = array();

            foreach ($keywords as $keyword => $val) {
                $k = strval($keyword);
                if (substr($k, 0, 9) === "_nodetype") {
                    $k = "_" . $this->getNodeTypeName($node) . substr($k, 9);
                }

                if ($k) {
                    $this->keywords->$workspaceHash->$dimensionConfigurationHash[$k] = 1;
                }
                if (isset($this->index->$workspaceHash->$dimensionConfigurationHash->$k) === false) {
                    $this->index->$workspaceHash->$dimensionConfigurationHash->$k = new \stdClass();
                }
                $this->index->$workspaceHash->$dimensionConfigurationHash->$k->$identifier = array('node' => $indexData, 'nodeType' => $indexData->nodeType);
                array_push($keywordsOfNode, $k);

            }


            if (isset($this->index->$workspaceHash->$dimensionConfigurationHash->___keywords) === false) {
                $this->index->$workspaceHash->$dimensionConfigurationHash->___keywords = new \stdClass();
            }
            $this->index->$workspaceHash->$dimensionConfigurationHash->___keywords->$identifier = $keywordsOfNode;


            if ($this->creatingFullIndex === false) {
                $this->removeSingleIndex($node->getIdentifier(), $workspaceHash, $this->branch, $dimensionConfigurationHash, $keywordsOfNode);
            }


            $this->nodeProceeded[sha1(json_encode(array($workspaceHash, $dimensionConfigurationHash, $node->getIdentifier())))] = true;

            $node = null;
            $indexData = null;
            $keywords = null;
            unset($node);
            unset($indexData);
            unset($keywords);

            if (time() - $this->time > 300) {
                $this->time = time();
                $this->save();
            };

        }


    }

    /**
     * Generate search index words from properties array
     *
     * @param array $properties
     * @param string $nodeTypeName
     * @return void
     */
    protected function generateSearchIndexFromProperties($properties, $nodeTypeName)
    {

        if (count($properties) === 0) {
            return $properties;
        }

        $keywords = new \stdClass();

        $text = "";

        foreach ($properties as $property => $value) {
            if (gettype($value) !== 'string') {
                $value = json_encode($value);
            }
            $text .= strip_tags(preg_replace("/[^A-z0-9öäüÖÄÜ ]/", "", mb_strtolower(strip_tags(preg_replace("/[^A-z0-9öäüÖÄÜ]/", " ", $value)))) . " ");
        }

        $words = explode(" ", $text);

        foreach ($words as $w) {
            if (strlen($w) > 1) {
                $w = Encoding::UTF8FixWin1252Chars($w);
                $w = preg_replace('#[^\w()/.%\-&üöäÜÖÄ]#', "", $w);
                if ($w && strlen($w) > 1) {
                    $keywords->$w = 1;
                    $a = "_nodetype" . $w;
                    $keywords->$a = $nodeTypeName;
                }
            }
        }

        $properties = null;
        unset($properties);

        return $keywords;

    }


    /**
     * gets node type name
     * @param Node $node
     * @return string
     */
    private function getNodeTypeName($node)
    {
        return mb_strtolower(preg_replace("/[^A-z0-9]/", "-", $node->getNodeType()->getName()));
    }


    /**
     * @param Node $node
     * @param string $grandParentNodeFilter
     * @param string $parentNodeFilter
     * @return \stdClass
     */
    private function convertNodeToSearchIndexResult($node, $grandParentNodeFilter = '', $parentNodeFilter = '')
    {


        $data = new \stdClass();
        $data->nodeType = $this->getNodeTypeName($node);


        if ($grandParentNodeFilter === '') {
            if (isset($this->settings['Filter']['GrantParentNodeTypeFilter'])) {
                $grandParentNodeFilter = $this->settings['Filter']['GrantParentNodeTypeFilter'];
            } else {
                $grandParentNodeFilter = '[instanceof Neos.Neos:Document]';
            }
        }

        if ($parentNodeFilter === '') {
            if (isset($this->settings['Filter']['ParentNodeTypeFilter'])) {
                $parentNodeFilter = $this->settings['Filter']['ParentNodeTypeFilter'];
            } else {
                $parentNodeFilter = '[instanceof Neos.Neos:Content]';
            }
        }


        $properties = new \stdClass();
        foreach ($node->getProperties() as $key => $val) {

            if (gettype($val) === 'string' || gettype($val) === 'integer') {
                $k = mb_strtolower(preg_replace("/[^A-z0-9]/", "-", $node->getNodeType()->getName() . ":" . $key));
                $properties->$k = (($val));
            }

            if (gettype($val) === 'array' && count($val) > 0) {
                $k = mb_strtolower(preg_replace("/[^A-z0-9]/", "-", $node->getNodeType()->getName() . ":" . $key));
                $properties->$k = json_encode($val);
            }


            if (gettype($val) === 'object') {

                if ($val InstanceOf Asset || $val InstanceOf ImageVariant) {
                    if (!$this->baseUri) {
                        $this->getView();
                    }
                    $k = mb_strtolower(preg_replace("/[^A-z0-9]/", "-", $node->getNodeType()->getName() . ":" . $key));
                    $v = array(
                        'url' => $val->getResource() ? $this->resourceManager->getPublicPersistentResourceUri($val->getResource()) : '',
                        'name' => $val->getResource() ? $val->getResource()->getFilename() : '',
                        'extension' => $val->getResource() ? $val->getResource()->getFileExtension() : '',
                        'size' => $val->getResource() ? $val->getResource()->getFileSize() : 0,
                        'sizeH' => $val->getResource() ? $this->human_filesize($val->getResource()->getFileSize()) : 0,
                        'title' => $val->getTitle(),
                        'caption' => $val->getCaption(),
                        'thumbnailUri' => $val->getThumbnail() && $val->getThumbnail()->getResource() ? $this->resourceManager->getPublicPersistentResourceUri($val->getThumbnail()->getResource()) : ''
                    );
                    if ($v['url'] !== '') {
                        $v['uri'] = parse_url($v['url']);
                        $data->uriResource = parse_url($v['url']);
                        $data->urlResource = $v['url'];
                    }
                    $properties->$k = $v;
                }

                if ($val InstanceOf \DateTime) {

                    $k = mb_strtolower(preg_replace("/[^A-z0-9]/", "-", $node->getNodeType()->getName() . ":" . $key));
                    $properties->$k = [];
                    $properties->$k['TIMESTAMP'] = $val->getTimestamp();


                    $language = isset($node->getDimensions()['language']) ? current($node->getDimensions()['language']) : 'de';

                    setlocale(LC_ALL, strtolower($language) . "_" . strtoupper($language));
                    $properties->$k['RFC822'] = $val->format(DATE_RFC822);
                    $properties->$k['format'] = array(
                        'A' => utf8_encode(strftime('%A', $val->getTimestamp())),
                        'a' => utf8_encode(strftime('%a', $val->getTimestamp())),
                        'B' => utf8_encode(strftime('%B', $val->getTimestamp())),
                        'b' => utf8_encode(strftime('%b', $val->getTimestamp())),
                        'd' => utf8_encode(strftime('%d', $val->getTimestamp())),
                        'e' => utf8_encode(strftime('%e', $val->getTimestamp())),
                        'H' => utf8_encode(strftime('%H', $val->getTimestamp())),
                        'I' => utf8_encode(strftime('%I', $val->getTimestamp())),
                        'm' => utf8_encode(strftime('%m', $val->getTimestamp())),
                        'M' => utf8_encode(strftime('%M', $val->getTimestamp())),
                        'p' => utf8_encode(strftime('%p', $val->getTimestamp())),
                        'Y' => utf8_encode(strftime('%Y', $val->getTimestamp())),
                        'y' => utf8_encode(strftime('%y', $val->getTimestamp()))
                    );

                }


            }

        }

        // render additional properties given by node configuration
        if ($node->getNodeType()->getConfiguration('hybridsearch')) {

            $configuration = $node->getNodeType()->getConfiguration('hybridsearch');
            if (isset($configuration['properties'])) {

                foreach ($configuration['properties'] as $additionProperty => $additionalTyposcriptPath) {
                    $k = mb_strtolower(preg_replace("/[^A-z0-9]/", "-", $node->getNodeType()->getName() . ":" . $additionProperty));
                    $properties->$k = trim($this->getRenderedNode($node, $additionalTyposcriptPath));
                }

            }

        }


        $flowQuery = new FlowQuery(array($node));
        $parentNode = $flowQuery->parent()->closest($parentNodeFilter)->get(0);
        $grandParentNode = $flowQuery->closest($grandParentNodeFilter)->get(0);
        $documentNode = $flowQuery->closest("[instanceof Neos.Neos:Document]")->get(0);


        if ($grandParentNode === NULL) {
            $grandParentNode = $documentNode;
        }


        $uri = false;
        $breadcrumb = '';

        $urlproperty = mb_strtolower(preg_replace("/[^A-z0-9]/", "-", $node->getNodeType()->getName() . ":url"));
        if (isset($properties->$urlproperty)) {
            $uri = trim($properties->$urlproperty);
        }
        if ($node->hasProperty('url') && parse_url($node->getProperty('url')) !== false) {
            $uri = $node->getProperty('url');
        }

        if ($uri === false) {

            if ($documentNode) {
                $uri = $this->getNodeLink($documentNode);
                $breadcrumb = $this->getRenderedNode($documentNode, 'breadcrumb');
            } else {
                $uri = '';
            }
        }

        if ($breadcrumb == '' && $documentNode) {
            $breadcrumb = $this->getRenderedNode($documentNode, 'breadcrumb');
        }

        $parentProperties = new \stdClass();
        $parentPropertiesText = '';
        if ($parentNode) {


            foreach ($parentNode->getProperties() as $key => $val) {
                if (gettype($val) === 'string') {
                    $k = mb_strtolower(preg_replace("/[^A-z]/", "-", $parentNode->getNodeType()->getName() . ":" . $key));
                    $parentProperties->$k = (Encoding::UTF8FixWin1252Chars($val));
                    $parentPropertiesText .= (Encoding::UTF8FixWin1252Chars($val)) . " ";
                }
            }


            unset($key);
            unset($val);
            unset($prop);


            $properties->parent = (Encoding::UTF8FixWin1252Chars($parentPropertiesText));
            $p = $data->nodeType . "-parent";
            $properties->$p = $properties->parent;
        }


        $grandParentProperties = new \stdClass();
        $grandParentPropertiesText = '';
        if ($grandParentNode) {


            foreach ($grandParentNode->getProperties() as $key => $val) {
                if (gettype($val) === 'string') {
                    $k = mb_strtolower(preg_replace("/[^A-z]/", "-", $grandParentNode->getNodeType()->getName() . ":" . $key));
                    $grandParentProperties->$k = (Encoding::UTF8FixWin1252Chars($val));
                    $grandParentPropertiesText .= (Encoding::UTF8FixWin1252Chars($val)) . " ";
                }
            }


            $grandParentPropertiesText .= mb_strtolower(preg_replace("/[^A-z0-9]/", " ", $uri . " " . $this->rawcontent($breadcrumb)));
            $properties->grandparent = (Encoding::UTF8FixWin1252Chars($grandParentPropertiesText));
            $p = $data->nodeType . "-grandparent";
            $properties->$p = $properties->grandparent;

        }


        $rendered = $this->getRenderedNode($node);

        if ($node->getProperty('neoslivehybridsearchturbonode')) {
            $data->turbonode = true;
            $data->html = $rendered;
        } else {
            $data->turbonode = false;
        }


        $p = $data->nodeType . "-rawcontent";
        if (isset($properties->$p) === false) {
            $properties->$p = $this->rawcontent($rendered);
        }
        $properties->rawcontent = $properties->$p;

        $data->hash = sha1(json_encode($properties));
        $data->url = $uri;
        $data->uri = parse_url($uri);


        if ($this->creatingFullIndex && $data->url !== '' && isset($data->uri['path'])) {

            $gaData = false;
            if (isset($data->uriResource)) {
                if (isset($data->uriResource['host'])) {
                    $gaData = $this->googleAnalyticsFactory->getGaDataByDestinationPage($data->uriResource['host'], isset($data->uriResource['path']) ? $data->uriResource['path'] : "/");
                }
            } else {
                if (isset($data->uri['host'])) {
                    $gaData = $this->googleAnalyticsFactory->getGaDataByDestinationPage($data->uri['host'], $data->uri['path']);
                }
            }

            if ($gaData) {

                $properties->__google = $gaData['keywords'];
                $properties->__userGender = $gaData['userGender'];
                $properties->__userAgeBracket = $gaData['userAgeBracket'];
                $properties->__trendingHour = $gaData['trendingHour'];
                if ($gaData['trendingRating']) {
                    $t = "__" . $gaData['trendingRating'];
                    $properties->$t = 'trendingRating';
                }

            }
        }

        $data->breadcrumb = $breadcrumb;
        $data->identifier = $node->getNodeData()->getIdentifier();
        $data->properties = $properties;


        $data->grandParentNode = new \stdClass();

        $data->grandParentNode->identifier = $grandParentNode ? $grandParentNode->getIdentifier() : null;
        $data->grandParentNode->properties = $grandParentProperties;
        $data->grandParentNode->nodeType = $grandParentNode ? $grandParentNode->getNodeType()->getName() : '';

        if ($grandParentNode) {
            $data->grandParentNode->sortingindex = ObjectAccess::getProperty($grandParentNode->getNodeData(), 'index');
        } else {
            $data->grandParentNode->sortingindex = 0;
        }

        if ($parentNode) {
            $data->parentNode = new \stdClass();
            $data->parentNode->identifier = $parentNode->getIdentifier();
            $data->parentNode->properties = $parentProperties;
            $data->parentNode->nodeType = $parentNode->getNodeType()->getName();
        }


        $rendered = null;
        $grandParentNode = null;
        $parentNode = null;
        $documentNode = null;
        $flowQuery = null;
        $properties = null;
        $node = null;

        unset($rendered);
        unset($grandParentNode);
        unset($parentNode);
        unset($documentNode);
        unset($flowQuery);
        unset($properties);
        unset($node);


        return $data;


    }


    /**
     * Get dimension confiuguration hash (replace critical strings)
     * @param array $dimensionConfiguration
     * @return string
     */
    private
    function getDimensionConfiugurationHash($dimensionConfiguration)
    {

        return \Neos\ContentRepository\Utility::sortDimensionValueArrayAndReturnDimensionsHash($dimensionConfiguration);

    }


    /**
     * Get workspace hash (replace critical strings) for given workspace
     * @param Workspace $workspace
     * @return string
     */
    private
    function getWorkspaceHash($workspace)
    {

        return preg_replace("/^A-z0-9/", "-", $workspace->getName());

    }


    /**
     * @param string $path
     * @param mixed $data
     * @return void
     */
    public
    function firebaseUpdate($path, $data)
    {

        $this->addToQueue($path, $data, 'update');

        unset($data);

    }

    /**
     * @param string $path
     * @param mixed $data
     * @return void
     */
    public
    function firebaseSet($path, $data)
    {

        $this->addToQueue($path, $data, 'set');
        unset($data);

    }


    /**
     * @param string $path
     * @return void
     */
    public
    function firebaseDelete($path)
    {

        $this->firebase->delete($path);

    }


    /**
     * @param string $path
     * @param mixed $data
     * @param string $method
     * @param integer $chunkcounter
     * @return void
     */
    protected
    function addToQueue($path, $data = null, $method = 'update', $chunkcounter = 0)
    {


        if ($chunkcounter < 100 && count($data) > 2 && strlen(json_encode($data)) > 100000000) {
            $chunkcounter++;
            $this->addToQueue($path, array_slice($data, 0, floor(count($data) / 2)), $method, $chunkcounter);
            $this->addToQueue($path, array_slice($data, ceil(count($data) / 2)), $method, $chunkcounter);
            unset($data);
            return true;
        } else {


            $filename = $this->temporaryDirectory . "/queued_" . time() . $this->queuecounter . "_" . Algorithms::generateUUID() . ".json";


            $content = json_encode(
                array(
                    'path' => $path,
                    'data' => $data,
                    'method' => $method,
                )
            );

            if (is_string($content) === false) {
                if (json_last_error() === JSON_ERROR_UTF8) {
                    echo "warning utf-8 malformed string. skipped $path ";
                }
            } else {

                $fp = fopen($filename, 'w+');
                $this->fwrite_stream($fp, $content);
                fclose($fp);

            }


            $content = null;

            $fp = null;
            unset($content);
            unset($fp);

            $this->queuecounter++;
        }

        return true;

    }


    /**
     * @param $fp
     * @param $string
     * @return int
     */
    private function fwrite_stream($fp, $string)
    {
        for ($written = 0; $written < strlen($string); $written += $fwrite) {
            $fwrite = fwrite($fp, substr($string, $written));
            if ($fwrite === false) {
                return $written;
            }
        }
        return $written;
    }


    /**
     * @return void
     */
    public
    function deleteQueue()
    {

        $fp = opendir($this->temporaryDirectory);
        while (false !== ($entry = readdir($fp))) {

            if (strlen($entry) > 2) {
                unlink($this->temporaryDirectory . "/" . $entry);
            }

        }


    }

    /**
     * @return void
     */
    public
    function proceedQueue()
    {

        if ($this->isLockReltimeIndexer() === false) {
            $files = array();

            $fp = opendir($this->temporaryDirectory);
            while (false !== ($entry = readdir($fp))) {

                if (substr($entry, 0, 6) === 'queued' && substr($entry, -4) === 'json') {
                    list($name, $number, $uuid) = explode("_", $entry);
                    $files[$number][] = $this->temporaryDirectory . $entry;
                }

            }


            ksort($files);
            $this->output->outputLine(count($files) . ' files found for proceeding');


            foreach ($files as $filecollection) {


                foreach ($filecollection as $file) {

                    $this->output->outputLine("uploading " . $file . " (" . filesize($file) . ")");

                    $content = json_decode(file_get_contents($file));

                    if ($content) {

                        switch ($content->method) {
                            case 'update':
                                $out = $this->firebase->update($content->path, $content->data);
                                break;

                            case 'delete':
                                $out = $this->firebase->delete($content->path);
                                break;

                            case 'set':
                                $out = $this->firebase->set($content->path, $content->data);
                                break;
                        }


                        if (strlen($out) < 255) {

                            if (json_decode($out)) {
                                $this->output->outputLine($out);
                                rename($file,$file.".error.log");
                            } else {
                                unlink($file);
                            }

                        } else {
                            unlink($file);
                        }


                    } else {
                        unlink($file);
                    }




                }

            }
        }

    }

    /**
     * Updates firebase rules for performance increase
     * @param $update true if update, false if override
     * @return void
     */
    public
    function updateFireBaseRules($update = false)
    {


        $mergedrules = array();
        $this->allSiteKeys = json_decode($this->firebase->get('sites', array('shallow' => 'true')));

        if (count($this->allSiteKeys) === 0) {
            return false;
        }

        foreach ($this->allSiteKeys as $siteIdentifier => $val) {
            $mergedrules['rules']['sites'][$siteIdentifier] = array(
                '.read' => true
            );
        }

        $mergedrules['rules']['branches'] = array('.read' => true);
        $this->firebase->set('.settings/rules', $mergedrules);

    }

    /**
     * Locks the realtime indexer
     * @return void
     */
    protected
    function lockReltimeIndexer()
    {

        $lockedfilename = $this->temporaryDirectory . "/locked.txt";

        $fp = fopen($lockedfilename, 'w');
        fwrite($fp, time());
        fclose($fp);

    }

    /**
     * Un-Locks the realtime indexer
     * @return void
     */
    protected
    function unlockReltimeIndexer()
    {

        $lockedfilename = $this->temporaryDirectory . "/locked.txt";

        if (is_file($lockedfilename)) {
            unlink($lockedfilename);
        }


    }

    /**
     * If is locked realtime indexer
     * @return boolean
     */
    protected
    function isLockReltimeIndexer()
    {

        $lockedfilename = $this->temporaryDirectory . "/locked.txt";

        return is_file($lockedfilename);

    }


    /**
     * Save generated search index as tempory json file for persisting later
     * @param $directpush true when dont write temporary files
     * @return void
     */
    protected
    function save($directpush = false)
    {


        foreach ($this->index as $workspace => $workspaceData) {
            foreach ($workspaceData as $dimension => $dimensionData) {
                $patch = array();
                foreach ($dimensionData as $dimensionIndex => $dimensionIndexData) {
                    foreach ($dimensionIndexData as $dimensionIndexKey => $dimensionIndexDataAll) {
                        $patch[$dimension . "/" . $dimensionIndex . "/" . $dimensionIndexKey] = $dimensionIndexDataAll;
                    }
                }

                if ($this->creatingFullIndex) {
                    $this->firebaseUpdate("sites/" . $this->getSiteIdentifier() . "/index/" . $workspace . "/" . $this->branch, $patch);
                    if ($this->branchWasSet !== true) {
                        $this->setBranch($workspace, $this->branch);
                        $this->branchWasSet = true;
                    }

                } else {
                    if ($directpush) {
                        $this->firebase->update("sites/" . $this->getSiteIdentifier() . "/index/" . $workspace . "/" . $this->branch, $patch);
                    } else {
                        $this->firebaseUpdate("sites/" . $this->getSiteIdentifier() . "/index/" . $workspace . "/" . $this->branch, $patch);
                    }

                }
            }
        }

        foreach ($this->keywords as $workspace => $workspaceData) {

            $patch = array();
            foreach ($workspaceData as $dimensionIndex => $dimensionIndexData) {
                foreach ($dimensionIndexData as $dimensionIndexKey => $dimensionIndexDataAll) {
                    $patch[$workspace . "/" . $this->branch . "/" . $dimensionIndex . "/" . $dimensionIndexKey] = $dimensionIndexDataAll;
                }
            }

            if ($this->creatingFullIndex) {
                $this->firebaseUpdate("sites/" . $this->getSiteIdentifier() . "/keywords/", $patch);
            } else {
                if ($directpush) {
                    $this->firebase->update("sites/" . $this->getSiteIdentifier() . "/keywords/", $patch);
                } else {
                    $this->firebaseUpdate("sites/" . $this->getSiteIdentifier() . "/keywords/", $patch);
                }
            }

        }


        $this->index = null;
        $this->keywords = null;
        $path = null;

        unset($this->index);
        unset($this->keywords);
        unset($path);

        $this->index = new \stdClass();
        $this->keywords = new \stdClass();


    }


    /**
     * Get Firebase index by node
     * @param Node $node
     * @param String $workspaceHash
     * @param string $dimensionConfigurationHash
     * @param array $skipKeywords
     * @return array
     */
    public
    function getIndexByNode($node, $workspaceHash, $dimensionConfigurationHash, $skipKeywords = array())
    {


        $path = "sites/" . $this->getSiteIdentifier() . "/keywords/" . $workspaceHash . "/" . $this->branch . "/" . $dimensionConfigurationHash . "/" . $node->getIdentifier();
        $result = $this->firebase->get($path);

        if ($result != 'null') {
            $result = json_decode($result);
        } else {
            $result = new \stdClass();
        }

        if (count($skipKeywords)) {
            foreach (get_object_vars($result) as $keyword => $val) {
                if (isset($skipKeywords[$keyword])) {
                    unset($result->$keyword);
                }
            }
        }

        return $result;


    }


    /**
     * Delete index for given site
     * Do firebase delete request
     * @param string $site
     * @param string $branch
     * @return mixed
     */
    protected
    function deleteIndex($site, $branch = null)
    {

        if ($branch) {

            $workspaces = json_decode($this->firebase->get("sites/" . $site . "/index", array('shallow' => 'true')));

            if ($workspaces) {
                foreach ($workspaces as $workspace => $workspaceData) {
                    $this->firebase->delete("sites/" . $site . "/index/$workspace/" . $branch);
                    $this->firebase->delete("sites/" . $site . "/keywords/$workspace/" . $branch);
                }
            }


        } else {

            $this->firebase->delete("sites/" . $site);
            $this->firebase->delete("/trash/" . $site);
        }


    }


    /**
     * Creates a content context for given workspace
     *
     * @param string $workspaceName
     * @param array $dimensions
     * @param array $targetDimensions
     * @param Site $currentSite
     * @return \Neos\ContentRepository\Domain\Service\Context
     */
    protected
    function createContext($workspaceName, $dimensions, $targetDimensions, $currentSite)
    {


        return $this->contentContextFactory->create(array(
            'workspaceName' => $workspaceName,
            'currentSite' => $currentSite,
            'currentSiteNode' => $currentSite,
            'dimensions' => $dimensions,
            'targetDimensions' => $targetDimensions,
            'invisibleContentShown' => false,
            'inaccessibleContentShown' => false,
            'removedContentShown' => false
        ));
    }


    /**
     * @param html to raw text
     * @return string
     */
    private
    function rawcontent($text)
    {
        return preg_replace("/[ ]{2,}/", " ", preg_replace("/\r|\n/", "", strip_tags($text)));

    }

    /**
     * @param NodeInterface $node
     * @return NodeInterface
     */
    protected
    function getClosestDocumentNode(NodeInterface $node)
    {
        while ($node !== null && !$node->getNodeType()->isOfType('Neos.Neos:Document')) {
            $node = $node->getParent();
        }
        return $node;
    }

    /**
     * @param NodeInterface $node
     * @return NodeInterface
     */
    protected
    function getClosestContentCollectionNode(NodeInterface $node)
    {
        while ($node !== null && !$node->getNodeType()->isOfType('Neos.Neos:ContentCollection')) {
            $node = $node->getParent();
        }
        return $node;
    }

    /**
     * @param NodeInterface $node
     * @return NodeInterface
     */
    protected
    function getNodeLink(NodeInterface $node)
    {

        if ($node->getNodeType()->isOfType('Neos.Neos:Document') === false) {
            $node = $this->getClosestDocumentNode($node);
        }

        $this->site = $node->getContext()->getCurrentSite();
        $context = $this->createContext('live', $node->getDimensions(), array(), $this->site);

        /** @var Node $node */
        $node = new Node(
            $node->getNodeData(),
            $context
        );


        $this->getView();


        return $this->linkingService->createNodeUri(
            $this->controllerContext,
            $node,
            $node,
            null,
            true
        );


        return '';

    }


    /**
     * get rendered turbo node
     *
     * @param Node $node
     * @param string page|breadcrumb
     * @return string
     */
    private
    function getRenderedNode($node, $typoscriptPath = 'page')
    {


        $isbreadcrumb = $typoscriptPath == 'breadcrumb' ? true : false;
        $ispage = $typoscriptPath == 'page' ? true : false;


        $i = $node->getNodeType()->getConfiguration('hybridsearch.render') ? 1 : 0;


        if ($typoscriptPath == 'page' && $node->getNodeType()->getConfiguration('hybridsearch.render') == false) {
            return '';
        }


        if ($node->getContext()->getCurrentSite()) {
            $this->site = $node->getContext()->getCurrentSite();


            if (isset($this->settings['TypoScriptPaths'][$typoscriptPath][$this->site->getSiteResourcesPackageKey()])) {
                $typoscriptPath = $this->settings['TypoScriptPaths'][$typoscriptPath][$this->site->getSiteResourcesPackageKey()];
            } else {
                if ($typoscriptPath === 'breadcrumb') {
                    $typoscriptPath = 'neosliveHybridsearchBreadcrumb';
                }
                if ($typoscriptPath === 'page') {
                    $typoscriptPath = 'neosliveHybridsearchRawContent';
                }

            }

            if ($typoscriptPath == false) {
                return '';
            }

            if ($ispage && $node->getNodeType()->getConfiguration('hybridsearch.render') == false) {
                return '';
            }


            if ($ispage === false && isset($this->renderedcache[$node->getIdentifier() . "-" . $typoscriptPath])) {
                return $this->renderedcache[$node->getIdentifier() . "-" . $typoscriptPath];
            }


            if ($this->getView() && $node->getContext()->getCurrentSiteNode()) {
                $this->getView()->assign('value', $node);
                $this->getView()->setFusionPath($typoscriptPath);
                $content = $this->view->render();

                if ($ispage === false) {
                    $this->renderedcache[$node->getIdentifier() . "-" . $typoscriptPath] = $content;
                }


                return $content;
            } else {
                return '';
            }

        }

        return '';

    }

    /**
     * @return FusionView
     * @throws Exception
     */
    private
    function getView()
    {


        if ($this->view == NULL) {

            if ($this->site) {

                if ($this->site->getFirstActiveDomain() === NULL) {
                    throw new Exception(sprintf('The site "%s" has no active domains. please add one before indexing', $this->site->getName()));
                    exit;
                } else {


                    $httpRequest = \Neos\Flow\Http\Request::create(new \Neos\Flow\Http\Uri($this->site->getFirstActiveDomain()->getScheme() . $this->site->getFirstActiveDomain()->getHostname()));
                    $this->baseUri = ($this->site->getFirstActiveDomain()->getScheme() == '' ? 'http://' : $this->site->getFirstActiveDomain()->getScheme()) . $this->site->getFirstActiveDomain()->getHostname() . ($this->site->getFirstActiveDomain()->getPort() == '' ? '' : ':' . $this->site->getFirstActiveDomain()->getPort());
                    $request = new \Neos\Flow\Mvc\ActionRequest($httpRequest);


                    $requestHandler = $this->bootstrap->getActiveRequestHandler();


                    if ($requestHandler instanceof \Neos\Flow\Http\RequestHandler === false) {

                        // simulate security context
                        $context = new \Neos\Flow\Security\Context;
                        \Neos\Utility\ObjectAccess::setProperty($context, 'request', $request);
                        $requestHandlerInterface = new HttpRequestHandler($httpRequest);
                        \Neos\Utility\ObjectAccess::setProperty($this->bootstrap, 'activeRequestHandler', $requestHandlerInterface);

                    }


                    $request->setControllerActionName('show');
                    $request->setControllerName('Frontend\Node');
                    $request->setControllerPackageKey('Neos.Neos');
                    $request->setFormat('html');
                    $response = new \Neos\Flow\Http\Response();
                    $arguments = new Arguments();
                    $controllerContext = new \Neos\Flow\Mvc\Controller\ControllerContext($request, $response, $arguments);
                    $this->controllerContext = $controllerContext;
                    $this->view = new HybridSearchFusionView();
                    $this->view->setOption('enableContentCache', true);
                    $this->view->setControllerContext($controllerContext);
                }
            }
        }

        return $this->view;

    }

    /**
     * Return all allowed dimension combinations
     * @return array
     */
    private
    function getAllDimensionCombinations()
    {

        if (count($this->allDimensionCombinations)) {
            return $this->allDimensionCombinations;
        } else {
            $this->allDimensionCombinations = $this->contentDimensionCombinator->getAllAllowedCombinations();
        }

        return $this->allDimensionCombinations;

    }

    /**
     * filesize human redable
     * @param $bytes
     * @param int $decimals
     * @return string
     */
    private
    function human_filesize($bytes, $decimals = 2)
    {
        $sz = 'BKMGTP';
        $factor = floor((strlen($bytes) - 1) / 3);
        return sprintf("%.{$decimals}f", $bytes / pow(1024, $factor)) . @$sz[$factor];
    }


    /**
     * get db identifier for current site
     * @return string
     */
    private
    function getSiteIdentifier()
    {

        if ($this->site instanceof Site) {
            return $this->site->getNodeName();
        } else {
            return 'nosite';
        }


    }

}
