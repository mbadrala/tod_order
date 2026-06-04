<?php

use App\Controllers\AuthController;
use App\Controllers\BankAccountController;
use App\Controllers\ClientController;
use App\Controllers\FileController;
use App\Controllers\ProductController;
use App\Controllers\SaleController;
use App\Middleware\AuthMiddleware;
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

$app = AppFactory::create();

$app->add(function (Request $request, $handler) {
    if ($request->getMethod() === 'OPTIONS') {
        $response = new SlimResponse();
        return $response
            ->withHeader('Access-Control-Allow-Origin', '*')
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            ->withStatus(204);
    }
    return $handler->handle($request);
});

$app->add(function (Request $request, $handler) {
    $response = $handler->handle($request);
    return $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
});

$app->addBodyParsingMiddleware();
$app->addErrorMiddleware(true, true, true);

$authController = new AuthController($pdo, $config['jwt_secret']);

$app->post('/auth/login', [$authController, 'login']);

$app->group('/auth', function (RouteCollectorProxy $group) use ($authController) {
    $group->post('/register', [$authController, 'register']);
    $group->get('/users', [$authController, 'listUsers']);
    $group->put('/users/{id}', [$authController, 'updateUser']);
    $group->delete('/users/{id}', [$authController, 'deleteUser']);
})->add(new AuthMiddleware($config['jwt_secret']));

$clientController = new ClientController($pdo);

$app->group('/clients', function (RouteCollectorProxy $group) use ($clientController) {
    $group->get('', [$clientController, 'list']);
    $group->post('', [$clientController, 'create']);
    $group->get('/{id}', [$clientController, 'get']);
    $group->put('/{id}', [$clientController, 'update']);
    $group->delete('/{id}', [$clientController, 'delete']);
})->add(new AuthMiddleware($config['jwt_secret']));

$productController = new ProductController($pdo);

$app->group('/products', function (RouteCollectorProxy $group) use ($productController) {
    $group->get('', [$productController, 'list']);
    $group->get('/{id}', [$productController, 'get']);
    $group->post('', [$productController, 'create']);
    $group->put('/{id}', [$productController, 'update']);
    $group->delete('/{id}', [$productController, 'delete']);
})->add(new AuthMiddleware($config['jwt_secret']));

$fileController = new FileController($pdo, $config['upload_dir']);

$app->group('/files', function (RouteCollectorProxy $group) use ($fileController) {
    $group->post('/upload', [$fileController, 'upload']);
    $group->get('/{id}', [$fileController, 'get']);
    $group->delete('/{id}', [$fileController, 'delete']);
})->add(new AuthMiddleware($config['jwt_secret']));

$saleController = new SaleController($pdo);

$app->group('/sales', function (RouteCollectorProxy $group) use ($saleController) {
    $group->get('', [$saleController, 'list']);
    $group->post('', [$saleController, 'create']);
    $group->get('/{id}', [$saleController, 'get']);
    $group->put('/{id}', [$saleController, 'update']);
    $group->delete('/{id}', [$saleController, 'delete']);
})->add(new AuthMiddleware($config['jwt_secret']));

$bankAccountController = new BankAccountController($pdo);

$app->group('/bank-accounts', function (RouteCollectorProxy $group) use ($bankAccountController) {
    $group->get('', [$bankAccountController, 'list']);
    $group->get('/{id}', [$bankAccountController, 'get']);
    $group->post('', [$bankAccountController, 'create']);
    $group->put('/{id}', [$bankAccountController, 'update']);
    $group->delete('/{id}', [$bankAccountController, 'delete']);
})->add(new AuthMiddleware($config['jwt_secret']));

$app->run();
