<?php
namespace Neoslive\Hybridsearch\Request;

/*
 * This file is part of the Neoslive.Hybridsearch package.
 *
 * (c) Contributors to the package
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */


use TYPO3\Flow\Annotations as Flow;
use TYPO3\Flow\Http\HttpRequestHandlerInterface;


class HttpRequestHandler implements HttpRequestHandlerInterface
{


    /**
     * @var \TYPO3\Flow\Http\Request
     */
    protected $request;

    /**
     * @param \TYPO3\Flow\Http\Request $request
     */
    public function __construct(\TYPO3\Flow\Http\Request $request)
    {
        $this->request = $request;

    }

    /**
     * This request handler can handle any web request.
     *
     * @return boolean If the request is a web request, TRUE otherwise FALSE
     * @api
     */
    public function canHandleRequest()
    {
        return true;
    }

    /**
     * Returns the priority - how eager the handler is to actually handle the
     * request.
     *
     * @return integer The priority of the request handler.
     * @api
     */
    public function getPriority()
    {
        return 100;
    }


    /**
     * Handles a HTTP request
     *
     * @return void
     */
    public function handleRequest()
    {

    }

    /**
     * Returns the currently handled HTTP request
     *
     * @return Request
     * @api
     */
    public function getHttpRequest()
    {



        return $this->request;
    }

    /**
     *
     * @return mixed
     * @api
     */
    public function getHttpResponse()
    {
        return null;
    }



}