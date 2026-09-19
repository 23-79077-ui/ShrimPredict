<?php
/**
 * Configuration for Multimodal Vision Model APIs
 * Supports Google Gemini 1.5 Flash and OpenAI GPT-4o-mini
 */

// 1. Check environment variable
$geminiKey = getenv('GEMINI_API_KEY');
$openaiKey = getenv('OPENAI_API_KEY');

// 2. Check root .env or backend .env if not found in environment
$envPaths = [
    __DIR__ . '/../../.env',
    __DIR__ . '/../.env',
    __DIR__ . '/.env'
];

foreach ($envPaths as $path) {
    if (file_exists($path)) {
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || $line[0] === '#') continue;
            if (strpos($line, 'GEMINI_API_KEY=') === 0 && empty($geminiKey)) {
                $geminiKey = trim(substr($line, 15), "\"' ");
            }
            if (strpos($line, 'OPENAI_API_KEY=') === 0 && empty($openaiKey)) {
                $openaiKey = trim(substr($line, 15), "\"' ");
            }
        }
    }
}

if (!defined('GEMINI_API_KEY')) {
    define('GEMINI_API_KEY', $geminiKey ?: '');
}

if (!defined('OPENAI_API_KEY')) {
    define('OPENAI_API_KEY', $openaiKey ?: '');
}
