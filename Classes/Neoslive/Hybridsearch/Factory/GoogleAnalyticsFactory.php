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
         * get trendings
         */
        $result = $analytics->data_ga->get(
            'ga:' . $reportId,
            '30daysAgo',
            'today',
            'ga:users',
            array(
                'dimensions' => 'ga:searchDestinationPage,ga:hour',
                'filters' => 'ga:timeOnPage>60',
                'samplingLevel' => 'higher_precision',
                'max-results' => '2000000'
            ));


        if ($result->getTotalResults() > 0) {
            $columns = $result->getColumnHeaders();


            $columnMapping = array();
            foreach ($columns as $k => $column) {
                $columnMapping[$column['name']] = $k;
            }

            foreach ($result->getRows() as $row) {

                if (isset($this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]) === false) {
                    $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]] = array(
                        'userGender' => array(),
                        'userAgeBracket' => array(),
                        'trendingHour' => array(),
                        'trendingRating' => 0,
                        'keywords' => '');
                }

                /*
                 * Get trendings by hour
                 */
                if (isset($this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['trendingHour'][$row[$columnMapping['ga:hour']]]) === false) {
                    $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['trendingHour'][$row[$columnMapping['ga:hour']]] = 0;
                }
                $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['trendingHour'][$row[$columnMapping['ga:hour']]] = $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['trendingHour'][$row[$columnMapping['ga:hour']]] + 1;


                /*
                 * Get trendings overall
                 */
                if (isset($this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['trendingRating']) === false) {
                    $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['trendingRating'] = 0;
                }
                $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['trendingRating'] = $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['trendingRating'] + $row[$columnMapping['ga:users']];


            }
        }


        /**
         * get keywords
         */
        $result = $analytics->data_ga->get(
            'ga:' . $reportId,
            '30daysAgo',
            'today',
            'ga:users',
            array(
                'dimensions' => 'ga:keyword,ga:searchDestinationPage',
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
                if (isset($this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]) === false) {
                    $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]] = array(
                        'userGender' => array(),
                        'userAgeBracket' => array(),
                        'trendingRating' => array(),
                        'keywords' => '');
                }
                // keywords
                if ($row[$columnMapping['ga:keyword']] != '(not set)' && $row[$columnMapping['ga:keyword']] != '(not provided)') {
                    if (isset($this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['keywords'][$row[$columnMapping['ga:keyword']]]) === false) {
                        $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['keywords'][$row[$columnMapping['ga:keyword']]] = 0;
                    }
                    $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['keywords'][$row[$columnMapping['ga:keyword']]] = $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['keywords'][$row[$columnMapping['ga:keyword']]] + 1;
                }

            }

        }

        /**
         * get user gender and age
         */
        $result = $analytics->data_ga->get(
            'ga:' . $reportId,
            '7daysAgo',
            'today',
            'ga:users',
            array(
                'dimensions' => 'ga:userAgeBracket,ga:userGender,ga:searchDestinationPage',
                'filters' => 'ga:timeOnPage>1',
                'samplingLevel' => 'higher_precision',
                'max-results' => '2000000'
            ));
        if ($result->getTotalResults() > 0) {
            $columns = $result->getColumnHeaders();

            $columnMapping = array();
            foreach ($columns as $k => $column) {
                $columnMapping[$column['name']] = $k;
            }

            foreach ($result->getRows() as $row) {

                if (isset($this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]) === false) {
                    $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]] = array(
                        'userGender' => array(),
                        'userAgeBracket' => array(),
                        'trendingRating' => array(),
                        'keywords' => '');
                }


                // gender
                if (isset($this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['userGender'][$row[$columnMapping['ga:userGender']]]) === false) {
                    $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['userGender'][$row[$columnMapping['ga:userGender']]] = 0;
                }
                $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['userGender'][$row[$columnMapping['ga:userGender']]] = $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['userGender'][$row[$columnMapping['ga:userGender']]] + $row[$columnMapping['ga:users']];

                // age
                if (isset($this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['userAgeBracket'][$row[$columnMapping['ga:userAgeBracket']]]) === false) {
                    $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['userAgeBracket'][$row[$columnMapping['ga:userAgeBracket']]] = 0;
                }
                $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['userAgeBracket'][$row[$columnMapping['ga:userAgeBracket']]] = $this->gaData[$host][$row[$columnMapping['ga:searchDestinationPage']]]['userAgeBracket'][$row[$columnMapping['ga:userAgeBracket']]] + $row[$columnMapping['ga:users']];


            }
        }

        if (count($this->gaData)) {

            /**
             * pre-calculate frequencies
             */
            $trendingcount = array();
            foreach ($this->gaData[$host] as $path => $data) {
                $trendingcount[$path] = $data['trendingRating'];
            }
            arsort($trendingcount);
            $c = 0;
            $a = count($trendingcount);
            foreach ($trendingcount as $key => &$val) {
                $c++;
                if ($c < $a / 10) {
                    $val = "trendingRatingA";
                } else if ($c < $a / 10 * 5) {
                    $val = "trendingRatingB";
                } else {
                    $val = "trendingRatingC";
                }
            }


            /**
             * calculate frequencies
             */
            foreach ($this->gaData[$host] as $path => &$data) {

                // most frequent users gender
                if (isset($data['userGender']) && is_array($data['userGender'])) {
                    arsort($data['userGender']);
                    $data['userGender'] = (string)key($data['userGender']);
                }

                // most frequent users age
                if (isset($data['userAgeBracket']) && is_array($data['userAgeBracket'])) {
                    arsort($data['userAgeBracket']);
                    $data['userAgeBracket'] = (string)key($data['userAgeBracket']);
                }

                // most trending hour
                if (isset($data['trendingHour']) && is_array($data['trendingHour'])) {
                    arsort($data['trendingHour']);
                    $data['trendingHour'] = (string)key($data['trendingHour']);
                }

                // trending raating
                $data['trendingRating'] = (string)$trendingcount[$path];

                // most frequent keywords
                if (isset($data['keywords']) && is_array($data['keywords'])) {
                    arsort($data['keywords']);
                    $data['keywords'] = (string)key(array_slice($data['keywords'], 0, 1)) . " " . (string)key(array_slice($data['keywords'], 1, 1)) . " " . (string)key(array_slice($data['keywords'], 2, 1));
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
            'userGender' => '',
            'userAgeBracket' => '',
            'trendingRating' => '',
            'trendingHour' => '',
            'keywords' => '',
            'path' => $host . $page
        );


        if (isset($this->gaData[$host][$page])) {

            if (isset($this->gaData[$host][$page]['userGender'])) {
                $data['userGender'] = isset($this->gaDataMappings['userGender'][$this->gaData[$host][$page]['userGender']]) ? $this->gaDataMappings['userGender'][$this->gaData[$host][$page]['userGender']] : $this->gaData[$host][$page]['userGender'];
            }

            if (isset($this->gaData[$host][$page]['userAgeBracket'])) {
                $data['userAgeBracket'] = isset($this->gaDataMappings['userAgeBracket'][$this->gaData[$host][$page]['userAgeBracket']]) ? $this->gaDataMappings['userAgeBracket'][$this->gaData[$host][$page]['userAgeBracket']] : $this->gaData[$host][$page]['userAgeBracket'];
            }

            if (isset($this->gaData[$host][$page]['trendingHour'])) {
                $data['trendingHour'] = isset($this->gaDataMappings['trendingHour'][$this->gaData[$host][$page]['trendingHour']]) ? $this->gaDataMappings['trendingHour'][$this->gaData[$host][$page]['trendingHour']] : $this->gaData[$host][$page]['trendingHour'];
            }

            if (isset($this->gaData[$host][$page]['trendingRating'])) {
                $data['trendingRating'] = isset($this->gaData[$host][$page]['trendingRating']) ? $this->gaData[$host][$page]['trendingRating'] : $this->gaData[$host][$page]['trendingRating'];
            }

            if (isset($this->gaData[$host][$page]['keywords'])) {
                $data['keywords'] = $this->gaData[$host][$page]['keywords'];
            }
        }

        return $data;

    }


}
