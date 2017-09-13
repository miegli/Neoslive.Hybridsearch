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

use Neos\Flow\Annotations as Flow;

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
     * @var boolean
     */
    protected $gaDataLoaded = false;

    /**
     * @var array
     */
    protected $gaDataMappings;


    /**
     * Loads gadata in memory
     *
     * @return void
     */
    protected function load()
    {


        $this->gaDataMappings['userGender']['male'] = 'userGenderMale';
        $this->gaDataMappings['userGender']['female'] = 'userGenderfeMale';
        $this->gaDataMappings['userAgeBracket']['18-24'] = 'userAgeBracket18';
        $this->gaDataMappings['userAgeBracket']['25-34'] = 'userAgeBracket25';
        $this->gaDataMappings['userAgeBracket']['35-44'] = 'userAgeBracket35';
        $this->gaDataMappings['userAgeBracket']['45-54'] = 'userAgeBracket45';
        $this->gaDataMappings['userAgeBracket']['55-64'] = 'userAgeBracket55';
        $this->gaDataMappings['userAgeBracket']['65+'] = 'userAgeBracket65';

        $this->gaDataMappings['trendingHour']['01'] = 'trendingHour1';
        $this->gaDataMappings['trendingHour']['02'] = 'trendingHour2';
        $this->gaDataMappings['trendingHour']['03'] = 'trendingHour3';
        $this->gaDataMappings['trendingHour']['04'] = 'trendingHour4';
        $this->gaDataMappings['trendingHour']['05'] = 'trendingHour5';
        $this->gaDataMappings['trendingHour']['06'] = 'trendingHour6';
        $this->gaDataMappings['trendingHour']['07'] = 'trendingHour7';
        $this->gaDataMappings['trendingHour']['08'] = 'trendingHour8';
        $this->gaDataMappings['trendingHour']['09'] = 'trendingHour9';
        $this->gaDataMappings['trendingHour']['10'] = 'trendingHour10';
        $this->gaDataMappings['trendingHour']['11'] = 'trendingHour11';
        $this->gaDataMappings['trendingHour']['12'] = 'trendingHour12';
        $this->gaDataMappings['trendingHour']['13'] = 'trendingHour13';
        $this->gaDataMappings['trendingHour']['14'] = 'trendingHour14';
        $this->gaDataMappings['trendingHour']['15'] = 'trendingHour15';
        $this->gaDataMappings['trendingHour']['16'] = 'trendingHour16';
        $this->gaDataMappings['trendingHour']['17'] = 'trendingHour17';
        $this->gaDataMappings['trendingHour']['18'] = 'trendingHour18';
        $this->gaDataMappings['trendingHour']['19'] = 'trendingHour19';
        $this->gaDataMappings['trendingHour']['20'] = 'trendingHour20';
        $this->gaDataMappings['trendingHour']['21'] = 'trendingHour21';
        $this->gaDataMappings['trendingHour']['22'] = 'trendingHour22';
        $this->gaDataMappings['trendingHour']['23'] = 'trendingHour23';
        $this->gaDataMappings['trendingHour']['24'] = 'trendingHour24';


        if (isset($this->settings['Google']['AuthJsonFile']) && is_file($this->settings['Google']['AuthJsonFile'])) {

            $config = json_decode(file_get_contents($this->settings['Google']['AuthJsonFile']), true);

            $this->google_client = new \Google_Client();
            $this->google_client->setAuthConfig($config);
            $this->google_client->setScopes(['https://www.googleapis.com/auth/analytics.readonly']);


            if (isset($this->settings['Google']['Analytics']['Reports'])) {

                foreach ($this->settings['Google']['Analytics']['Reports'] as $host => $reportId) {
                    $this->fetchGaData($host, $reportId);
                }
            }
        }

        $this->gaDataLoaded = true;


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

        /**
         * get keywords
         */
        $result = $analytics->data_ga->get(
            'ga:' . $reportId,
            '7daysAgo',
            'today',
            'ga:totalEvents',
            array(
                'dimensions' => 'ga:eventLabel,ga:eventAction',
                'samplingLevel' => 'higher_precision',
                'max-results' => '999999'
            ));
        if ($result->getTotalResults() > 0) {
            $columns = $result->getColumnHeaders();


            $columnMapping = array();
            foreach ($columns as $k => $column) {
                $columnMapping[$column['name']] = $k;
            }


            foreach ($result->getRows() as $row) {


                // keywords
                if ($row[$columnMapping['ga:eventAction']] != '.' && $row[$columnMapping['ga:eventLabel']] !== '(not set)') {
                    $pa = parse_url($row[$columnMapping['ga:eventLabel']]);

                    if (isset($pa['path']) && strlen($pa['path']) > 3) {

                        if (isset($this->gaData[$host][$row[$columnMapping['ga:eventLabel']]]) === false) {
                            $this->gaData[$host][$row[$columnMapping['ga:eventLabel']]] = array(
                                'keywords' => '');
                        }

                        if (isset($this->gaData[$host][$pa['path']]['keywords'][$row[$columnMapping['ga:eventAction']]]) === false) {
                            $this->gaData[$host][$pa['path']]['keywords'][$row[$columnMapping['ga:eventAction']]] = 0;
                        }
                        $this->gaData[$host][$pa['path']]['keywords'][$row[$columnMapping['ga:eventAction']]] = $this->gaData[$host][$pa['path']]['keywords'][$row[$columnMapping['ga:eventAction']]] + 1;

                    }

                }

            }

        }


        if (count($this->gaData)) {

            /**
             * calculate frequencies
             */
            foreach ($this->gaData[$host] as $path => &$data) {
                //implode keywords
                if (isset($data['keywords']) && is_array($data['keywords'])) {
                    $data['keywords'] = implode(", ", array_keys($data['keywords']));
                }
            }
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


        if ($this->gaDataLoaded === false && count($this->gaData) === 0) {
            $this->load();
        }

        $data = array(
            'keywords' => '',
            'path' => $host . $page
        );

        \Neos\Flow\var_dump($this->gaData);
        \Neos\Flow\var_dump($host);
        \Neos\Flow\var_dump($page);
        exit;

        if (isset($this->gaData[$host]) && isset($this->gaData[$host][$page])) {

            if (isset($this->gaData[$host][$page]['keywords'])) {
                $data['keywords'] = $this->gaData[$host][$page]['keywords'];
            }
        }

        return $data;

    }


}
