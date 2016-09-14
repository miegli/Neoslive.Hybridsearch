<?php
namespace Neoslive\Hybridsearch;

use TYPO3\Flow\Package\Package as BasePackage;

/**
 * The Neoslive.Hybridsearch Package
 *
 */
class Package extends BasePackage {

    /**
     * Invokes custom PHP code directly after the package manager has been initialized.
     *
     * @param \TYPO3\Flow\Core\Bootstrap $bootstrap The current bootstrap
     * @return void
     */
    public function boot(\TYPO3\Flow\Core\Bootstrap $bootstrap) {
     echo 3;exit;
        $dispatcher = $bootstrap->getSignalSlotDispatcher();
        $dispatcher->connect('TYPO3\Flow\Mvc\Dispatcher', 'afterControllerInvocation', 'Acme\Demo\Baz', 'fooBar');
    }
}
?>