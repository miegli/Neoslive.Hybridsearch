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
use Flowpack\JobQueue\Common\Annotations as Job;
use Firebase\FirebaseLib;

class SearchIndexFactory
{


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
     * @var array
     */
    protected $settings;


    /**
     * @var string
     */
    protected $servername;


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

        $this->servername = 'localhost';
        $this->firebase = new FirebaseLib($this->settings['Firebase']['endpoint'] . "/" . $this->settings['Firebase']['path'], $this->settings['Firebase']['token']);


    }


    /**
     * Create full search index for given node path
     * @Job\Defer(queueName="neoslive-hybridsearch-queue")
     * @param string $path path of the root node name
     * @param Site $site
     * @param string $workspacename
     * @return void
     */
    public function createFullIndex($path, $site, $workspacename)
    {


        foreach ($this->workspaceRepository->findAll() as $workspace) {

            /** @var Workspace $workspace */
            if ($workspacename === null || $workspacename === $workspace->getName()) {
                $this->deleteWorkspace($workspace);
                $this->createIndex($path, $workspace, $site);
                $this->save();
            }

        }


    }


    /**
     * Update index for given node and target workspace
     * @Job\Defer(queueName="neoslive-hybridsearch-queue")
     * @param Node $node
     * @param Workspace $workspace
     */
    public function updateIndex($node, $workspace)
    {

        $this->generateSingleIndex($node, $this->getWorkspaceHash($workspace), $node->getNodeData()->getDimensionsHash());
        $this->save();

    }

    /**
     * Update index for given node and target workspace
     * @param Node $node
     * @param Workspace $workspace
     */
    public function removeIndex($node, $workspace)
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
     * @return void
     */
    public function createIndex($path, $workspace, $site, $includingSelf = false)
    {


        // TODO: Performance could be improved by a search for all child node data instead of looping over all contexts
        foreach ($this->contentDimensionCombinator->getAllAllowedCombinations() as $dimensionConfiguration) {


            $context = $this->createContext($workspace->getName(), $dimensionConfiguration, $site);

            /** @var Node $node */
            $node = new Node(
                $this->nodeDataRepository->findOneByPath($path, $workspace),
                $context
            );

            $this->generateIndex($node, $workspace, $dimensionConfiguration,'',$includingSelf);


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


        $workspaceHash = $this->getWorkspaceHash($workspace);
        $dimensionConfigurationHash = $this->getDimensionConfiugurationHash($dimensionConfiguration);


        $flowQuery = new FlowQuery(array($node));


        if ($includingSelf) {
            $this->generateSingleIndex($node, $workspaceHash, $dimensionConfigurationHash);
        }


        foreach ($flowQuery->find($nodeTypeFilter) as $children) {

            /** @var Node $children */
            $this->generateSingleIndex($children, $workspaceHash, $dimensionConfigurationHash);

        }


        $this->save();

    }


    /**
     * Remove single index for given node
     *
     * @param Node $node
     * @param String $workspaceHash
     * @param string $dimensionConfigurationHash
     * @return void
     */
    private function removeSingleIndex($node, $workspaceHash, $dimensionConfigurationHash)
    {

        if ($this->creatingFullIndex === false) {

            $servername = $this->getServerName();

            foreach ($this->getIndexByNode($node, $workspaceHash, $dimensionConfigurationHash) as $keyword => $val) {
                $this->firebase->delete($servername . "/index/$workspaceHash/$dimensionConfigurationHash" . "/" . urlencode($keyword) . "/" . urlencode($node->getIdentifier()));
            }

            $this->firebase->delete($servername . "/keywords/$workspaceHash/$dimensionConfigurationHash" . "/" . urlencode($node->getIdentifier()));

        }


    }

    /**
     * Generates single index for given node
     *
     * @param Node $node
     * @param String $workspaceHash
     * @param string $dimensionConfigurationHash
     * @return void
     */
    private function generateSingleIndex($node, $workspaceHash, $dimensionConfigurationHash)
    {

        $this->removeSingleIndex($node, $workspaceHash, $dimensionConfigurationHash);





        if ($node->isHidden() || $node->isRemoved()) {

            // skipp node
        } else {


            if (isset($this->keywords->keywords->$workspaceHash->$dimensionConfigurationHash->keywords) === false) {
                $this->keywords->keywords = new \stdClass();
                $this->keywords->keywords->$workspaceHash = new \stdClass();
                $this->keywords->keywords->$workspaceHash->$dimensionConfigurationHash = new \stdClass();
                $this->keywords->keywords->$workspaceHash->$dimensionConfigurationHash->keywords = new \stdClass();
            }


            if (isset($this->index->$workspaceHash) === false) {
                $this->index->$workspaceHash = new \stdClass();
            }

            if (isset($this->index->$workspaceHash->$dimensionConfigurationHash) === false) {
                $this->index->$workspaceHash->$dimensionConfigurationHash = new \stdClass();
            }


            $indexData = $this->convertNodeToSearchIndexResult($node);
            $identifier = $indexData->identifier;

            $this->keywords->keywords->$workspaceHash->$dimensionConfigurationHash->$identifier = new \stdClass();

            foreach ($this->generateSearchIndexFromProperties($indexData->properties) as $keyword => $frequency) {

                if (isset($this->index->$workspaceHash->$dimensionConfigurationHash->$keyword) === false) {
                    $this->index->$workspaceHash->$dimensionConfigurationHash->$keyword = new \stdClass();
                }


                $this->index->$workspaceHash->$dimensionConfigurationHash->$keyword->$identifier = $indexData;
                $this->keywords->keywords->$workspaceHash->$dimensionConfigurationHash->$identifier->$keyword = true;


            }

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

        $keywords = array();

        $text = "";


        foreach ($properties as $property => $value) {

            if (gettype($value) !== 'string') {

                $value = json_encode($value);
            }

            $text .= preg_replace("/[^A-z0-9öäüÖÄÜ ]/", "", mb_strtolower(strip_tags(preg_replace("/[^A-z0-9öäüÖÄÜ]/", " ", $value)))) . " ";

        }

        $words = explode(" ", $text);


        $hypenated = $this->getHyphenator()->hyphenate($text);
        if (is_string($hypenated)) {
            $hwords = explode(" ", $hypenated);
            foreach ($hwords as $key => $v) {
                if (strlen($v) > 2) {
                    $words[] = $v;
                }
            }
        }

        foreach ($words as $w) {
            if (strlen($w) > 1) {
                $w = Encoding::UTF8FixWin1252Chars($w);
                $keywords[$w] = isset($keywords[$w]) ? $keywords[$w] + 1 : 1;
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

                    $properties->$k = (Encoding::UTF8FixWin1252Chars($val));


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
        $data->nodeType = $node->getNodeType()->getName();
        $data->isHidden = $node->isHidden();
        $data->isRemoved = $node->isRemoved();


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
     * Save generated search index as tempory json file for persisting later
     *
     * @return void
     */
    protected function save()
    {

        $servername = $this->getServerName();

        if ($this->creatingFullIndex) {

            // patch index data all in one request
            foreach ($this->index as $workspace => $workspaceData) {
                foreach ($workspaceData as $dimension => $dimensionData) {
                    $this->firebase->update($servername . "/index/" . $workspace . "/" . $dimension, $dimensionData);
                }
            }

            // patch keywords data all in one request
            $this->firebase->update($servername, $this->keywords);

        } else {


            // put index data node by node for keep old records existing
            foreach ($this->index as $workspace => $workspaceData) {
                foreach ($workspaceData as $dimension => $dimensionData) {
                    foreach ($dimensionData as $keyword => $keywordData) {
                        foreach ($keywordData as $node => $nodeData) {
                            $this->firebase->update($servername . "/index/" . $workspace . "/" . $dimension . "/" . urlencode($keyword) . "/" . urlencode($node), $nodeData);
                        }
                    }
                }
            }

            // patch keywords data all in one request

            foreach ($this->keywords as $path => $pathData) {

                foreach ($pathData as $workspace => $workspaceData) {

                    foreach ($workspaceData as $dimension => $dimensionData) {

                        foreach ($dimensionData as $node => $nodeData) {
                            $this->firebase->set($servername . "/keywords/" . $workspace . "/" . $dimension . "/" . urlencode($node), $nodeData);
                        }

                    }
                }


            }


        }


        $this->index = new \stdClass();
        $this->keywords = new \stdClass();


    }


    /**
     * Get Firebase index by node
     * @param Node $node
     * @param String $workspaceHash
     * @param string $dimensionConfigurationHash
     * @return array
     */
    public function getIndexByNode($node, $workspaceHash, $dimensionConfigurationHash)
    {

        $path = $this->getServerName() . "/keywords/" . $workspaceHash . "/" . $dimensionConfigurationHash . "/" . $node->getIdentifier();
        $result = $this->firebase->get($path);
        return $result != 'null' ? json_decode($result) : array();


    }


    /**
     * Delete index for given workspace
     * Do firebase delete request
     * @param Workspace $workspace
     * @return mixed
     */
    protected function deleteWorkspace($workspace)
    {

        $this->creatingFullIndex = true;

        $this->firebase->delete($this->getServerName() . '/index/' . $workspace->getName());
        $this->firebase->delete($this->getServerName() . '/keywords/' . $workspace->getName());


    }

    /**
     * Get servers name
     * @return string
     */
    protected function getServerName()
    {

        return preg_replace("/[^A-z0-9]/", "-", $this->servername);


    }


    /**
     * Get Hyphenator instance
     *
     * @return h\Hyphenator
     */
    protected function getHyphenator()
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
     * @param Site $currentSite
     * @return \TYPO3\TYPO3CR\Domain\Service\Context
     */
    protected function createContext($workspaceName, $dimensions, $currentSite)
    {


        return $this->contentContextFactory->create(array(
            'workspaceName' => $workspaceName,
            'currentSite' => $currentSite,
            'dimensions' => $dimensions,
            'invisibleContentShown' => false,
            'inaccessibleContentShown' => false,
            'removedContentShown' => false
        ));
    }


}
