<?php
namespace Neoslive\Hybridsearch\Queue;


use Flowpack\JobQueue\Common\Queue\FakeQueue;
use TYPO3\Flow\Annotations as Flow;
use TYPO3\Flow\Core\Booting\Scripts;
use TYPO3\Flow\Utility\Algorithms;
use Flowpack\JobQueue\Common\Queue\Message;

class SearchIndexQueue extends FakeQueue
{

    /**
     * @var bool
     */
    protected $async = true;


    /**
     * @inheritdoc
     */
    public function submit($payload, array $options = [])
    {
        $messageId = Algorithms::generateUUID();
        $message = new Message($messageId, $payload);
        $commandArguments = [$this->name, base64_encode(serialize($message))];
        if ($this->async) {
            if (!method_exists(Scripts::class, 'executeCommandAsync')) {
                throw new \RuntimeException('The "async" flag is set, but the currently used Flow version doesn\'t support this (Flow 3.3+ is required)', 1469116604);
            }
            Scripts::executeCommandAsync('flowpack.jobqueue.common:job:execute', $this->flowSettings, $commandArguments);
        } else {
            Scripts::executeCommand('flowpack.jobqueue.common:job:execute', $this->flowSettings, true, $commandArguments);
        }
        return $messageId;
    }

    /**
     * @inheritdoc
     */
    public function waitAndTake($timeout = null)
    {
       // throw new \BadMethodCallException('The FakeQueue does not support reserving of messages.' . chr(10) . 'It is not required to use a worker for this queue as messages are handled immediately upon submission.', 1468425275);
    }

    /**
     * @inheritdoc
     */
    public function waitAndReserve($timeout = null)
    {
       // throw new \BadMethodCallException('The FakeQueue does not support reserving of messages.' . chr(10) . 'It is not required to use a worker for this queue as messages are handled immediately upon submission.', 1468425280);
    }

    /**
     * @inheritdoc
     */
    public function release($messageId, array $options = [])
    {
       // throw new \BadMethodCallException('The FakeQueue does not support releasing of failed messages.' . chr(10) . 'The "maximumNumberOfReleases" setting should be removed or set to 0 for this queue!', 1468425285);
    }

    /**
     * @inheritdoc
     */
    public function abort($messageId)
    {
        // The FakeQueue does not support message abortion
    }

    /**
     * @inheritdoc
     */
    public function finish($messageId)
    {
        // The FakeQueue does not support message finishing
    }

    /**
     * @inheritdoc
     */
    public function peek($limit = 1)
    {
        return [];
    }

    /**
     * @inheritdoc
     */
    public function count()
    {
        return 0;
    }

    /**
     * @inheritdoc
     */
    public function flush()
    {
        //
    }

}