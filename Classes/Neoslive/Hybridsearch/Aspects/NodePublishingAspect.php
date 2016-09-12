<?php

namespace Neoslive\Hybridsearch\Aspects;



use Neoslive\Hybridsearch\Factory\SearchIndexFactory;
use TYPO3\Flow\Annotations as Flow;
use TYPO3\Flow\Aop\JoinPointInterface;


/**
 * @Flow\Scope("singleton")
 * @Flow\Aspect
 */
class NodePublishingAspect
{


    /**
     * @Flow\Inject
     * @var SearchIndexFactory
     */
    protected $searchIndexFactory;


    /**
     * @Flow\After("method(TYPO3\TYPO3CR\Domain\Model\Workspace->emitAfterNodePublishing())")
     * @return void
     */
    public function publish(JoinPointInterface $joinPoint)
    {
        $this->searchIndexFactory->updateIndex($joinPoint->getMethodArgument('node'),$joinPoint->getMethodArgument('targetWorkspace'));

    }



}
