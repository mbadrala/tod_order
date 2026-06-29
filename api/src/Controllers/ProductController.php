<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class ProductController
{
    private \PDO $pdo;

    public function __construct(\PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function list(Request $request, Response $response): Response
    {
        $params = $request->getQueryParams();
        $code = trim($params['code'] ?? '');
        $name = trim($params['name'] ?? '');
        $page = max(1, (int)($params['page'] ?? 1));
        $perPage = max(1, min(200, (int)($params['per_page'] ?? 50)));

        $conditions = [];
        $binds = [];
        if ($code !== '') {
            $conditions[] = "like_ci(?, code)";
            $binds[] = "%$code%";
        }
        if ($name !== '') {
            $conditions[] = "like_ci(?, name)";
            $binds[] = "%$name%";
        }

        $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM products $where");
        $countStmt->execute($binds);
        $total = (int)$countStmt->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $dataStmt = $this->pdo->prepare("SELECT * FROM products $where ORDER BY name LIMIT ? OFFSET ?");
        $execBinds = $binds;
        $execBinds[] = $perPage;
        $execBinds[] = $offset;
        $dataStmt->execute($execBinds);

        return $this->json($response, [
            'data' => $dataStmt->fetchAll(),
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
        ]);
    }

    public function listAll(Request $request, Response $response): Response
    {
        $params = $request->getQueryParams();
        $code = trim($params['code'] ?? '');
        $name = trim($params['name'] ?? '');

        $conditions = [];
        $binds = [];
        if ($code !== '') {
            $conditions[] = "like_ci(?, code)";
            $binds[] = "%$code%";
        }
        if ($name !== '') {
            $conditions[] = "like_ci(?, name)";
            $binds[] = "%$name%";
        }

        $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
        $binds[] = 100000;
        $stmt = $this->pdo->prepare("SELECT * FROM products $where ORDER BY name LIMIT ?");
        $stmt->execute($binds);
        return $this->json($response, $stmt->fetchAll());
    }

    public function get(Request $request, Response $response, array $args): Response
    {
        $stmt = $this->pdo->prepare("SELECT * FROM products WHERE id = ?");
        $stmt->execute([$args['id']]);
        $product = $stmt->fetch();

        if (!$product) {
            return $this->json($response, ['error' => 'not found'], 404);
        }

        return $this->json($response, $product);
    }

    public function create(Request $request, Response $response): Response
    {
        if (!$request->getAttribute('is_admin')) {
            return $this->json($response, ['error' => 'admin only'], 403);
        }

        $body = $request->getParsedBody();
        $code = trim($body['code'] ?? '');
        $name = trim($body['name'] ?? '');

        if ($code === '' || $name === '') {
            return $this->json($response, ['error' => 'code and name are required'], 400);
        }

        $stmt = $this->pdo->prepare("SELECT id FROM products WHERE code = ?");
        $stmt->execute([$code]);
        if ($stmt->fetch()) {
            return $this->json($response, ['error' => 'code already exists'], 409);
        }

        $stmt = $this->pdo->prepare("INSERT INTO products (code, name, created_at) VALUES (?, ?, ?)");
        $stmt->execute([$code, $name, date('Y-m-d H:i:s')]);

        $id = $this->pdo->lastInsertId();
        $stmt = $this->pdo->prepare("SELECT * FROM products WHERE id = ?");
        $stmt->execute([$id]);

        return $this->json($response, $stmt->fetch(), 201);
    }

    public function update(Request $request, Response $response, array $args): Response
    {
        if (!$request->getAttribute('is_admin')) {
            return $this->json($response, ['error' => 'admin only'], 403);
        }

        $stmt = $this->pdo->prepare("SELECT id FROM products WHERE id = ?");
        $stmt->execute([$args['id']]);
        if (!$stmt->fetch()) {
            return $this->json($response, ['error' => 'not found'], 404);
        }

        $body = $request->getParsedBody();
        $fields = ['code', 'name'];
        $set = [];
        $params = [];

        foreach ($fields as $f) {
            if (array_key_exists($f, $body)) {
                $set[] = "$f = ?";
                $params[] = $body[$f];
            }
        }

        if (empty($set)) {
            return $this->json($response, ['error' => 'no fields to update'], 400);
        }

        if (array_key_exists('code', $body)) {
            $stmt = $this->pdo->prepare("SELECT id FROM products WHERE code = ? AND id != ?");
            $stmt->execute([$body['code'], $args['id']]);
            if ($stmt->fetch()) {
                return $this->json($response, ['error' => 'code already exists'], 409);
            }
        }

        $set[] = "updated_at = ?";
        $params[] = date('Y-m-d H:i:s');
        $params[] = $args['id'];

        $this->pdo->prepare("UPDATE products SET " . implode(', ', $set) . " WHERE id = ?")->execute($params);

        $stmt = $this->pdo->prepare("SELECT * FROM products WHERE id = ?");
        $stmt->execute([$args['id']]);

        return $this->json($response, $stmt->fetch());
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        if (!$request->getAttribute('is_admin')) {
            return $this->json($response, ['error' => 'admin only'], 403);
        }

        $stmt = $this->pdo->prepare("SELECT id FROM products WHERE id = ?");
        $stmt->execute([$args['id']]);
        if (!$stmt->fetch()) {
            return $this->json($response, ['error' => 'not found'], 404);
        }

        $this->pdo->prepare("DELETE FROM products WHERE id = ?")->execute([$args['id']]);
        return $this->json($response, ['message' => 'deleted']);
    }

    private function json(Response $response, array $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }
}
