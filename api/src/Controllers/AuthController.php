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
        if (!$request->getAttribute('is_admin')) {
            return $this->json($response, ['error' => 'admin only'], 403);
        }

        $body = $request->getParsedBody();
        $name = trim($body['name'] ?? '');
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';
        $permissions = $body['permissions'] ?? null;
        $bankAccountIds = $body['bank_account_ids'] ?? null;

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
        $permsJson = $permissions !== null ? json_encode($permissions) : '["sales","reports","clients","products"]';
        $bankJson = $bankAccountIds !== null ? json_encode($bankAccountIds) : '[]';
        $stmt = $this->pdo->prepare(
            "INSERT INTO users (name, username, password_hash, permissions, bank_account_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([$name, $username, $hash, $permsJson, $bankJson, date('Y-m-d H:i:s')]);

        $userId = $this->pdo->lastInsertId();

        return $this->json($response, [
            'message' => 'User created',
            'user' => ['id' => (int)$userId, 'name' => $name, 'username' => $username, 'permissions' => json_decode($permsJson), 'bank_account_ids' => json_decode($bankJson)],
        ], 201);
    }

    public function listUsers(Request $request, Response $response): Response
    {
        $stmt = $this->pdo->query("SELECT id, name, username, is_admin, permissions, bank_account_ids, created_at, updated_at FROM users WHERE (is_superadmin IS NULL OR is_superadmin = 0) ORDER BY id");
        $users = $stmt->fetchAll();
        foreach ($users as &$u) {
            $u['permissions'] = $u['permissions'] ? json_decode($u['permissions']) : ["sales","reports","clients","products"];
            $u['bank_account_ids'] = $u['bank_account_ids'] ? json_decode($u['bank_account_ids']) : [];
        }
        unset($u);
        return $this->json($response, $users);
    }

    public function updateUser(Request $request, Response $response, array $args): Response
    {
        $isAdmin = $request->getAttribute('is_admin');
        $userId = $request->getAttribute('user_id');

        if (!$isAdmin && (int)$args['id'] !== (int)$userId) {
            return $this->json($response, ['error' => 'admin only'], 403);
        }

        $stmt = $this->pdo->prepare("SELECT id, is_superadmin FROM users WHERE id = ?");
        $stmt->execute([$args['id']]);
        $target = $stmt->fetch();
        if (!$target) {
            return $this->json($response, ['error' => 'user not found'], 404);
        }
        if ($target['is_superadmin']) {
            return $this->json($response, ['error' => 'cannot update superadmin'], 403);
        }

        $body = $request->getParsedBody();
        $fields = ['name', 'username'];
        $set = [];
        $params = [];

        foreach ($fields as $f) {
            if (array_key_exists($f, $body)) {
                $set[] = "$f = ?";
                $params[] = $body[$f];
            }
        }

        if (array_key_exists('permissions', $body)) {
            $set[] = "permissions = ?";
            $params[] = json_encode($body['permissions']);
        }

        if (array_key_exists('bank_account_ids', $body)) {
            $set[] = "bank_account_ids = ?";
            $params[] = json_encode($body['bank_account_ids']);
        }

        if (!empty($body['password'])) {
            if (strlen($body['password']) < 6) {
                return $this->json($response, ['error' => 'password must be at least 6 characters'], 400);
            }
            $set[] = "password_hash = ?";
            $params[] = password_hash($body['password'], PASSWORD_BCRYPT);
        }

        if (empty($set)) {
            return $this->json($response, ['error' => 'no fields to update'], 400);
        }

        $set[] = "updated_at = ?";
        $params[] = date('Y-m-d H:i:s');
        $params[] = $args['id'];

        $this->pdo->prepare("UPDATE users SET " . implode(', ', $set) . " WHERE id = ?")->execute($params);

        $stmt = $this->pdo->query("SELECT id, name, username, is_admin, permissions, bank_account_ids, created_at, updated_at FROM users WHERE id = {$args['id']}");
        $u = $stmt->fetch();
        $u['permissions'] = $u['permissions'] ? json_decode($u['permissions']) : ["sales","reports","clients","products"];
        $u['bank_account_ids'] = $u['bank_account_ids'] ? json_decode($u['bank_account_ids']) : [];
        return $this->json($response, $u);
    }

    public function deleteUser(Request $request, Response $response, array $args): Response
    {
        if (!$request->getAttribute('is_admin')) {
            return $this->json($response, ['error' => 'admin only'], 403);
        }

        $stmt = $this->pdo->prepare("SELECT id, is_admin, is_superadmin FROM users WHERE id = ?");
        $stmt->execute([$args['id']]);
        $user = $stmt->fetch();

        if (!$user) {
            return $this->json($response, ['error' => 'user not found'], 404);
        }

        if ($user['is_admin'] || $user['is_superadmin']) {
            return $this->json($response, ['error' => 'cannot delete admin'], 403);
        }

        $this->pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$args['id']]);
        return $this->json($response, ['message' => 'deleted']);
    }

    public function me(Request $request, Response $response): Response
    {
        $userId = $request->getAttribute('user_id');
        $stmt = $this->pdo->prepare("SELECT id, name, username, is_admin, is_superadmin, permissions, bank_account_ids FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if (!$user) {
            return $this->json($response, ['error' => 'not found'], 404);
        }
        $perms = $user['permissions'] ? json_decode($user['permissions']) : ["sales","reports","clients","products"];
        $bankIds = $user['bank_account_ids'] ? json_decode($user['bank_account_ids']) : [];
        return $this->json($response, [
            'id' => (int)$user['id'],
            'name' => $user['name'],
            'username' => $user['username'],
            'is_admin' => (bool)$user['is_admin'],
            'is_superadmin' => (bool)$user['is_superadmin'],
            'permissions' => $perms,
            'bank_account_ids' => $bankIds,
        ]);
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

        $token = $this->generateToken($user['id'], (bool)$user['is_admin'], $user['username'], (bool)($user['is_superadmin'] ?? false));

        $perms = $user['permissions'] ? json_decode($user['permissions']) : ["sales","reports","clients","products"];
        $bankIds = $user['bank_account_ids'] ? json_decode($user['bank_account_ids']) : [];

        return $this->json($response, [
            'token' => $token,
            'user' => [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'username' => $user['username'],
                'is_admin' => (bool)$user['is_admin'],
                'is_superadmin' => (bool)($user['is_superadmin'] ?? false),
                'permissions' => $perms,
                'bank_account_ids' => $bankIds,
            ],
        ]);
    }

    private function generateToken(int $userId, bool $isAdmin, string $username, bool $isSuperadmin = false): string
    {
        $payload = [
            'user_id' => $userId,
            'is_admin' => $isAdmin,
            'is_superadmin' => $isSuperadmin,
            'username' => $username,
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
