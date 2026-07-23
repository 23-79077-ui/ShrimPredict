<?php
function ensureJsonStore($path) {
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    return $path;
}

function loadJson($path, $default = []) {
    ensureJsonStore($path);
    if (!file_exists($path)) {
        file_put_contents($path, json_encode($default, JSON_PRETTY_PRINT));
        return $default;
    }

    $data = json_decode(file_get_contents($path), true);
    return $data ?? $default;
}

function saveJson($path, $data) {
    ensureJsonStore($path);
    file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT));
    return true;
}
