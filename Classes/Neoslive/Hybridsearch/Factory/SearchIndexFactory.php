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
use Firebase\FirebaseLib;
use AlgoliaSearch\AlgoliaSearch;
use Neos\Flow\Utility\Algorithms;
use Neos\Flow\Core\Booting\Scripts;
use Neos\Neos\Service\LinkingService;
use Neos\Flow\Cli\ConsoleOutput;
use Neos\Flow\Mvc\ActionRequest;
use Neos\Fusion\View\FusionView;
use Neos\Flow\Core\Bootstrap;
use Neoslive\Hybridsearch\Request\HttpRequestHandler;
use \ForceUTF8\Encoding;
use org\bovigo\vfs\vfsStreamWrapperAlreadyRegisteredTestCase;
use Ramsey\Uuid\Uuid;


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
     * @var \stdClass
     */
    protected $nodetypes;


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
    protected $staticCacheDirectory;

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
                if (!is_dir($temporaryDirectory)) {
                    mkdir($temporaryDirectory, 0755, true);
                }
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
        $this->staticCacheDirectory = $this->temporaryDirectory. "../../../../Web/_Hybridsearch";
        $this->queuecounter = 100000000;
        $this->allSiteKeys = array();
        $this->index = new \stdClass();
        $this->keywords = new \stdClass();
        $this->nodetypes = new \stdClass();
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

        if ($this->firebase == null) {
            throw new \Neos\Flow\Exception("firebase connection failed. please check configuration Neoslive/Hybridsearch/Firebase/token");
        }

        $branch = $this->firebase->get("/branches/" . $workspacename);

        if ($branch === null || $branch == 'null') {
            $this->setBranch($workspacename, 'master');
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
     * Update/Create static cache
     * @return void
     */
    public function updateStaticCache()
    {

        if (isset($this->output) == false) {
            $this->output = new ConsoleOutput();
        }

        $this->output->outputLine('creating static cache');

        $targetPath = $this->staticCacheDirectory;

        if (!is_writable($targetPath)) {
            try {
                if (!is_dir($targetPath)) {
                    mkdir($targetPath, 0755, true);
                }
            } catch (\Neos\Flow\Utility\Exception $exception) {
                throw new Exception('The directory "' . $targetPath . '" could not be created.', 1264426237);
            }
        }
        if (!is_dir($targetPath) && !is_link($targetPath)) {
            throw new Exception('The  directory "' . $targetPath . '" does not exist.', 1203965199);
        }
        if (!is_writable($targetPath)) {
            throw new Exception('The directory "' . $targetPath . '" is not writable.', 1203965200);
        }


        $branch = $this->getBranch();

        $allSiteKeys = json_decode($this->firebase->get('sites', array('shallow' => 'true')));

        try {

            foreach ($allSiteKeys as $sitekey => $c) {

                foreach (json_decode($this->firebase->get("sites/$sitekey/nodetypes", array('shallow' => 'true'))) as $workspacename => $k) {

                    foreach (json_decode($this->firebase->get("sites/$sitekey/nodetypes/$workspacename/$branch", array('shallow' => 'true'))) as $dimension => $d) {

                        $nodetypes = json_decode($this->firebase->get("sites/$sitekey/nodetypes/$workspacename/$branch/$dimension", array('shallow' => 'true')));

                        $this->output->progressStart(count(get_object_vars($nodetypes)));

                        $this->firebase->set("lastsync/$workspacename/$branch", time());

                        foreach ($nodetypes as $nodetype => $nodesCount) {

                            // write cache
                            $targetSubPath = $targetPath . "/sites/$sitekey/index/$workspacename/$branch/$dimension";

                            try {
                                if (!is_dir($targetSubPath)) {
                                    mkdir($targetSubPath, 0755, true);
                                }
                            } catch (\Neos\Flow\Utility\Exception $exception) {
                                throw new Exception('The  directory "' . $targetSubPath . '" could not be created.', 1264426237);
                            }

                            if (is_dir($targetSubPath)) {
                                $nodetype = str_replace("__","",$nodetype);
                                $fp = fopen($targetSubPath . "/__" . $nodetype . ".json", 'w+');
                                $this->fwrite_stream($fp, $this->firebase->get("sites/$sitekey/index/$workspacename/$branch/$dimension/__$nodetype"));
                                fclose($fp);
                            }

                            $this->output->progressAdvance(1);

                        }

                        $this->output->progressFinish();

                    }


                }


            }


            $this->output->outputLine('static file cache created');

        } catch (\Neos\Flow\Exception $exception) {
            \Neos\Flow\var_dump($exception);
            $this->output->outputLine('unable to create static cache.');
        }


    }


    /**
     * Create algolia search index for given workspace
     * @param string $workspacename
     * @return void
     */
    public function createIndexAlgolia($workspacename = 'live')
    {


        $this->output = new ConsoleOutput();


        if (isset($this->settings['Algolia']) && isset($this->settings['Algolia']['ApiKey']) && isset($this->settings['Algolia']['ApplicationID'])) {

            $client = new \AlgoliaSearch\Client($this->settings['Algolia']['ApplicationID'], $this->settings['Algolia']['ApiKey']);

            if ($client) {

                $branch = $this->getBranch();

                $allSiteKeys = json_decode($this->firebase->get('sites', array('shallow' => 'true')));

                try {

                    foreach ($allSiteKeys as $sitekey => $c) {

                        foreach (json_decode($this->firebase->get("sites/$sitekey/nodetypes", array('shallow' => 'true'))) as $workspacename => $k) {

                            foreach (json_decode($this->firebase->get("sites/$sitekey/nodetypes/$workspacename/$branch", array('shallow' => 'true'))) as $dimension => $d) {

                                $nodetypes = json_decode($this->firebase->get("sites/$sitekey/nodetypes/$workspacename/$branch/$dimension", array('shallow' => 'true')));

                                $this->output->progressStart(count(get_object_vars($nodetypes)));


                                $index = $client->initIndex($sitekey . "-" . $workspacename . "-" . $dimension);
                                $index->clearIndex();

                                foreach ($nodetypes as $nodetype => $nodesCount) {

                                    $nodes = json_decode($this->firebase->get("sites/$sitekey/index/$workspacename/$branch/$dimension/__$nodetype"), true);

                                    if ($nodes) {
                                        foreach ($nodes as $identifier => $node) {
                                            $index->addObject($node);
                                        }
                                    }

                                    $this->output->progressAdvance(1);

                                }

                                $this->output->progressFinish();

                            }


                        }


                    }


                    $this->output->outputLine('algolia index created');

                } catch (\Neos\Flow\Exception $exception) {
                    \Neos\Flow\var_dump($exception);
                }

            }

        } else {
            $this->output->outputLine('Please set Algolia.ApiKey and Algolia.ApplicationID first.');
        }


    }


    /**
     * Create full search index for given workspace
     * @param string $workspacename
     * @param string $nodetype
     * @param boolean $verbose
     * @return void
     */
    public function createFullIndex($workspacename = 'live', $nodetype = null, $verbose = false)
    {

        $this->output = new ConsoleOutput();


        $sites = array();
        $this->getBranch($workspacename);
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

        $this->output->outputLine('indexing nodes');

        foreach ($moditifedNodeData as $nodedata) {

            $this->output->progressAdvance(1);
            try {
                if ($verbose) {
                    \Neos\Flow\var_dump($nodedata->getIdentifier());
                }
                $this->updateIndexForNodeData($nodedata, $nodedata->getWorkspace(), true);
            } catch (Exception $exception) {
                $this->output->outputLine("error while indexing node " . $nodedata->getIdentifier() . " on workspace " . $workspacename . ". " . $exception->getMessage());
            }


            $nt = $this->getNodeTypeName($nodedata);
            if (isset($this->nodetypes->$nt)) {
                $this->nodetypes->$nt++;
            } else {
                $this->nodetypes->$nt = 1;
            }


        }
        $this->output->progressFinish();

        $this->output->outputLine('preparing upload');

        $this->save();
        $this->unlockReltimeIndexer();

        $this->output->outputLine('uploading indexed nodes');

        $this->proceedQueue();


        // remove old sites data
        foreach ($sites as $s) {
            $this->switchBranch($workspacename);
            $this->deleteIndex($s, $this->branch);
        }

        // remove trash
        $this->firebase->delete("/trash", array('print' => 'silent'));

        $this->updateFireBaseRules();

        $this->unlockReltimeIndexer();


        $this->updateStaticCache();

        if (isset($this->settings['Algolia']) && isset($this->settings['Algolia']['ApiKey']) && isset($this->settings['Algolia']['ApplicationID'])) {
            $this->createIndexAlgolia($workspacename);
        }


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
    public  function removeTrashedNodes()
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
                //Scripts::executeCommand('hybridsearch:sync', $this->flowSettings, true,array('workspaceName' => $workspaceName, 'nodesSerialized' => serialize($nodes)));
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

        $this->output = new ConsoleOutput();

        if ($this->isLockReltimeIndexer()) {
            return false;
        }

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
            if ($lastsync == null || $lastsync == 'null') {
                $lastsync = time();
            }
        } else {
            $lastsync = $timestamp;
        }


        $date = new \DateTime();

        if ($lastsync) {
            $date->setTimestamp(intval($lastsync));
            if ($timestamp) {
                $date->setTime($date->format("H"), $date->format("i"), 0);
            }
            if ($date->format("Y") < 2000) {
                $this->output->outputLine("error can't sync from " . $date->format("d.m.Y H:i:s"));
                return false;
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


        if (count($moditifedNodeData)) {
            $this->removeTrashedNodes();
            $this->output->progressStart(count($moditifedNodeData));
        }

        foreach ($moditifedNodeData as $nodedata) {

            if (isset($this->settings['RealtimeNodeTypes']) && isset($this->settings['RealtimeNodeTypes'][$nodedata->getNodeType()->getName()]) && $this->settings['RealtimeNodeTypes'][$nodedata->getNodeType()->getName()]) {
                // skipping. nodetype is realtime indexing
            } else {
                $this->updateIndexForNodeData($nodedata, $nodedata->getWorkspace());
            }

            $this->output->progressAdvance(1);
        }
        if (count($moditifedNodeData)) {
            $this->output->progressFinish();
        }

        if (count($moditifedNodeData)) {
            $this->save();
            $this->proceedQueue();
        }

        $this->output->outputLine('done.');

        return true;

    }

    /**
     * Update index
     * @param string $workspaceName
     * @param string nodeTypeName
     */
    public  function syncByNodeType($workspaceName = 'live', $nodeTypeName = null)
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
    public  function syncByNodeIdentifier($workspaceName = 'live', $nodeIdentifier)
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

        $config = $nodedata->getNodeType()->getConfiguration('hybridsearch');

        if (isset($config['skip']) && $config['skip'] == true) {
            return $counter;
        }


        if (count($this->allSiteKeys) === 0) {
            $this->allSiteKeys = json_decode($this->firebase->get('sites', array('shallow' => 'true')));
        }


        foreach ($this->getAllDimensionCombinations() as $dimensionConfiguration) {

            $targetDimension = array_map(function ($dimensionValues) {
                return array_shift($dimensionValues);
            }, $dimensionConfiguration);


            $dimensionHash = $this->getDimensionConfiugurationHash($dimensionConfiguration);
            if ((isset($this->settings['Dimensions']) && array_key_exists($dimensionHash, $this->settings['Dimensions']) && $this->settings['Dimensions'][$dimensionHash] == false) || (isset($this->settings['Dimensions']) && array_key_exists($dimensionHash, $this->settings['Dimensions']) == false)) {
                // skip dimension
            } else {


                $context = $this->contentContextFactory->create(['targetDimension' => $targetDimension, 'dimensions' => $dimensionConfiguration, 'workspaceName' => $nodedata->getWorkspace()->getName()]);


                $node = $context->getNodeByIdentifier($nodedata->getIdentifier());

                if ($node) {

                    if (isset($this->settings['Filter']['NodeTypeFilter'])) {

                        $flowQuery = new FlowQuery(array($node));

                        if ($node->isHidden() || $node->isRemoved() || $flowQuery->context(array('invisibleContentShown' => true))->parents('[instanceof Neos.Neos:Node][_hidden=TRUE]')->count() !== 0 || $flowQuery->context(array('invisibleContentShown' => true))->parents('[instanceof Neos.Neos:Node][_visible=FALSE]')->count() !== 0) {
                            $this->removeSingleIndex($node->getIdentifier(), $this->getWorkspaceHash($workspace), $this->branch, $this->getDimensionConfiugurationHash($dimensionConfiguration), array(), null, $this->getNodeTypeName($node));
                        } else {
                            $this->generateSingleIndex($node, $workspace, $this->getDimensionConfiugurationHash($node->getContext()->getDimensions()));
                            $counter++;
                        }


                    }


                } else {
                    // delete node index
                    foreach ($this->allSiteKeys as $siteKey => $siteVal) {
                        $this->removeSingleIndex($nodedata->getIdentifier(), $this->getWorkspaceHash($workspace), $this->branch, $this->getDimensionConfiugurationHash($dimensionConfiguration), array(), $siteKey, $this->getNodeTypeName($nodedata));
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

                $this->firebase->set("/trash/" . $p[2] . "/" . $this->getWorkspaceHash($nodedata->getWorkspace()) . "/" . $this->branch . "/" . $this->getDimensionConfiugurationHash($node->getDimensions()) . "/" . $nodedata->getIdentifier(), time(), array('print' => 'silent'));

                // remove parent nodes from index and set last modification time for reindexing
                $counter = 0;
                $parentNode = $node;
                $lastpublicationsdate = new \DateTime();

                while ($parentNode && $counter < 5) {

                    /* @var Node $parentNode */
                    $parentNode->getNodeData()->setLastPublicationDateTime($lastpublicationsdate);
                    $this->nodeDataRepository->update($parentNode->getNodeData());
                    $this->firebase->set("/trash/" . $p[2] . "/" . $this->getWorkspaceHash($nodedata->getWorkspace()) . "/" . $this->branch . "/" . $this->getDimensionConfiugurationHash($node->getDimensions()) . "/" . $parentNode->getIdentifier(), time(), array('print' => 'silent'));
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
                $this->firebase->set("/trash/" . $this->getSiteIdentifier() . "/" . $this->getWorkspaceHash($targetWorkspace) . "/" . $this->branch . "/" . $this->getDimensionConfiugurationHash($node->getDimensions()) . "/" . $node->getIdentifier(), time(), array('print' => 'silent'));
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
    public  function generateIndex($node, $workspace, $dimensionConfiguration, $nodeTypeFilter = '')
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
     * @param string $siteIdentifier
     * @param mixed $removeNodeByNodeTypeName
     * @return void
     */
    public  function removeSingleIndex($nodeIdentifier, $workspaceHash, $branch, $dimensionConfigurationHash, $keywordsOfNode = array(), $siteIdentifier = null, $removeNodeByNodeTypeName = null)
    {

        if ($this->creatingFullIndex) {
            return null;
        }


        if ($siteIdentifier === null || $siteIdentifier == 0) {
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

            $this->firebase->update("sites/$siteIdentifier/index/$workspaceHash/$branch/$dimensionConfigurationHash", $keywordsremove, array('print' => 'silent'));

            if (count($keywordsOfNode) === 0) {
                $this->firebase->delete("sites/" . $siteIdentifier . "/index/$workspaceHash/$branch/$dimensionConfigurationHash" . "/___keywords/" . urlencode($nodeIdentifier), array('print' => 'silent'));
            }
        }

        $this->firebase->delete("trash/$siteIdentifier/$workspaceHash/$branch/$dimensionConfigurationHash/$nodeIdentifier", array('print' => 'silent'));

        if ($removeNodeByNodeTypeName) {
            $this->firebase->set("sites/$siteIdentifier/index/$workspaceHash/$branch/$dimensionConfigurationHash/__$removeNodeByNodeTypeName/$nodeIdentifier", 'removed', array('print' => 'silent'));
        }


    }

    /**
     * Generates single index for given node
     *
     * @param Node $node
     * @param Workspace $workspace
     * @param string $dimensionConfigurationHash
     * @return void
     */
    public  function generateSingleIndex($node, $workspace, $dimensionConfigurationHash)
    {

        $this->indexcounter++;

        $config = $node->getNodeType()->getConfiguration('hybridsearch');

        if (isset($config['skip']) && $config['skip'] == true) {
            return null;
        }


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

            if (count(get_object_vars($indexData->properties)) == 1) {
                foreach ($indexData->properties as $p) {
                    if (!$p) {
                        // skip emtpy nodes
                        return null;
                    }
                }
            }


            $identifier = $indexData->identifier;

            $keywords = $this->generateSearchIndexFromProperties($indexData->properties, $indexData->nodeType);

            unset($indexData->properties->rawcontent);

            $nt = "__" . $this->getNodeTypeName($node);
            $keywords->$nt = true;
            $keywords->$identifier = true;


            $keywordsOfNode = array();

            foreach ($keywords as $keyword => $val) {

                $k = strval($keyword);


                if (substr($k, 0, 2) !== "__") {
                      array_push($keywordsOfNode, $k);
                }

                if (substr($k, 0, 9) === "_nodetype") {
                    $k = "_" . $this->getNodeTypeName($node) . mb_substr($k, 9);
                }

                if ($k) {
                    if (isset($this->keywords->$workspaceHash->$dimensionConfigurationHash[$k]) == false) {
                        $this->keywords->$workspaceHash->$dimensionConfigurationHash[$k] = array();
                    }
                    if (is_array($val) == false) {
                        $val = array($k);
                    }
                    foreach ($val as $kek => $vev) {
                        $this->keywords->$workspaceHash->$dimensionConfigurationHash[$k][$kek] = $vev;
                    }

                }



                if (isset($this->index->$workspaceHash->$dimensionConfigurationHash->$k) === false) {
                    $this->index->$workspaceHash->$dimensionConfigurationHash->$k = new \stdClass();
                }

                if (substr($k, 0, 2) == '__') {
                    $this->index->$workspaceHash->$dimensionConfigurationHash->$k->$identifier = array('node' => $indexData, 'nodeType' => $indexData->nodeType);
                } else {
                    $this->index->$workspaceHash->$dimensionConfigurationHash->$k->$identifier = array('node' => null, 'nodeType' => $indexData->nodeType);
                }


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

            if (time() - $this->time > 300 || count($this->index->$workspaceHash->$dimensionConfigurationHash->$k) > 500) {
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

            if (gettype($value) == 'string' || is_numeric($value)) {

                $j = json_decode($value);
                if ($j) {
                    $text .= " " . (json_encode($j, JSON_UNESCAPED_UNICODE));
                } else {
                    $text .= " " . $value;
                }


            } else {

                $text .= " " . (json_encode($value, JSON_UNESCAPED_UNICODE));

            }

        }

        $text = (Encoding::UTF8FixWin1252Chars(html_entity_decode($text)));
        $text = preg_replace('~[^\p{L}\p{N}-\.0-9]++~u', " ", mb_strtolower($text));
        $words = explode(" ", ($text));

        // reduce
        $wordsReduced = array();

        foreach ($words as $w) {


            if (strlen($w) > 1) {
                $wm = $this->getMetaphone($w);
                if (mb_strlen($wm) > 0 && mb_strlen($wm) < 64) {
                    $w = str_replace(".","",$w);
                    $wordsReduced[$wm][$w] = 1;
                    $wm = $this->getMetaphone(mb_substr($w, 0, 3));
                    if (mb_strlen($wm) > 0) {
                        $wordsReduced["000" . $wm][$w] = 1;
                    }
                }


            }
        }

        foreach ($wordsReduced as $w => $k) {

            if (strlen($w) > 1) {
                $w = Encoding::UTF8FixWin1252Chars($w);
                if ($w) {
                    $keywords->$w = $k;
                }
            }
        }



        $properties = null;
        unset($properties);

        return $keywords;

    }


    /**
     * gets meta phone hash of given string
     * @param string $string
     * @return string
     */
    public function getMetaphone($string)
    {

        if (substr_count($string,".") && substr($string,-1,1) !== '.' && is_numeric(substr($string,0,1))) {
            return mb_strtoupper(str_replace(".","",$string));
        }

        return str_replace(".","",mb_strtoupper(metaphone(mb_strtolower($string), 6)));


    }


    /**
     * gets node type name
     * @param Node $node
     * @return string
     */
    public function getNodeTypeName($node)
    {
        return mb_strtolower(preg_replace("/[^A-z0-9]/", "-", $node->getNodeType()->getName()));
    }


    /**
     * @param Node $node
     * @param string $grandParentNodeFilter
     * @param string $parentNodeFilter
     * @return \stdClass
     */
    public  function convertNodeToSearchIndexResult($node, $grandParentNodeFilter = '', $parentNodeFilter = '', $depth = 0)
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

            if (gettype($val) === 'boolean') {
                $k = mb_strtolower(preg_replace("/[^A-z0-9]/", "-", $node->getNodeType()->getName() . ":" . $key));
                $properties->$k = (($val));
            }

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
                        'url' => ($val->getResource() ? $this->resourceManager->getPublicPersistentResourceUri($val->getResource()) : ''),
                        'name' => ($val->getResource() ? $val->getResource()->getFilename() : ''),
                        'extension' => $val->getResource() ? $val->getResource()->getFileExtension() : '',
                        'size' => $val->getResource() ? $val->getResource()->getFileSize() : 0,
                        'sizeH' => $val->getResource() ? $this->human_filesize($val->getResource()->getFileSize()) : 0,
                        'title' => ($val->getTitle()),
                        'caption' => ($val->getCaption())
                        //'thumbnailUri' => ($val->getThumbnail() && $val->getThumbnail()->getResource() ? $this->resourceManager->getPublicPersistentResourceUri($val->getThumbnail()->getResource()) : '')
                    );
                    if ($v['url'] !== '') {
                        $v['uri'] = $this->mb_parse_url($v['url']);
                        $data->uriResource = $this->mb_parse_url($v['url']);
                        $data->urlResource = $v['url'];

                    }
                    $properties->$k = $v;
                }

                if ($val InstanceOf \DateTime && $val !== null) {

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

                if ($val InstanceOf NodeInterface && $depth === 0) {
                    $k = mb_strtolower(preg_replace("/[^A-z0-9]/", "-", $node->getNodeType()->getName() . ":" . $key));
                    $properties->$k = $this->convertNodeToSearchIndexResult($val, '', '', 1);
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

        if (isset($properties->label) == false && $node->getParent()) {
            $prev = $flowQuery->prev()->get(0);
            if ($prev) {
                if (strlen($prev->getLabel()) < 64) {
                    if ($prev->getNodeType()->getName() !== $node->getNodeType()->getName()) {
                        $properties->label = $prev->getLabel();
                    }
                }
            }

        }

        if (isset($properties->label) == false) {
            if ($parentNode) {
                $properties->label = $parentNode->getLabel();
            }
        }

        $properties->_nodeLabel = $node->getLabel();

        if ($grandParentNode === NULL) {
            $grandParentNode = $documentNode;
        }


        $uri = false;
        $breadcrumb = '';

        $urlproperty = mb_strtolower(preg_replace("/[^A-z0-9]/", "-", $node->getNodeType()->getName() . ":url"));
        if (isset($properties->$urlproperty)) {
            $uri = trim($properties->$urlproperty);
        }
        if ($node->hasProperty('url') && $this->mb_parse_url($node->getProperty('url')) !== false) {
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
            $p = $data->nodeType . "-grandparent";
            $properties->$p = (Encoding::UTF8FixWin1252Chars($grandParentPropertiesText));
        }

        $rendered = $this->getRenderedNode($node);

        if ($node->getProperty('neoslivehybridsearchturbonode')) {
            $data->turbonode = true;
            $data->html = $rendered;
        } else {
            $data->turbonode = false;
        }

        $data->lastmodified = $node->getLastModificationDateTime()->getTimestamp();

        $data->hash = sha1(json_encode($properties));

        $data->rawcontent = $this->rawcontent($rendered);


        $data->url = $uri;
        $data->uri = $this->mb_parse_url($uri);

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
            }
        }

        $data->breadcrumb = $breadcrumb;
        $data->identifier = $node->getNodeData()->getIdentifier();


        // force array


        foreach ($properties as $key => $val) {

            if (gettype($val) === 'string' && (substr($val, 0, 1) == '{' || substr($val, 0, 1) == '[')) {

                $valdecoded = \json_decode($val);
                if ($valdecoded === null) {
                    $valdecoded = $val;
                } else {


                    $keys = array();
                    if (gettype($valdecoded) == 'object') {
                        $keys = $this->array_keys_multi(get_object_vars($valdecoded));
                    }

                    if (gettype($valdecoded) == 'array') {
                        $keys = $this->array_keys_multi($valdecoded);
                    }

                    $valid = true;
                    foreach ($keys as $k => $key2) {
                        if ($valid === true && mb_detect_encoding($key2, 'UTF-8', true) == false) {
                            $valid = false;
                        }
                        if ($valid === true && preg_match("/\W/", $key2) > 0) {
                            $valid = false;
                        }


                    }

                    if ($valid == true) {
                        $properties->$key = $valdecoded;
                    }


                }


            }
        }


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
    public
    function getDimensionConfiugurationHash($dimensionConfiguration)
    {

        return \Neos\ContentRepository\Utility::sortDimensionValueArrayAndReturnDimensionsHash($dimensionConfiguration);

    }


    /**
     * Get workspace hash (replace critical strings) for given workspace
     * @param Workspace $workspace
     * @return string
     */
    public
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

        $this->firebase->delete($path, array('print' => 'silent'));

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



        if ($chunkcounter < 100 && count($data) > 2 && strlen(json_encode($data)) > 10000000) {
            $chunkcounter++;
            $this->addToQueue($path, array_slice($data, 0, abs(count($data) / 2)), $method, $chunkcounter);
            $this->addToQueue($path, array_slice($data, abs(count($data) / 2)), $method, $chunkcounter);
            unset($data);
            return true;
        } else {


            $filename = $this->temporaryDirectory . "/queued_" . time() . $this->queuecounter . "_" . Uuid::uuid1() . ".json";


            $content = json_encode(
                array(
                    'path' => $path,
                    'data' => $data,
                    'method' => $method,
                )
            );

            if (is_string($content) === false) {
                if (json_last_error() === JSON_ERROR_UTF8) {
                    $filename = $this->temporaryDirectory . "/error_" . time() . $this->queuecounter . "_" . Uuid::uuid1() . ".json";
                    echo "\nwarning utf-8 malformed string. skipped $path. see log file $filename";
                    $fp = fopen($filename, 'w+');
                    $this->fwrite_stream($fp, serialize($data));
                    fclose($fp);

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
    public  function fwrite_stream($fp, $string)
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
     * UTF-8 aware parse_url() replacement.
     * @param string $url
     * @return array
     */
    function mb_parse_url($url)
    {
        $enc_url = preg_replace_callback(
            '%[^:/@?&=#]+%usD',
            function ($matches) {
                return urlencode($matches[0]);
            },
            $url
        );

        $parts = parse_url($enc_url);

        foreach ($parts as $name => $value) {
            $parts[$name] = utf8_encode(urldecode($value));
        }

        return $parts;
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

        if (isset($this->output) == false) {
            $this->output = new ConsoleOutput();
        }

        if ($this->isLockReltimeIndexer() === false) {
            $this->lockReltimeIndexer();
            $files = array();

            $fp = opendir($this->temporaryDirectory);


            $filesize = 0;

            while (false !== ($entry = readdir($fp))) {

                if (substr($entry, 0, 6) === 'queued' && substr($entry, -4) === 'json') {
                    list($name, $number, $uuid) = explode("_", $entry);
                    $files[$number][] = $this->temporaryDirectory . $entry;
                    $filesize = $filesize + filesize($this->temporaryDirectory . $entry);
                }

            }


            ksort($files);

            if (count($files)) {
                $this->output->progressStart($filesize);
            }

            $count = 0;
            foreach ($files as $filecollection) {


                foreach ($filecollection as $file) {

                    $count++;


                    $content = json_decode(file_get_contents($file));

                    if ($content) {

                        $this->output->progressAdvance(floor(filesize($file) / 2));
                        $out = "";


                        switch ($content->method) {
                            case 'update':
                                if (count($content->data)) {
                                    $out = $this->firebase->update($content->path, $content->data, array('print' => 'silent'));
                                }
                                break;

                            case 'delete':
                                $out = $this->firebase->delete($content->path, array('print' => 'silent'));
                                break;

                            case 'set':
                                if (count($content->data)) {
                                    $out = $this->firebase->set($content->path, $content->data, array('print' => 'silent'));
                                }
                                break;
                        }


                        $this->output->progressAdvance(floor(filesize($file) / 2));

                        if (strlen($out)) {
                            \Neos\Flow\var_dump($out, 'see log file ' . $file . ".error.log");
                            rename($file, $file . ".error.log");
                        } else {
                            unlink($file);
                        }


                    }


                }

            }
            if (count($files)) {
                $this->output->progressFinish();
            }

            $this->output->outputLine("done.");

            $this->unlockReltimeIndexer();
        } else {
            $this->output->outputLine("queue is locked .. skipping .. remove " . $this->temporaryDirectory . "/locked.txt" . " to unlock queue.");
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
            $mergedrules['rules']['logstore'][$siteIdentifier]['$workspace']['$dimension']['$uid'] = array(
                '.write' => true,
                '.read' => true,
            );

        }


        $mergedrules['rules']['branches'] = array('.read' => true);
        $mergedrules['rules']['lastsync'] = array('.read' => true);
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

                if ($this->creatingFullIndex) {
                    $this->firebaseSet("sites/" . $this->getSiteIdentifier() . "/nodetypes/" . $workspace . "/" . $this->branch . "/" . $dimension, $this->nodetypes);
                }

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
                        $this->firebase->update("sites/" . $this->getSiteIdentifier() . "/index/" . $workspace . "/" . $this->branch, $patch, array('print' => 'silent'));
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
                    if (is_array($dimensionIndexDataAll)) {
                        foreach ($dimensionIndexDataAll as $dimensionIndexDataAllKey => $dimensionIndexDataAllVal) {
                            $patch[$workspace . "/" . $this->branch . "/" . $dimensionIndex . "/" . $dimensionIndexKey . "/" . $dimensionIndexDataAllKey] = $dimensionIndexDataAllVal;
                        }
                    } else {
                        $patch[$workspace . "/" . $this->branch . "/" . $dimensionIndex . "/" . $dimensionIndexKey] = $dimensionIndexDataAll;
                    }
                }
            }

            if ($this->creatingFullIndex) {
                $this->firebaseUpdate("sites/" . $this->getSiteIdentifier() . "/keywords/", $patch);
            } else {
                if ($directpush) {
                    $this->firebase->update("sites/" . $this->getSiteIdentifier() . "/keywords/", $patch, array('print' => 'silent'));
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

            $workspaces = json_decode($this->firebase->get("sites/" . $site . "/index"));

            if ($workspaces) {
                foreach ($workspaces as $workspace => $workspaceData) {
                    $this->firebase->delete("sites/" . $site . "/index/$workspace/" . $branch, array('print' => 'silent'));
                    $this->firebase->delete("sites/" . $site . "/keywords/$workspace/" . $branch, array('print' => 'silent'));
                }
            }


        } else {

            $this->firebase->delete("sites/" . $site, array('print' => 'silent'));
            $this->firebase->delete("/trash/" . $site, array('print' => 'silent'));
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
    public
    function rawcontent($text)
    {
        return preg_replace("[^A-z]", "  ", preg_replace("/[ ]{2,}/", " ", preg_replace("/\r|\n/", " ", strip_tags($text))));

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
    public
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
    public
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
    public
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
    public
    function human_filesize($bytes, $decimals = 2)
    {
        $sz = 'BKMGTP';
        $factor = floor((strlen($bytes) - 1) / 3);
        return sprintf("%.{$decimals}f", $bytes / pow(1024, $factor)) . @$sz[$factor];
    }

    /**
     * get all keys from array
     * @param $array
     * @return array
     */
    public
    function array_keys_multi(array $array)
    {
        $keys = array();

        foreach ($array as $key => $value) {
            $keys[] = $key;

            if (is_array($value)) {
                $keys = array_merge($keys, $this->array_keys_multi($value));
            }
        }

        return $keys;
    }

    /**
     * get db identifier for current site
     * @return string
     */
    public
    function getSiteIdentifier()
    {

        if ($this->site instanceof Site) {
            return $this->site->getNodeName();
        } else {
            return 'nosite';
        }


    }

}
