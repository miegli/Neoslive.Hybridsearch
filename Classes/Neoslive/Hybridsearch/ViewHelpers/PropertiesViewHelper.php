<?php
namespace Neoslive\Hybridsearch\ViewHelpers;

/*
 * This file is part of the TYPO3.Neos package.
 *
 * (c) Contributors of the Neos Project - www.neos.io
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */

use TYPO3\Flow\Annotations as Flow;
use TYPO3\Fluid\Core\ViewHelper\AbstractViewHelper;
use TYPO3\TYPO3CR\Domain\Model\Node;
use TYPO3\Eel\FlowQuery\FlowQuery;

/**
 * properties view helper
 */
class PropertiesViewHelper extends AbstractViewHelper
{

    /**
     * @Flow\Inject
     * @var \TYPO3\Flow\Configuration\ConfigurationManager
     */
    protected $configurationManager;

    /**
     * Disable escaping of tag based ViewHelpers so that the rendered tag is not htmlspecialchar'd
     *
     * @var boolean
     */
    protected $escapeOutput = FALSE;


    /**
     * @return array
     */
    public function render()
    {


        $properties = new \StdClass;


        foreach ($this->configurationManager->getConfiguration('NodeTypes') as $nodeType => $nodeTypeConfiguration) {

            $n = $this->getNodeTypeName($nodeType);

            $groups = isset($nodeTypeConfiguration['ui']['inspector']['groups']) ? $nodeTypeConfiguration['ui']['inspector']['groups'] : array();
            $propes = isset($nodeTypeConfiguration['properties']) ? $nodeTypeConfiguration['properties'] : array();


            foreach ($propes as $key => $val) {

                if (substr($key,0,1) !== '_') {
                    if (isset($properties->$n) == false) {
                        $properties->$n = new \StdClass;
                    }
                    $properties->$n->$key = new \StdClass;
                    $properties->$n->$key->label = strtolower(isset($val['ui']['label']) ? $val['ui']['label'] : $key);
                    $properties->$n->$key->description = strtolower(isset($val['ui']['inspector']['group']) ? (isset($groups[$val['ui']['inspector']['group']]) ? isset($groups[$val['ui']['inspector']['group']]['label']) ? $groups[$val['ui']['inspector']['group']]['label'] : '' : '') : '');

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