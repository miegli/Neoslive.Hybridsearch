<?php
namespace Neoslive\Hybridsearch\Domain\Repository;

/*
 * This file is part of the TYPO3.TYPO3CR package.
 *
 * (c) Contributors of the Neos Project - www.neos.io
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */

use Doctrine\ORM\QueryBuilder;
use TYPO3\Flow\Annotations as Flow;
use TYPO3\TYPO3CR\Domain\Model\NodeData;
use TYPO3\TYPO3CR\Domain\Model\Workspace;
use TYPO3\TYPO3CR\Domain\Repository\NodeDataRepository;

/**
 * A purely internal repository for NodeData storage
 *
 * DO NOT USE outside the TYPO3CR package!
 *
 * The ContextFactory can be used to create a Context that allows to find Node instances that act as the
 * public API to the TYPO3CR.
 *
 * @Flow\Scope("singleton")
 */
class NeosliveHybridsearchNodeDataRepository extends NodeDataRepository
{


    /**
     * Initializes a new Repository.
     */
    public function __construct()
    {
        $this->entityClassName = 'TYPO3\TYPO3CR\Domain\NodeData';
    }


    /**
     * Find all NodeData objects inside a given workspace sorted by path to be used
     * in publishing. The order makes sure that parent nodes are published first.
     *
     * Shadow nodes are excluded, because they will be published when publishing the moved node.
     *
     * @param Workspace $workspace
     * @param \DateTime $lastModificationDateTime
     * @return array<NodeData>
     */
    public function findByWorkspaceAndLastModificationDateTimeDate(Workspace $workspace, \DateTime $lastModificationDateTime)
    {
        /** @var QueryBuilder $queryBuilder */
        $queryBuilder = $this->entityManager->createQueryBuilder();


        $queryBuilder->select('n')
            ->from(NodeData::class, 'n')
            ->where('n.workspace = :workspace')
            ->andWhere('(n.movedTo IS NULL OR n.removed = :removed) AND n.lastModificationDateTime >= \''.$lastModificationDateTime->format("Y-m-d H:i:s").'\'')
            ->orderBy('n.lastModificationDateTime', 'DESC')
            ->setParameter('workspace', $workspace)
            ->setParameter('removed', false, \PDO::PARAM_BOOL);

        return $queryBuilder->getQuery()->getResult();
    }


}
