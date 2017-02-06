<?php
namespace Neoslive\Hybridsearch\ViewHelpers;

/*
 * This file is part of the Neos.Neos package.
 *
 * (c) Contributors of the Neos Project - www.neos.io
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */

use Neos\Flow\Annotations as Flow;
use TYPO3\Fluid\Core\ViewHelper\AbstractViewHelper;
use Neos\ContentRepository\Domain\Model\Node;
use Neos\Eel\FlowQuery\FlowQuery;
use Neos\ContentRepository\Domain\Model\NodeType;
use Neos\ContentRepository\Domain\Service\NodeTypeManager;

/**
 * properties view helper
 */
class PropertiesViewHelper extends AbstractViewHelper
{

    /**
     * @Flow\Inject
     * @var \Neos\Flow\Configuration\ConfigurationManager
     */
    protected $configurationManager;



    /**
     * Disable escaping of tag based ViewHelpers so that the rendered tag is not htmlspecialchar'd
     *
     * @var boolean
     */
    protected $escapeOutput = FALSE;

    /**
     * @Flow\Inject
     * @var NodeTypeManager
     */
    protected $nodeTypeManager;



    /**
     * @return array
     */
    public function render()
    {


        $properties = new \StdClass;




        foreach ($this->nodeTypeManager->getNodeTypes(false) as $nodeType) {
            /* @var $nodeType NodeType */
            $nodeTypeConfiguration = $nodeType->getFullConfiguration();

            $n = $this->getNodeTypeName($nodeType->getName());

            $groups = isset($nodeTypeConfiguration['ui']['inspector']['groups']) ? $nodeTypeConfiguration['ui']['inspector']['groups'] : array();
            $propes = isset($nodeTypeConfiguration['properties']) ? $nodeTypeConfiguration['properties'] : array();

            foreach ($propes as $key => $val) {

                if (substr($key,0,1) !== '_' && isset($val['ui'])) {
                    if (isset($properties->$n) == false) {
                        $properties->$n = new \StdClass;
                    }
                    $properties->$n->$key = new \StdClass;
                    $properties->$n->$key->label = strtolower(isset($val['ui']['label']) ? $val['ui']['label'] : $key);
                    $properties->$n->$key->description = " ".preg_replace("[^A-z ]"," ",strtolower(isset($val['ui']['inspector']['group']) ? (isset($groups[$val['ui']['inspector']['group']]) ? json_encode($groups[$val['ui']['inspector']['group']],JSON_UNESCAPED_UNICODE) : '') : (isset($val['ui']['keywords']) ? $val['ui']['keywords'] : '')))." ";

                }

            }


        }


        return json_encode($properties);

    }

    /**
     * gets node type name
     * @param string $nodeType
     * @return string
     */
    private function getNodeTypeName($nodeType)
    {
        return mb_strtolower(preg_replace("/[^A-z0-9]/", "-", $nodeType));
    }



}