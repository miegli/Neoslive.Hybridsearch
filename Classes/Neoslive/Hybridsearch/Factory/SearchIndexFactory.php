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


use TYPO3\Flow\Annotations as Flow;
use TYPO3\Neos\Domain\Repository\SiteRepository;
use TYPO3\Neos\Domain\Service\ContentContextFactory;
use TYPO3\TYPO3CR\Domain\Model\Node;
use TYPO3\Neos\Domain\Model\Site;
use TYPO3\TYPO3CR\Domain\Model\Workspace;
use TYPO3\TYPO3CR\Domain\Repository\NodeDataRepository;
use TYPO3\TYPO3CR\Domain\Repository\WorkspaceRepository;
use TYPO3\TYPO3CR\Domain\Service\ContentDimensionCombinator;
use TYPO3\Eel\FlowQuery\FlowQuery;
use \Org\Heigl\Hyphenator as h;
use \ForceUTF8\Encoding;
use Firebase\FirebaseLib;
use TYPO3\Flow\Utility\Algorithms;
use TYPO3\Flow\Core\Booting\Scripts;

class SearchIndexFactory
{

    /**
     * @Flow\InjectConfiguration(package="TYPO3.Flow")
     * @var array
     */
    protected $flowSettings;

    /**
     * @Flow\Inject
     * @var WorkspaceRepository
     */
    protected $workspaceRepository;

    /**
     * @Flow\Inject
     * @var NodeDataRepository
     */
    protected $nodeDataRepository;


    /**
     * @Flow\Inject
     * @var SiteRepository
     */
    protected $siteRepository;

    /**
     * @var \TYPO3\Flow\Utility\Environment
     */
    protected $environment;

    /**
     * @Flow\Inject
     * @var ContentContextFactory
     */
    protected $contentContextFactory;


    /**
     * @Flow\Inject
     * @var ContentDimensionCombinator
     */
    protected $contentDimensionCombinator;


    /**
     * @var mixed
     */
    protected $hyphenator;


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
    protected $magicSplit = 4;


    /**
     * @var array
     */
    protected $settings;


    /**
     * @var string
     */
    protected $temporaryDirectory;


    /**
     * @var FirebaseLib
     */
    protected $firebase;


    /**
     * @var boolean
     */
    protected $creatingFullIndex = false;


    /**
     * Inject the settings
     *
     * @param array $settings
     * @return void
     */
    public function injectSettings(array $settings)
    {
        $this->settings = $settings;

        $this->index = new \stdClass();
        $this->keywords = new \stdClass();

    }

    /**
     * Injects the Environment object
     *
     * @param \TYPO3\Flow\Utility\Environment $environment
     * @return void
     */
    public function injectEnvironment(\TYPO3\Flow\Utility\Environment $environment)
    {

        $this->firebase = new FirebaseLib($this->settings['Firebase']['endpoint'], $this->settings['Firebase']['token']);
        $this->firebase->setTimeOut(0);

        $this->environment = $environment;

        $temporaryDirectory = $this->environment->getPathToTemporaryDirectory() . 'NeosliveHybridsearch/';

        if (!is_writable($temporaryDirectory)) {
            try {
                \TYPO3\Flow\Utility\Files::createDirectoryRecursively($temporaryDirectory);
            } catch (\TYPO3\Flow\Utility\Exception $exception) {
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


    }


    /**
     * Create full search index for given node path
     * @param string $path path of the root node name
     * @param Site $site
     * @param string $workspacename
     * @return void
     */
    public function createFullIndex($path, $site, $workspacename)
    {

        $this->creatingFullIndex = true;

        foreach ($this->workspaceRepository->findAll() as $workspace) {

            /** @var Workspace $workspace */
            if ($workspacename === null || $workspacename === $workspace->getName()) {
                $this->createIndex($path, $workspace, $site);
            }

        }

        foreach ($this->workspaceRepository->findAll() as $workspace) {
            /** @var Workspace $workspace */
            if ($workspacename === null || $workspacename === $workspace->getName()) {
                $this->deleteWorkspace($workspace);
            }
        }

        $this->save();

    }


    /**
     * Update index for given node and target workspace
     * @param Node $node
     * @param Workspace $workspace
     */
    public function updateIndex($node, $workspace = null)
    {

        if (!$workspace instanceof Workspace) {
            $workspace = $node->getWorkspace();
        }

        if ($node->isHidden() || $node->isRemoved()) {
            //$this->createIndex($node->getPath(), $workspace, null, true, $node);
            $this->removeIndex($node, $workspace);
        } else {
            $this->generateSingleIndex($node, $workspace, $node->getNodeData()->getDimensionsHash());
        }


        $this->save();


    }

    /**
     * Update index for given node and target workspace
     * @param Node $node
     * @param Workspace $workspace
     */
    private function removeIndex($node, $workspace)
    {
        $this->removeSingleIndex($node, $this->getWorkspaceHash($workspace), $node->getNodeData()->getDimensionsHash());
    }

    /**
     * Create search index for given root node name, workspace and site
     *
     *
     * @param string $path node identified by path used as entry point for creating search index
     * @param Workspace $workspace workspace creating search index for
     * @param Site $site neos site
     * @param boolean $includingSelf If specified, indexing self node otherwise only children
     * @param Node $node
     * @return void
     */
    public function createIndex($path, $workspace, $site = null, $includingSelf = false, $node = null)
    {


        if ($node !== null) {

            $this->generateIndex($node, $workspace, $node->getContext()->getDimensions(), '', $includingSelf);

        } else {


            // TODO: Performance could be improved by a search for all child node data instead of looping over all contexts
            foreach ($this->contentDimensionCombinator->getAllAllowedCombinations() as $dimensionConfiguration) {

                $targetDimension = array_map(function ($dimensionValues) {
                    return array_shift($dimensionValues);
                }, $dimensionConfiguration);

                $context = $this->createContext($workspace->getName(), $dimensionConfiguration, $targetDimension, $site);
                /** @var Node $node */
                $node = new Node(
                    $this->nodeDataRepository->findOneByPath($path, $workspace),
                    $context
                );

                $this->generateIndex($node, $workspace, $dimensionConfiguration, '', $includingSelf);


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
     * @param boolean $includingSelf If specified, indexing self node otherwise only children
     * @return void
     */
    private function generateIndex($node, $workspace, $dimensionConfiguration, $nodeTypeFilter = '', $includingSelf = false)
    {


        if ($nodeTypeFilter === '') {
            if (isset($this->settings['Filter']['NodeTypeFilter'])) {
                $nodeTypeFilter = $this->settings['Filter']['NodeTypeFilter'];
            } else {
                $nodeTypeFilter = '[instanceof TYPO3.Neos:Content]';
            }
        }


        $dimensionConfigurationHash = $this->getDimensionConfiugurationHash($dimensionConfiguration);


        $flowQuery = new FlowQuery(array($node));


        if ($includingSelf) {
            $this->generateSingleIndex($node, $workspace, $dimensionConfigurationHash);
        }


        foreach ($flowQuery->find($nodeTypeFilter) as $children) {

            /** @var Node $children */
            $this->generateSingleIndex($children, $workspace, $dimensionConfigurationHash);

        }


    }


    /**
     * Remove single index for given node
     *
     * @param Node $node
     * @param String $workspaceHash
     * @param string $dimensionConfigurationHash
     * @param array $skipKeywords
     * @return void
     */
    private function removeSingleIndex($node, $workspaceHash, $dimensionConfigurationHash, $skipKeywords = array())
    {

        if ($this->creatingFullIndex === false) {
            $this->firebaseDelete("index/$workspaceHash/$dimensionConfigurationHash" . "/" . urlencode($node->getIdentifier()));
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
    private function generateSingleIndex($node, $workspace, $dimensionConfigurationHash)
    {

        $workspaceHash = $this->getWorkspaceHash($workspace);

        if ($node->isHidden() || $node->isRemoved()) {

            // skipp node
            $this->removeIndex($node, $workspace);

        } else {


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

            $keywords = $this->generateSearchIndexFromProperties($indexData->properties);
            $keywords->__node = $indexData;
            $keywords->__nodetype = $indexData->nodeType;

            foreach ($keywords as $keyword => $val) {
                $this->keywords->$workspaceHash->$dimensionConfigurationHash[strval($keyword)] = 1;
            }


            $this->index->$workspaceHash->$dimensionConfigurationHash->$identifier = $keywords;


        }


    }

    /**
     * Generate search index words from properties array
     *
     * @param array $properties
     * @return void
     */
    protected function generateSearchIndexFromProperties($properties)
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

            $text .= (preg_replace("/[^A-z0-9öäüÖÄÜ ]/", "", mb_strtolower(strip_tags(preg_replace("/[^A-z0-9öäüÖÄÜ]/", " ", $value)))) . " ");

        }

        $words = explode(" ", $text);


//        $hypenated = $this->getHyphenator()->hyphenate($text);
//        if (is_string($hypenated)) {
//            $hwords = explode(" ", $hypenated);
//            foreach ($hwords as $key => $v) {
//                if (strlen($v) > 2) {
//                    $words[] = $v;
//                }
//            }
//        }

        foreach ($words as $w) {
            if (strlen($w) > 1) {
                $w = Encoding::UTF8FixWin1252Chars($w);
                $ws = mb_strtolower(substr(($w),0,$this->magicSplit*2));
                if (isset($keywords->$ws) === false) {
                    $keywords->$ws = new \stdClass();
                }

                $wshort = mb_strtolower(substr(($w),0,$this->magicSplit));

                if (isset($keywords->$wshort) === false) {
                    $keywords->$wshort = new \stdClass();
                }


                $keywords->$ws->$w = 1;
            }
        }

        return $keywords;

    }


    /**
     * @param Node $node
     * @param string $grandParentNodeFilter
     * @param string $parentNodeFilter
     * @return \stdClass
     */
    private function convertNodeToSearchIndexResult($node, $grandParentNodeFilter = '', $parentNodeFilter = '')
    {

        if ($grandParentNodeFilter === '') {
            if (isset($this->settings['Filter']['GrantParentNodeTypeFilter'])) {
                $grandParentNodeFilter = $this->settings['Filter']['GrantParentNodeTypeFilter'];
            } else {
                $grandParentNodeFilter = '[instanceof TYPO3.Neos:Content]';
            }
        }

        if ($parentNodeFilter === '') {
            if (isset($this->settings['Filter']['ParentNodeTypeFilter'])) {
                $parentNodeFilter = $this->settings['Filter']['ParentNodeTypeFilter'];
            } else {
                $parentNodeFilter = '[instanceof TYPO3.Neos:Content]';
            }
        }


        $properties = new \stdClass();
        foreach ($node->getProperties() as $key => $val) {


            if (gettype($val) === 'string') {
                $k = mb_strtolower(preg_replace("/[^A-z0-9]/", "-", $node->getNodeType()->getName() . ":" . $key));
                if (is_string($val)) {
                    $properties->$k = strip_tags(Encoding::UTF8FixWin1252Chars($val));

                }
            }
        }


        $flowQuery = new FlowQuery(array($node));

        $parentNode = $flowQuery->parent()->closest($parentNodeFilter)->get(0);
        $grandParentNode = $flowQuery->closest($grandParentNodeFilter)->get(0);


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

            $properties->parent = (Encoding::UTF8FixWin1252Chars($parentPropertiesText));
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

            $properties->grandparent = (Encoding::UTF8FixWin1252Chars($grandParentPropertiesText));
        }

        $data = new \stdClass();


        $data->identifier = $node->getNodeData()->getIdentifier();
        $data->properties = $properties;
        $data->nodeType = mb_strtolower(preg_replace("/[^A-z0-9]/", "-", $node->getNodeType()->getName()));

        $data->grandParentNode = new \stdClass();
        $data->grandParentNode->identifier = $grandParentNode ? $grandParentNode->getIdentifier() : null;
        $data->grandParentNode->properties = $grandParentProperties;
        $data->grandParentNode->nodeType = $grandParentNode ? $grandParentNode->getNodeType()->getName() : '';

        if ($parentNode) {
            $data->parentNode = new \stdClass();
            $data->parentNode->identifier = $parentNode->getIdentifier();
            $data->parentNode->properties = $parentProperties;
            $data->parentNode->nodeType = $parentNode->getNodeType()->getName();
        }



        return $data;


    }


    /**
     * Get dimension confiuguration hash (replace critical strings)
     * @param array $dimensionConfiguration
     * @return string
     */
    private function getDimensionConfiugurationHash($dimensionConfiguration)
    {

        return \TYPO3\TYPO3CR\Utility::sortDimensionValueArrayAndReturnDimensionsHash($dimensionConfiguration);

    }


    /**
     * Get workspace hash (replace critical strings) for given workspace
     * @param Workspace $workspace
     * @return string
     */
    private function getWorkspaceHash($workspace)
    {

        return preg_replace("/^A-z0-9/", "-", $workspace->getName());

    }


    /**
     * @param string $path
     * @param mixed $data
     * @return void
     */
    public function firebaseUpdate($path, $data)
    {


        $this->addToQueue($path, $data, 'update');

    }

    /**
     * @param string $path
     * @param mixed $data
     * @return void
     */
    public function firebaseSet($path, $data)
    {

        $this->addToQueue($path, $data, 'set');


    }


    /**
     * @param string $path
     * @return void
     */
    public function firebaseDelete($path)
    {

        $this->addToQueue($path, null, 'delete');


    }


    /**
     * @param string $path
     * @param mixed $data
     * @param string $method
     * @return void
     */
    protected function addToQueue($path, $data = null, $method = 'update')
    {


        $filename = $this->temporaryDirectory . "/queued_" . time() . $this->queuecounter . "_" . Algorithms::generateUUID() . ".json";

        $fp = fopen($filename, 'w');
        fwrite($fp, json_encode(
            array(
                'path' => $path,
                'data' => $data,
                'method' => $method,
            )
        ));
        fclose($fp);

        $this->queuecounter++;

    }


    /**
     * @return void
     */
    public function proceedQueue()
    {

        $this->proceedcounter++;
        $lockedfilename = $this->temporaryDirectory . "/locked.txt";

        if (is_file($lockedfilename) === true) {

            sleep(1);
            if ($this->proceedcounter < 1000) {
                $this->proceedQueue();
            }

        } else {

            $fp = fopen($lockedfilename, 'w');
            fwrite($fp, time());
            fclose($fp);

            $files = array();

            $fp = opendir($this->temporaryDirectory);
            while (false !== ($entry = readdir($fp))) {

                if (substr($entry, 0, 6) === 'queued') {
                    list($name, $number, $uuid) = explode("_", $entry);
                    $files[$number][] = $this->temporaryDirectory . $entry;
                }

            }


            ksort($files);


            foreach ($files as $filecollection) {
                foreach ($filecollection as $file) {

                    $content = json_decode(file_get_contents($file));

                    if ($content) {

                        switch ($content->method) {
                            case 'update':
                                $this->firebase->update($content->path, $content->data);
                                break;

                            case 'delete':
                                $this->firebase->delete($content->path);
                                break;

                            case 'set':
                                $this->firebase->set($content->path, $content->data);
                                break;
                        }
                    }
                }


                unlink($file);

            }


        }


        unlink($lockedfilename);


    }

    /**
     * Updates firebase rules for performance increase
     * @return void
     */
    public function updateFireBaseRules()
    {


        $keywords = $this->firebase->get("keywords");
        $this->firebase->set('.settings/rules', $this->getFirebaseRules(json_decode($keywords)));


    }


    /**
     * Save generated search index as tempory json file for persisting later
     * @param string $target keywords|index
     * @param mixed index
     * @param mixed keywords
     * @return void
     */
    protected function save()
    {


        // patch index data all in one request
        foreach ($this->index as $workspace => $workspaceData) {
            foreach ($workspaceData as $dimension => $dimensionData) {
                $this->firebaseUpdate("index/" . $workspace . "/" . $dimension, $dimensionData);
            }
        }


        if ($this->creatingFullIndex) {
            $this->firebase->set('.settings/rules', $this->getFirebaseRules($this->keywords));
            $this->firebase->set('keywords', $this->keywords);
        } else {

            foreach ($this->keywords as $workspace => $workspaceData) {

                foreach ($workspaceData as $dimension => $dimensionData) {
                    $this->firebaseUpdate("keywords/$workspace/$dimension", $dimensionData);
                }

            }


        }


        $this->index = new \stdClass();
        $this->keywords = new \stdClass();

        Scripts::executeCommandAsync('hybridsearch:proceed', $this->flowSettings, array());


    }


    /**
     * Get Firebase rules by given keywords
     * @param mixed $keywords
     * @return array
     */
    private function getFirebaseRules($keywords)
    {

        $rules = array();

        foreach ($keywords as $dimension => $val) {
            if (isset($rules['index'][$dimension]) === false) {
                $rules['index'][$dimension] = array();
            }
            foreach ($val as $k => $v) {
                if (isset($rules['index'][$dimension][$k]) === false) {
                    $rules['index'][$dimension][$k] = array();
                    $rules['index'][$dimension][$k]['.indexOn'] = array();
                }


                if (is_array($v)) {
                    foreach (array_keys($v) as $key) {
                        array_push($rules['index'][$dimension][$k]['.indexOn'], (string)strval($key));
                    }
                } else {
                    foreach (get_object_vars($v) as $key => $value) {
                        array_push($rules['index'][$dimension][$k]['.indexOn'], (string)strval($key));
                    }
                }


            }
        }

        return array(
            'rules' => array(
                '.read' => true,
                'index' => current($rules)
            )
        );

    }


    /**
     * Get Firebase index by node
     * @param Node $node
     * @param String $workspaceHash
     * @param string $dimensionConfigurationHash
     * @param array $skipKeywords
     * @return array
     */
    public function getIndexByNode($node, $workspaceHash, $dimensionConfigurationHash, $skipKeywords = array())
    {


        $path = "keywords/" . $workspaceHash . "/" . $dimensionConfigurationHash . "/" . $node->getIdentifier();
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
     * Delete index for given workspace
     * Do firebase delete request
     * @param Workspace $workspace
     * @return mixed
     */
    protected
    function deleteWorkspace($workspace)
    {

        $this->firebase->delete('index/' . $workspace->getName());
        $this->firebase->delete('keywords/' . $workspace->getName());


    }


    /**
     * Get Hyphenator instance
     *
     * @return h\Hyphenator
     */
    protected
    function getHyphenator()
    {


        if ($this->hyphenator) {
            return $this->hyphenator;
        }

        $o = new h\Options();
        $o->setHyphen(' ')
            ->setDefaultLocale('de_DE')
            ->setRightMin(4)
            ->setLeftMin(4)
            ->setWordMin(4)
            ->setQuality(100)
            ->setMinWordLength(10)
            ->setFilters('Simple')
            ->setTokenizers('Whitespace', 'Punctuation');
        $this->hyphenator = new h\Hyphenator();
        $this->hyphenator->setOptions($o);

        return $this->hyphenator;


    }

    /**
     * Creates a content context for given workspace
     *
     * @param string $workspaceName
     * @param array $dimensions
     * @param array $targetDimensions
     * @param Site $currentSite
     * @return \TYPO3\TYPO3CR\Domain\Service\Context
     */
    protected
    function createContext($workspaceName, $dimensions, $targetDimensions, $currentSite)
    {

        return $this->contentContextFactory->create(array(
            'workspaceName' => $workspaceName,
            'currentSite' => $currentSite,
            'dimensions' => $dimensions,
            'targetDimensions' => $targetDimensions,
            'invisibleContentShown' => false,
            'inaccessibleContentShown' => false,
            'removedContentShown' => false
        ));
    }


}
