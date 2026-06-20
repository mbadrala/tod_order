<?php

date_default_timezone_set('Asia/Ulaanbaatar');

use App\Controllers\AuthController;
use App\Controllers\BankAccountController;
use App\Controllers\ClientController;
use App\Controllers\FileController;
use App\Controllers\ProductController;
use App\Controllers\ReportController;
use App\Controllers\SaleController;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;
use Slim\Routing\RouteCollectorProxy;
use Slim\Psr7\Response as SlimResponse;

require __DIR__ . '/../vendor/autoload.php';

$config = require __DIR__ . '/../config/settings.php';
require __DIR__ . '/../config/database.php';

$pdo = getDatabase($config['db_path']);
initializeDatabase($pdo);
seedAdmin($pdo);
seedSuperAdmin($pdo);

$app = AppFactory::create();

$allowedOrigins = $config['cors_allowed_origins'];

$app->add(function (Request $request, $handler) use ($allowedOrigins) {
    if ($request->getMethod() === 'OPTIONS') {
        $origin = $request->getHeaderLine('Origin');
        $allowOrigin = in_array($origin, $allowedOrigins, true) ? $origin : '';
        $response = new SlimResponse();
        if ($allowOrigin) {
            $response = $response->withHeader('Access-Control-Allow-Origin', $allowOrigin);
        }
        return $response
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            ->withStatus(204);
    }
    return $handler->handle($request);
});

$app->add(function (Request $request, $handler) use ($allowedOrigins) {
    $origin = $request->getHeaderLine('Origin');
    $allowOrigin = in_array($origin, $allowedOrigins, true) ? $origin : '';
    $response = $handler->handle($request);
    if ($allowOrigin) {
        $response = $response->withHeader('Access-Control-Allow-Origin', $allowOrigin);
    }
    return $response->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
});

$app->addBodyParsingMiddleware();
$app->addErrorMiddleware(true, true, true);

// Request logging middleware
$logDir = dirname($config['upload_dir']) . '/logs';
if (!is_dir($logDir)) mkdir($logDir, 0755, true);
$app->add(function (Request $request, $handler) use ($logDir) {
    $start = microtime(true);
    $response = $handler->handle($request);
    $duration = round((microtime(true) - $start) * 1000);
    $status = $response->getStatusCode();
    $method = $request->getMethod();
    $path = $request->getUri()->getPath();
    $qs = $request->getUri()->getQuery();
    $user = '-';
    $authHeader = $request->getHeaderLine('Authorization');
    if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
        $parts = explode('.', $m[1]);
        if (count($parts) === 3) {
            $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
            if ($payload && isset($payload['username'])) {
                $user = $payload['username'];
            }
        }
    }
    $logFile = "$logDir/app-" . date('Y-m-d') . '.log';
    $entry = json_encode([
        'ts' => date('Y-m-d H:i:s'),
        'user' => $user,
        'method' => $method,
        'path' => $path,
        'query' => $qs,
        'status' => $status,
        'ms' => $duration,
    ], JSON_UNESCAPED_UNICODE);
    file_put_contents($logFile, $entry . PHP_EOL, FILE_APPEND | LOCK_EX);
    foreach (glob("$logDir/app-*.log") ?: [] as $f) {
        $basename = basename($f);
        if (preg_match('/^app-(\d{4}-\d{2}-\d{2})\.log$/', $basename, $m)) {
            if (strtotime($m[1]) < strtotime('-7 days')) unlink($f);
        }
    }
    return $response;
});

$authController = new AuthController($pdo, $config['jwt_secret']);

$app->post('/auth/login', [$authController, 'login']);

$app->group('/auth', function (RouteCollectorProxy $group) use ($authController) {
    $group->get('/me', [$authController, 'me']);
    $group->post('/register', [$authController, 'register']);
    $group->get('/users', [$authController, 'listUsers']);
    $group->put('/users/{id}', [$authController, 'updateUser']);
    $group->delete('/users/{id}', [$authController, 'deleteUser']);
})->add(new AuthMiddleware($config['jwt_secret'], $pdo));

$clientController = new ClientController($pdo);

$app->get('/clients/all', [$clientController, 'listAll'])->add(new AuthMiddleware($config['jwt_secret'], $pdo));

$app->group('/clients', function (RouteCollectorProxy $group) use ($clientController) {
    $group->get('', [$clientController, 'list']);
    $group->post('', [$clientController, 'create']);
    $group->get('/{id}', [$clientController, 'get']);
    $group->put('/{id}', [$clientController, 'update']);
    $group->delete('/{id}', [$clientController, 'delete']);
})->add(new PermissionMiddleware('clients'))->add(new AuthMiddleware($config['jwt_secret'], $pdo));

$productController = new ProductController($pdo);

$app->get('/products/all', [$productController, 'listAll'])->add(new AuthMiddleware($config['jwt_secret'], $pdo));

$app->group('/products', function (RouteCollectorProxy $group) use ($productController) {
    $group->get('', [$productController, 'list']);
    $group->get('/{id}', [$productController, 'get']);
    $group->post('', [$productController, 'create']);
    $group->put('/{id}', [$productController, 'update']);
    $group->delete('/{id}', [$productController, 'delete']);
})->add(new PermissionMiddleware('products'))->add(new AuthMiddleware($config['jwt_secret'], $pdo));

$fileController = new FileController($pdo, $config['upload_dir']);

$app->group('/files', function (RouteCollectorProxy $group) use ($fileController) {
    $group->post('/upload', [$fileController, 'upload']);
    $group->get('/{id}', [$fileController, 'get']);
    $group->delete('/{id}', [$fileController, 'delete']);
})->add(new AuthMiddleware($config['jwt_secret'], $pdo));

$saleController = new SaleController($pdo);

$app->group('/sales', function (RouteCollectorProxy $group) use ($saleController) {
    $group->get('/admin-summary', [$saleController, 'listSummary']);
    $group->get('/admin-summary/all', [$saleController, 'summaryAll']);
    $group->get('/admin-summary/pdf', [$saleController, 'summaryPdf']);
    $group->get('', [$saleController, 'list']);
    $group->post('', [$saleController, 'create']);
    $group->get('/report', [$saleController, 'report']);
    $group->get('/report/pdf', [$saleController, 'reportPdf']);
    $group->get('/{id}', [$saleController, 'get']);
    $group->put('/{id}', [$saleController, 'update']);
    $group->delete('/{id}', [$saleController, 'delete']);
    $group->post('/{id}/lock', [$saleController, 'toggleLock']);
})->add(new PermissionMiddleware('sales'))->add(new AuthMiddleware($config['jwt_secret'], $pdo));

$bankAccountController = new BankAccountController($pdo);

$app->group('/bank-accounts', function (RouteCollectorProxy $group) use ($bankAccountController) {
    $group->get('', [$bankAccountController, 'list']);
    $group->get('/{id}', [$bankAccountController, 'get']);
    $group->post('', [$bankAccountController, 'create']);
    $group->put('/{id}', [$bankAccountController, 'update']);
    $group->delete('/{id}', [$bankAccountController, 'delete']);
})->add(new AuthMiddleware($config['jwt_secret'], $pdo));

$reportController = new ReportController($pdo);

$app->group('/reports', function (RouteCollectorProxy $group) use ($reportController) {
    $group->get('/all', [$reportController, 'listAll']);
    $group->get('', [$reportController, 'list']);
    $group->delete('/{sale_id}', [$reportController, 'delete']);
})->add(new PermissionMiddleware('reports'))->add(new AuthMiddleware($config['jwt_secret'], $pdo));

// Include this before $app->run()
use App\Controllers\LogController;
$logController = new LogController($logDir);
$app->get('/logs', [$logController, 'list'])->add(new AuthMiddleware($config['jwt_secret'], $pdo));

$app->run();
