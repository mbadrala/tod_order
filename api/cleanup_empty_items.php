<?php

require __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

$config = require __DIR__ . '/config/settings.php';
require __DIR__ . '/config/database.php';

$pdo = getDatabase($config['db_path']);

$stmt = $pdo->prepare("DELETE FROM sale_items WHERE product_code IS NULL OR product_code = ''");
$stmt->execute();

echo "Устгагдсан: " . $stmt->rowCount() . " хоосон мөр(үүд)\n";
