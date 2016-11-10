<?php
namespace Neoslive\Hybridsearch\Command;

/*
 * This file is part of the Flowpack.JobQueue.Common package.
 *
 * (c) Contributors to the package
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */

use Neoslive\Hybridsearch\Factory\GoogleAnalyticsFactory;
use Neoslive\Hybridsearch\Factory\SearchIndexFactory;
use TYPO3\Flow\Annotations as Flow;
use TYPO3\Flow\Cli\CommandController;
use TYPO3\Neos\Domain\Repository\SiteRepository;

/**
 * Hybrid search command controller
 */
class HybridSearchCommandController extends CommandController
{




    /**
     * @Flow\Inject
     * @var SearchIndexFactory
     */
    protected $searchIndexFactory;


    /**
     * @Flow\Inject
     * @var GoogleAnalyticsFactory
     */
    protected $googleAnalyticsFactory;


    /**
     * @Flow\Inject
     * @var SiteRepository
     */
    protected $siteRepository;

    /**
     * Create full search index for given workspace name
     *
     * This command is used to create full search index.
     *
     * @param string $workspacename Name of the workspace
     * @return void
     */
    public function createFullIndexCommand($workspacename='live')
    {


        $this->searchIndexFactory->createFullIndex($workspacename);


    }


    /**
     * Synchronize indexes
     *
     * This command updates index from all local changes
     * @param string $workspaceName
     * @param integer $lastSyncPid
     * @param integer $lastSyncCounter
     * @return void
     */
    public function syncCommand($workspaceName='live',$lastSyncPid=0,$lastSyncCounter=0)

    {
        $this->searchIndexFactory->sync($workspaceName,$lastSyncPid,$lastSyncCounter);

    }

    /**
     * Synchronize indexes
     *
     * This command updates index from all local changes
     *
     * @return void
     */
    public function testCommand()

    {

        \TYPO3\Flow\var_dump($this->googleAnalyticsFactory->getGaDataByDestinationPage('phlu.ch.phlu-eduweb5.nine.ch','/studium.html'));

    }

    /**
     * Proceed index asynchronous
     *
     * This command proceeds index queue
     *
     * @return void
     */
    public function proceedCommand()
    {

        $this->searchIndexFactory->proceedQueue();

    }

    /**
     * Update firebase rules once a night for better performance
     *
     * This command updates firebase rules and index
     *
     * @return void
     */
    public function updateRulesCommand()
    {

        $this->searchIndexFactory->updateFireBaseRules();

    }


}
