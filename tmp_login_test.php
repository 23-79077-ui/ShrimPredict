<?php
$data = json_encode(['email' => 'admin@shrimpredict.com', 'password' => 'admin123']);
$context = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/json',
        'content' => $data,
    ],
]);
$result = file_get_contents('http://127.0.0.1:8000/api/login.php', false, $context);
echo $result;
