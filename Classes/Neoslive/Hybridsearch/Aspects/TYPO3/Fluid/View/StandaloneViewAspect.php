<?php
namespace Neoslive\Hybridsearch\Aspects\TYPO3\Fluid\View;

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

/**
 * @Flow\Aspect
 */
class StandaloneViewAspect
{


    /**
     * @Flow\Around("method(TYPO3\Fluid\View\StandaloneView->getTemplatePathAndFilename())")
     * @return void
     */
    public function getTemplatePathAndFilename(JoinPointInterface $joinPoint)
    {

       $templatePathAndFilename = $joinPoint->getAdviceChain()->proceed($joinPoint);


        if (isset($GLOBALS["neoslive.hybridsearch.insyncmode"]) && $GLOBALS["neoslive.hybridsearch.insyncmode"] && is_file($templatePathAndFilename) === false) {
            $templatePathAndFilename = 'resource://Neoslive.Hybridsearch/Private/Templates/Fallback.html';
            $standaloneView = $joinPoint->getProxy();
            \Neos\Utility\ObjectAccess::setProperty($standaloneView, 'templatePathAndFilename', $templatePathAndFilename);
        }

        return $templatePathAndFilename;

    }


}
