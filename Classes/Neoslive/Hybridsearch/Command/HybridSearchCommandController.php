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
use Neos\Flow\Annotations as Flow;
use Neos\Flow\Cli\CommandController;
use Neos\Neos\Domain\Repository\SiteRepository;
use Neos\Flow\Cli\ConsoleOutput;

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
     * @param string $workspace Name of the workspace
     * @param string $nodetype name of node type to index only
     * @param boolean $verbose show verbose informations
     * @return void
     */
    public function createFullIndexCommand($workspace = 'live', $nodetype = null, $verbose = false)
    {

        $this->searchIndexFactory->createFullIndex($workspace, $nodetype, $verbose);
        $this->searchIndexFactory->updateStaticCache();

    }

    /**
     * Create / update static cache given workspace name
     *
     * This command is used to create full search index.
     *
     * @return void
     */
    public function createCacheCommand()
    {

        $this->searchIndexFactory->updateStaticCache();

    }

    /**
     * Create / update algolia search index
     *
     * This command is used to create full search index for algolia.
     * @param string $workspace
     * @return void
     */
    public function createIndexAlgoliaCommand($workspace = 'live')
    {

        $this->searchIndexFactory->createIndexAlgolia($workspace);

    }

    /**
     * Synchronize indexes
     *
     * This command updates index from all local changes
     * @param string $workspace
     * @param string $nodetype name of node type to sync
     * @param string $node identifier of node type to sync
     * @param integer $timestamp timestamp of last modification to sync
     * @param string $nodesSerialized
     * @return void
     */
    public function syncCommand($workspace = 'live', $nodetype = null, $node = null, $timestamp = null, $nodesSerialized = null)
    {

        $this->searchIndexFactory->sync($workspace, $nodetype, $timestamp,$node, $nodesSerialized);
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


}
