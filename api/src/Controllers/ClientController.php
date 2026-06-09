<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class ClientController
{
    private \PDO $pdo;

    public function __construct(\PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function list(Request $request, Response $response): Response
    {
        $stmt = $this->pdo->query("SELECT * FROM clients ORDER BY created_at DESC");
        return $this->json($response, $stmt->fetchAll());
    }

    public function get(Request $request, Response $response, array $args): Response
    {
        $stmt = $this->pdo->prepare("SELECT * FROM clients WHERE id = ?");
        $stmt->execute([$args['id']]);
        $client = $stmt->fetch();
        if (!$client) {
            return $this->json($response, ['error' => 'not found'], 404);
        }

        return $this->json($response, $client);
    }

    public function create(Request $request, Response $response): Response
    {
        $userId = $request->getAttribute('user_id');
        $body = $request->getParsedBody();

        $name = trim($body['name'] ?? '');
        if ($name === '') {
            return $this->json($response, ['error' => 'name is required'], 400);
        }

        $clientCode = $body['client_code'] ?? null;
        if ($clientCode !== null && $clientCode !== '') {
            $stmt = $this->pdo->prepare("SELECT id FROM clients WHERE client_code = ?");
            $stmt->execute([$clientCode]);
            if ($stmt->fetch()) {
                return $this->json($response, ['error' => 'Код бүртгэлтэй байна'], 409);
            }
        }

        $stmt = $this->pdo->prepare("
            INSERT INTO clients (user_id, client_code, name, phone, owner_name, outdoor_photo, indoor_photo, district, subdistrict, neighborhood, building_door, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $userId,
            $clientCode ?: null,
            $name,
            $body['phone'] ?? null,
            $body['owner_name'] ?? null,
            $body['outdoor_photo'] ?? null,
            $body['indoor_photo'] ?? null,
            $body['district'] ?? null,
            $body['subdistrict'] ?? null,
            $body['neighborhood'] ?? null,
            $body['building_door'] ?? null,
            $body['status'] ?? null,
            date('Y-m-d H:i:s'),
        ]);

        $id = $this->pdo->lastInsertId();
        $stmt = $this->pdo->prepare("SELECT * FROM clients WHERE id = ?");
        $stmt->execute([$id]);

        return $this->json($response, $stmt->fetch(), 201);
    }

    public function update(Request $request, Response $response, array $args): Response
    {
        $body = $request->getParsedBody();

        $stmt = $this->pdo->prepare("SELECT id FROM clients WHERE id = ?");
        $stmt->execute([$args['id']]);

        if (!$stmt->fetch()) {
            return $this->json($response, ['error' => 'not found'], 404);
        }

        $fields = ['name', 'phone', 'owner_name', 'outdoor_photo', 'indoor_photo', 'district', 'subdistrict', 'neighborhood', 'building_door', 'status', 'client_code'];
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

        if (array_key_exists('client_code', $body) && $body['client_code'] !== null && $body['client_code'] !== '') {
            $stmt = $this->pdo->prepare("SELECT id FROM clients WHERE client_code = ? AND id != ?");
            $stmt->execute([$body['client_code'], $args['id']]);
            if ($stmt->fetch()) {
                return $this->json($response, ['error' => 'Код бүртгэлтэй байна'], 409);
            }
        }

        $set[] = "updated_at = ?";
        $params[] = date('Y-m-d H:i:s');
        $params[] = $args['id'];

        $this->pdo->prepare("UPDATE clients SET " . implode(', ', $set) . " WHERE id = ?")->execute($params);

        $stmt = $this->pdo->prepare("SELECT * FROM clients WHERE id = ?");
        $stmt->execute([$args['id']]);

        return $this->json($response, $stmt->fetch());
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $stmt = $this->pdo->prepare("SELECT id FROM clients WHERE id = ?");
        $stmt->execute([$args['id']]);

        if (!$stmt->fetch()) {
            return $this->json($response, ['error' => 'not found'], 404);
        }

        $this->pdo->prepare("DELETE FROM clients WHERE id = ?")->execute([$args['id']]);
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
