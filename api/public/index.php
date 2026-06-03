<?php

use App\Controllers\AuthController;
use App\Controllers\ClientController;
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

$app->post('/auth/register', [$authController, 'register']);
$app->post('/auth/login', [$authController, 'login']);

$clientController = new ClientController($pdo);

$app->group('/clients', function (RouteCollectorProxy $group) use ($clientController) {
    $group->get('', [$clientController, 'list']);
    $group->post('', [$clientController, 'create']);
    $group->get('/{id}', [$clientController, 'get']);
    $group->put('/{id}', [$clientController, 'update']);
    $group->delete('/{id}', [$clientController, 'delete']);
})->add(new AuthMiddleware($config['jwt_secret']));

$app->group('/files', function (RouteCollectorProxy $group) {
    $group->get('', function (Request $request, Response $response) {
        $response->getBody()->write(json_encode(['message' => 'not implemented yet']));
        return $response->withHeader('Content-Type', 'application/json');
    });

    $group->post('/upload', function (Request $request, Response $response) {
        $response->getBody()->write(json_encode(['message' => 'not implemented yet']));
        return $response->withHeader('Content-Type', 'application/json');
    });

    $group->get('/{id}', function (Request $request, Response $response, array $args) {
        $response->getBody()->write(json_encode(['message' => 'not implemented yet']));
        return $response->withHeader('Content-Type', 'application/json');
    });

    $group->delete('/{id}', function (Request $request, Response $response, array $args) {
        $response->getBody()->write(json_encode(['message' => 'not implemented yet']));
        return $response->withHeader('Content-Type', 'application/json');
    });
})->add(new AuthMiddleware($config['jwt_secret']));

$app->run();
