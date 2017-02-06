<?php
namespace Neoslive\Hybridsearch\Aspects\TYPO3\Neos;

/*
 * This file is part of the TYPO3.Neos package.
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

/**
 * @Flow\Aspect
 */
class WorkspaceAspect
{


    /**
     * @Flow\Inject
     * @var SearchIndexFactory
     */
    protected $searchIndexFactory;


    /**
     * @Flow\After("method(TYPO3\Neos\Service\Controller\WorkspaceController->publishAllAction())")
     * @return void
     */
    public function publishAllAction(JoinPointInterface $joinPoint)
    {

        $this->searchIndexFactory->syncIndexRealtime($joinPoint->getMethodArgument('targetWorkspaceName'));

    }

    /**
     * @Flow\After("method(TYPO3\Neos\Service\Controller\WorkspaceController->publishNodesAction())")
     * @return void
     */
    public function publishNodesAction(JoinPointInterface $joinPoint)
    {

        $this->searchIndexFactory->syncIndexRealtime($joinPoint->getMethodArgument('targetWorkspaceName'));

    }



}
