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
     * @var SiteRepository
     */
    protected $siteRepository;

    /**
     * Create full search index for given node path
     *
     * This command is used to create full search index.
     *
     * @param string $path Name of the root node
     * @param string $site Name of the site
     * @param string $workspacename Name of the workspace
     * @return void
     */
    public function createFullIndexCommand($path, $site, $workspacename)
    {


        $site = $this->siteRepository->findOneByNodeName($site);


        if ($site === null) {
            $this->outputLine('Error: No site for exporting found');
            $this->quit(1);
        }


        $this->searchIndexFactory->createFullIndex($path, $site, $workspacename);


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
