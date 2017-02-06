<?php
namespace Neoslive\Hybridsearch\View;

/*
 * This file is part of the Neoslive.Hybridsearch package.
 *
 * (c) Contributors to the package
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */


use Neos\Flow\Annotations as Flow;
use Neos\Neos\View\TypoScriptView;


class HybridSearchTypoScriptView extends TypoScriptView
{

    /**
     * @return mixed
     */
    public function getVariables()
    {
        return isset($this->variables) ? $this->variables : null;
    }




}