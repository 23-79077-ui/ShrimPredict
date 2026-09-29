<?php
/**
 * ShrimPredict - External API & Local Tunnel Configuration
 * 
 * Use this file to manage external service URLs (such as local Flask APIs tunneled via ngrok).
 * Update $NGROK_BASE_URL whenever your ngrok tunnel session restarts.
 */

// =========================================================================
// NGROK / FLASK TUNNEL URL CONFIGURATION
// Replace the URL below with your active ngrok URL (e.g. https://xxxx-xx-xx.ngrok-free.app)
// =========================================================================
$NGROK_BASE_URL = 'https://enjoyable-caterer-deputy.ngrok-free.dev';

// Sanitize URL (remove trailing slashes)
$NGROK_BASE_URL = rtrim(trim($NGROK_BASE_URL), '/');

// Define Constants & Global Variables for Flask Endpoints
if (!defined('FLASK_BASE_URL')) {
    define('FLASK_BASE_URL', !empty($NGROK_BASE_URL) ? $NGROK_BASE_URL : 'http://127.0.0.1:5001');
}

if (!defined('FLASK_SHRIMP_COUNT_URL')) {
    define('FLASK_SHRIMP_COUNT_URL', FLASK_BASE_URL . '/count');
}

// Global variable fallbacks
$FLASK_URL = FLASK_SHRIMP_COUNT_URL;
$FLASK_SHRIMP_COUNT_URL = FLASK_SHRIMP_COUNT_URL;
