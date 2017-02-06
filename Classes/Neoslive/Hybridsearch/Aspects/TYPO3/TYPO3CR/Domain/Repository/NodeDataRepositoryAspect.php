<?php
namespace Neoslive\Hybridsearch\Aspects\Neos\ContentRepository\Domain\Repository;

/*
 * This file is part of the Neos.Neos package.
 *
 * (c) Contributors of the Neos Project - www.neos.io
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */

use Doctrine\ORM\Mapping as ORM;
use Neos\Flow\Annotations as Flow;
use Neos\Flow\Aop\JoinPointInterface;
use Neoslive\Hybridsearch\Factory\SearchIndexFactory;
use Neos\ContentRepository\Domain\Model\NodeData;

/**
 * @Flow\Aspect
 */
class NodeDataRepositoryAspect
{


    /**
     * @Flow\Inject
     * @var SearchIndexFactory
     */
    protected $searchIndexFactory;


    /**
     * @Flow\Before("within(Neos\ContentRepository\Domain\Repository\NodeDataRepository) && method(public .+->(remove)())")
     * @return void
     */
    public function publishNodesAction(JoinPointInterface $joinPoint)
    {
        /** @var NodeData $nodeData */
        $nodeData = $joinPoint->getMethodArgument('object');
        if ($nodeData->getWorkspace()->getName() == 'live') {
            //$this->searchIndexFactory->checkIndexRealtimeForRemovingNodeData($nodeData);
        }

    }


}
