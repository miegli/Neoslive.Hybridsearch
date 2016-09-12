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
     * @var \TYPO3\Flow\Http\Client\CurlEngine
     */
    protected $browserRequestEngine;

    /**
     * @Flow\Inject
     * @var \TYPO3\Flow\Http\Client\Browser
     */
    protected $browser;



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
    protected $temporaryDirectory;


    /**
     * @var mixed
     */
    protected $hyphenator;


    /**
     * @var \stdClass
     */
    protected $index;


    /**
     * @var array
     */
    protected $settings;




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

    }

    /**
     * Injects the Environment object
     *
     * @param \TYPO3\Flow\Utility\Environment $environment
     * @return void
     */
    public function injectEnvironment(\TYPO3\Flow\Utility\Environment $environment)
    {
        $this->environment = $environment;

        $temporaryDirectory = $this->environment->getPathToTemporaryDirectory() . '/NeosliveHybridsearch/';

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


    }


    /**
     * Create full search index for given node path
     *
     *
     * @param string $path path of the root node name
     * @param Site $site
     * @param string $workspacename
     * @return void
     */
    public function createFullIndex($path, $site, $workspacename)
    {

        $this->firebaseDeleteAll();


        foreach ($this->workspaceRepository->findAll() as $workspace) {

            /** @var Workspace $workspace */
            if ($workspacename === null || $workspacename === $workspace->getName()) {
                $this->createIndex($path, $workspace, $site);
            }

        }


        $this->save();


    }

    /**
     * Create search index for given root node name, workspace and dimension array
     *
     *
     * @param string $path node identified by path used as entry point for creating search index
     * @param Workspace $workspace workspace creating search index for
     * @return void
     */
    private function createIndex($path, $workspace, $site)
    {


        // TODO: Performance could be improved by a search for all child node data instead of looping over all contexts
        foreach ($this->contentDimensionCombinator->getAllAllowedCombinations() as $dimensionConfiguration) {
            $context = $this->createContext($workspace->getName(), $dimensionConfiguration, $site);

            /** @var Node $node */
            $node = new Node(
                $this->nodeDataRepository->findOneByPath($path, $workspace),
                $context
            );

            $this->generateIndex($node, $workspace, $dimensionConfiguration);


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
    private function generateIndex($node, $workspace, $dimensionConfiguration, $nodeTypeFilter = '[instanceof TYPO3.Neos:Node]')
    {

        $workspaceHash = preg_replace("/^A-z0-9/", "-", $workspace->getName());
        $dimensionConfigurationHash = sha1(json_encode($dimensionConfiguration));


        $flowQuery = new FlowQuery(array($node));


        foreach ($flowQuery->find($nodeTypeFilter) as $children) {

            /** @var Node $children */
            $this->generateSingleIndex($children, $workspaceHash, $dimensionConfigurationHash);
        }


        $this->save();

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


        if (isset($this->index->$workspaceHash) === false) {
            $this->index->$workspaceHash = new \stdClass();
        }

        if (isset($this->index->$workspaceHash->$dimensionConfigurationHash) === false) {
            $this->index->$workspaceHash->$dimensionConfigurationHash = new \stdClass();
        }


        $indexData = $this->convertNodeToSearchIndexResult($node);

        foreach ($this->generateSearchIndexFromProperties($indexData->properties) as $keyword => $frequency) {

            if (isset($this->index->$workspaceHash->$dimensionConfigurationHash->$keyword) === false) {
                $this->index->$workspaceHash->$dimensionConfigurationHash->$keyword = new \stdClass();
            }

            $identifier = $indexData->identifier;
            $this->index->$workspaceHash->$dimensionConfigurationHash->$keyword->$identifier = $indexData;

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
     * @return \stdClass
     */
    private function convertNodeToSearchIndexResult($node, $grandParentNodeFilter = '[instanceof TYPO3.Neos:Document]')
    {


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

        $parentNode = $flowQuery->parent()->closest('[instanceof TYPO3.Neos:Content]')->get(0);
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
     * Save generated search index as tempory json file for persisting later
     *
     * @return void
     */
    protected function save()
    {


    //    $this->firebaseRequest($this->index);



     foreach ($this->index as $workspace => $workspaceData) {


         foreach ($workspaceData as $dimension => $dimensionData) {

             $this->firebaseRequest($dimensionData, 'PATCH', $workspace . "/" . $dimension);

            // foreach ($dimensionData as $keyword => $keywordData) {
           //      $this->firebaseRequest($keywordData, 'PATCH', $workspace . "/" . urlencode($keyword));
           //  }

         }

     }


        $this->index = new \stdClass();


    }


    /**
     * Do firebase request
     * @param mixed $data
     * @param string $method
     * @param string $path
     * @return mixed
     */
    protected function firebaseRequest($data,$method='PATCH',$path="/")
    {

        $jsondata = json_encode($data);
        $length = strlen($jsondata);

        $headers = array(
            "Cache-Control: no-cache",
            "Content-Type: application/json; charset=utf-8",
            "Content-Length: ".$length
        );

        $this->browserRequestEngine->setOption(CURLOPT_HTTPHEADER, $headers);
        $this->browserRequestEngine->setOption(CURLOPT_SSL_VERIFYPEER, FALSE);
        $this->browserRequestEngine->setOption(CURLOPT_SSL_VERIFYHOST, FALSE);
        $this->browserRequestEngine->setOption(CURLOPT_CONNECTTIMEOUT, 600000);
        $this->browserRequestEngine->setOption(CURLOPT_TIMEOUT, 600000);
        $this->browserRequestEngine->setOption(CURLOPT_FRESH_CONNECT, FALSE);
        $this->browserRequestEngine->setOption(CURLOPT_TCP_NODELAY, FALSE);
        $this->browserRequestEngine->setOption(CURLOPT_RETURNTRANSFER, TRUE);
        $this->browser->setRequestEngine($this->browserRequestEngine);

        $this->browser->request('https://phlu-f98dd.firebaseio.com/'.$this->settings['Firebase']['path'].'/'.$path.'/.json?auth='.$this->settings['Firebase']['token'], $method,array(),array(),array(),$jsondata);


    }

    /**
     * Do firebase delete request
     * @return mixed
     */
    protected function firebaseDeleteAll()
    {



        $headers = array(
            "Cache-Control: no-cache",
            "Content-Type: application/json; charset=utf-8",
        );

        $this->browserRequestEngine->setOption(CURLOPT_HTTPHEADER, $headers);
        $this->browserRequestEngine->setOption(CURLOPT_SSL_VERIFYPEER, FALSE);
        $this->browserRequestEngine->setOption(CURLOPT_SSL_VERIFYHOST, FALSE);
        $this->browserRequestEngine->setOption(CURLOPT_CONNECTTIMEOUT, 600000);
        $this->browserRequestEngine->setOption(CURLOPT_TIMEOUT, 600000);
        $this->browserRequestEngine->setOption(CURLOPT_FRESH_CONNECT, FALSE);
        $this->browserRequestEngine->setOption(CURLOPT_TCP_NODELAY, FALSE);
        $this->browserRequestEngine->setOption(CURLOPT_RETURNTRANSFER, TRUE);
        $this->browser->setRequestEngine($this->browserRequestEngine);

        $this->browser->request('https://phlu-f98dd.firebaseio.com/'.$this->settings['Firebase']['path'].'/.json?auth='.$this->settings['Firebase']['token'], 'DELETE',array(),array(),array());


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
