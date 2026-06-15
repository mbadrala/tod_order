<?php

namespace App\Middleware;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Slim\Psr7\Response as SlimResponse;

class AuthMiddleware implements MiddlewareInterface
{
    private string $secret;
    private ?\PDO $pdo;

    public function __construct(string $secret, ?\PDO $pdo = null)
    {
        $this->secret = $secret;
        $this->pdo = $pdo;
    }

    public function process(Request $request, RequestHandler $handler): Response
    {
        $header = $request->getHeaderLine('Authorization');
        $queryToken = $request->getQueryParams()['token'] ?? null;

        if ($header && str_starts_with($header, 'Bearer ')) {
            $token = substr($header, 7);
        } elseif ($queryToken) {
            $token = $queryToken;
        } else {
            return $this->unauthorized('Missing or malformed token');
        }

        try {
            $decoded = JWT::decode($token, new Key($this->secret, 'HS256'));
            $request = $request
                ->withAttribute('user_id', $decoded->user_id)
                ->withAttribute('is_admin', $decoded->is_admin ?? false);

            // Fetch permissions fresh from DB so changes take effect immediately
            $permissions = ["sales","reports","clients","products"];
            if ($this->pdo) {
                $stmt = $this->pdo->prepare("SELECT permissions FROM users WHERE id = ?");
                $stmt->execute([$decoded->user_id]);
                $user = $stmt->fetch();
                if (!$user) {
                    return $this->unauthorized('User not found');
                }
                if ($user['permissions'] !== null) {
                    $permissions = json_decode($user['permissions'], true) ?? [];
                }
            }
            $request = $request->withAttribute('permissions', $permissions);
        } catch (\Exception $e) {
            return $this->unauthorized('Invalid or expired token');
        }

        return $handler->handle($request);
    }

    private function unauthorized(string $message): Response
    {
        $response = new SlimResponse();
        $response->getBody()->write(json_encode(['error' => $message]));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus(401);
    }
}
