<?php
namespace Neoslive\Hybridsearch;

/*
 * This file is part of the Neoslive.Hybridsearch package.
 *
 * (c) Contributors to the package
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */

use TYPO3\Flow\Core\Bootstrap;
use TYPO3\Flow\Package\Package as BasePackage;
use Neoslive\Hybridsearch\Factory\SearchIndexFactory;
use TYPO3\Neos\Service\PublishingService;
use TYPO3\TYPO3CR\Domain\Model\Node;

/**
 * The Neoslive hybridsearch package
 */
class Package extends BasePackage
{



    /**
     * @param Bootstrap $bootstrap The current bootstrap
     * @return void
     */
    public function boot(Bootstrap $bootstrap)
    {


        $dispatcher = $bootstrap->getSignalSlotDispatcher();
       // $dispatcher->connect(PublishingService::class, 'nodePublished', SearchIndexFactory::class, 'checkIndexRealtimeForRemovingNode');

    }

}
