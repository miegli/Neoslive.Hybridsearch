<?php
namespace Neoslive\Hybridsearch\Factory;

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

class GoogleAnalyticsFactory
{


    /**
     * @Flow\InjectConfiguration(package="Neoslive.Hybridsearch")
     * @var array
     */
    protected $settings;


    /**
     * @var \Google_Client
     */
    protected $google_client;


    /**
     * @var array
     */
    protected $gaData;


    /**
     * Inject the settings
     *
     * @param array $settings
     * @return void
     */
    protected function injectSettings(array $settings)
    {

        $this->settings = $settings;

        if (isset($settings['Google']['AuthJsonFile']) && is_file($settings['Google']['AuthJsonFile'])) {

            $config = json_decode(file_get_contents($settings['Google']['AuthJsonFile']), true);

            $this->google_client = new \Google_Client();
            $this->google_client->setAuthConfig($config);
            $this->google_client->setScopes(['https://www.googleapis.com/auth/analytics.readonly']);

            if (isset($settings['Google']['Analytics']['reports'])) {
                foreach ($settings['Google']['Analytics']['reports'] as $host => $reportId) {
                    $this->fetchGaData($host, $reportId);
                }
            }
        }


    }


    /**
     * Fetchs google analytics data
     * @param string host
     * @param integer reportId
     * @return void
     */
    protected function fetchGaData($host, $reportId)
    {

        $analytics = new \Google_Service_Analytics($this->google_client);

        $optParams = array(
            'dimensions' => 'ga:keyword,ga:searchDestinationPage,ga:userGender,ga:userAgeBracket',
            'sort' => '-ga:searchDestinationPage',
            'filters' => 'ga:timeOnPage>450',
            'max-results' => '20000'
        );

        foreach ($analytics->data_ga->get(
            'ga:' . $reportId,
            '30daysAgo',
            'today',
            'ga:users',
            $optParams)->getRows() as $row) {

            if (isset($this->gaData[$host][$row[1]]) === false) {
                $this->gaData[$host][$row[1]] = array(
                    'userGender' => array(),
                    'userAgeBracket' => array(),
                    'keywords' => '');
            }


            // keywords
            if (isset($this->gaData[$host][$row[1]]['keywords'][$row[0]]) === false) {
                $this->gaData[$host][$row[1]]['keywords'][$row[0]] = 0;
            }

            $this->gaData[$host][$row[1]]['keywords'][$row[0]]++;

            // gender
            if (isset($this->gaData[$host][$row[1]]['userGender'][$row[2]]) === false) {
                $this->gaData[$host][$row[1]]['userGender'][$row[2]] = 0;
            }

            $this->gaData[$host][$row[1]]['userGender'][$row[2]]++;

            // age
            if (isset($this->gaData[$host][$row[1]]['userAgeBracket'][$row[3]]) === false) {
                $this->gaData[$host][$row[1]]['userAgeBracket'][$row[3]] = 0;
            }
            $this->gaData[$host][$row[1]]['userAgeBracket'][$row[3]]++;


        };


        // get most frequencies
        foreach ($this->gaData[$host] as $path => &$data) {

            // most frequent users gender
            arsort($data['userGender']);
            $data['userGender'] = key($data['userGender']);

            // most frequent users age
            arsort($data['userAgeBracket']);
            $data['userAgeBracket'] = key($data['userAgeBracket']);

            // most frequent keywords
            arsort($data['keywords']);
            $data['keywords'] = key(array_slice($data['keywords'], 0, 1)) . " " . key(array_slice($data['keywords'], 1, 1)) . " " . key(array_slice($data['keywords'], 2, 1));

        }


    }


    /**
     * get google analytics data by node
     *
     * @param string $host
     * @param string $page (relative path of page)
     * @return array
     */
    public function getGaDataByDestinationPage($host, $page)
    {

        $data = array(
            'userGender' => '',
            'userAgeBracket' => '',
            'keywords' => ''
        );


        if (isset($this->gaData[$host][$page])) {
            $data['userGender'] = $this->gaData[$host][$page]['userGender'];
            $data['userAgeBracket'] = $this->gaData[$host][$page]['userAgeBracket'];
            $data['keywords'] = $this->gaData[$host][$page]['keywords'];
        }

        return $data;

    }


}
