<?php

namespace App\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Slim\Psr7\Response as SlimResponse;

class PermissionMiddleware implements MiddlewareInterface
{
    private string $permission;

    public function __construct(string $permission)
    {
        $this->permission = $permission;
    }

    public function process(Request $request, RequestHandler $handler): Response
    {
        if ($request->getAttribute('is_admin')) {
            return $handler->handle($request);
        }

        $permissions = $request->getAttribute('permissions') ?? [];
        if (!in_array($this->permission, $permissions)) {
            $response = new SlimResponse();
            $response->getBody()->write(json_encode(['error' => 'no permission']));
            return $response
                ->withHeader('Content-Type', 'application/json')
                ->withStatus(403);
        }

        return $handler->handle($request);
    }
}
