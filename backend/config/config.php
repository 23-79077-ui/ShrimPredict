<?php
/**
 * ShrimPredict - Flask AI API Configuration
 */

$FLASK_BASE_URL = getenv('SHRIMP_AI_BASE_URL')
    ?: (getenv('NGROK_BASE_URL') ?: 'http://127.0.0.1:5001');
$FLASK_BASE_URL = rtrim(trim($FLASK_BASE_URL), '/');
$NGROK_BASE_URL = $FLASK_BASE_URL;

// Define Constants & Global Variables for Flask Endpoints
if (!defined('FLASK_BASE_URL')) {
    define('FLASK_BASE_URL', $FLASK_BASE_URL);
}

if (!defined('FLASK_SHRIMP_COUNT_URL')) {
    define('FLASK_SHRIMP_COUNT_URL', getenv('SHRIMP_AI_COUNT_URL') ?: FLASK_BASE_URL . '/count');
}

if (!defined('FLASK_DISEASE_PREDICT_URL')) {
    define('FLASK_DISEASE_PREDICT_URL', getenv('SHRIMP_AI_API_URL') ?: FLASK_BASE_URL . '/predict');
}

if (!defined('FLASK_PREDICT_URL')) {
    define('FLASK_PREDICT_URL', FLASK_DISEASE_PREDICT_URL);
}

// Global variable fallbacks
$FLASK_URL = FLASK_SHRIMP_COUNT_URL;
$FLASK_SHRIMP_COUNT_URL = FLASK_SHRIMP_COUNT_URL;
$FLASK_DISEASE_PREDICT_URL = FLASK_DISEASE_PREDICT_URL;
$FLASK_PREDICT_URL = FLASK_PREDICT_URL;
