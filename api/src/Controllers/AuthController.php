<?php

namespace App\Controllers;

use Firebase\JWT\JWT;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class AuthController
{
    private \PDO $pdo;
    private string $secret;

    public function __construct(\PDO $pdo, string $secret)
    {
        $this->pdo = $pdo;
        $this->secret = $secret;
    }

    public function register(Request $request, Response $response): Response
    {
        $body = $request->getParsedBody();
        $name = trim($body['name'] ?? '');
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';

        if ($name === '' || $username === '' || $password === '') {
            return $this->json($response, ['error' => 'name, username, and password are required'], 400);
        }

        if (strlen($password) < 6) {
            return $this->json($response, ['error' => 'password must be at least 6 characters'], 400);
        }

        $stmt = $this->pdo->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            return $this->json($response, ['error' => 'username already exists'], 409);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $this->pdo->prepare(
            "INSERT INTO users (name, username, password_hash) VALUES (?, ?, ?)"
        );
        $stmt->execute([$name, $username, $hash]);

        $userId = $this->pdo->lastInsertId();
        $token = $this->generateToken($userId, false);

        return $this->json($response, [
            'message' => 'User created',
            'token' => $token,
            'user' => ['id' => (int)$userId, 'name' => $name, 'username' => $username],
        ], 201);
    }

    public function login(Request $request, Response $response): Response
    {
        $body = $request->getParsedBody();
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';

        if ($username === '' || $password === '') {
            return $this->json($response, ['error' => 'username and password are required'], 400);
        }

        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            return $this->json($response, ['error' => 'invalid credentials'], 401);
        }

        $token = $this->generateToken($user['id'], (bool)$user['is_admin']);

        return $this->json($response, [
            'token' => $token,
            'user' => [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'username' => $user['username'],
                'is_admin' => (bool)$user['is_admin'],
            ],
        ]);
    }

    private function generateToken(int $userId, bool $isAdmin): string
    {
        $payload = [
            'user_id' => $userId,
            'is_admin' => $isAdmin,
            'iat' => time(),
            'exp' => time() + 86400 * 7,
        ];
        return JWT::encode($payload, $this->secret, 'HS256');
    }

    private function json(Response $response, array $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }
}
