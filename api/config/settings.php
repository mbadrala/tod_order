<?php

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

return [
    'jwt_secret' => $_ENV['JWT_SECRET'],
    'db_path' => __DIR__ . '/../' . $_ENV['DB_PATH'],
    'upload_dir' => __DIR__ . '/../' . $_ENV['UPLOAD_DIR'],
];
