<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class BankAccountController
{
    private \PDO $pdo;

    public function __construct(\PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function list(Request $request, Response $response): Response
    {
        $stmt = $this->pdo->query("SELECT * FROM bank_accounts ORDER BY bank_name");
        return $this->json($response, $stmt->fetchAll());
    }

    public function get(Request $request, Response $response, array $args): Response
    {
        $stmt = $this->pdo->prepare("SELECT * FROM bank_accounts WHERE id = ?");
        $stmt->execute([$args['id']]);
        $account = $stmt->fetch();

        if (!$account) {
            return $this->json($response, ['error' => 'not found'], 404);
        }

        return $this->json($response, $account);
    }

    public function create(Request $request, Response $response): Response
    {
        if (!$request->getAttribute('is_admin')) {
            return $this->json($response, ['error' => 'admin only'], 403);
        }

        $body = $request->getParsedBody();
        $bankName = trim($body['bank_name'] ?? '');
        $accountNumber = trim($body['account_number'] ?? '');

        if ($bankName === '' || $accountNumber === '') {
            return $this->json($response, ['error' => 'bank name and account number are required'], 400);
        }

        $stmt = $this->pdo->prepare("INSERT INTO bank_accounts (bank_name, account_number) VALUES (?, ?)");
        $stmt->execute([$bankName, $accountNumber]);

        $id = $this->pdo->lastInsertId();
        $stmt = $this->pdo->prepare("SELECT * FROM bank_accounts WHERE id = ?");
        $stmt->execute([$id]);

        return $this->json($response, $stmt->fetch(), 201);
    }

    public function update(Request $request, Response $response, array $args): Response
    {
        if (!$request->getAttribute('is_admin')) {
            return $this->json($response, ['error' => 'admin only'], 403);
        }

        $stmt = $this->pdo->prepare("SELECT id FROM bank_accounts WHERE id = ?");
        $stmt->execute([$args['id']]);
        if (!$stmt->fetch()) {
            return $this->json($response, ['error' => 'not found'], 404);
        }

        $body = $request->getParsedBody();
        $fields = ['bank_name', 'account_number'];
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

        $set[] = "updated_at = datetime('now')";
        $params[] = $args['id'];

        $this->pdo->prepare("UPDATE bank_accounts SET " . implode(', ', $set) . " WHERE id = ?")->execute($params);

        $stmt = $this->pdo->prepare("SELECT * FROM bank_accounts WHERE id = ?");
        $stmt->execute([$args['id']]);

        return $this->json($response, $stmt->fetch());
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        if (!$request->getAttribute('is_admin')) {
            return $this->json($response, ['error' => 'admin only'], 403);
        }

        $stmt = $this->pdo->prepare("SELECT id FROM bank_accounts WHERE id = ?");
        $stmt->execute([$args['id']]);
        if (!$stmt->fetch()) {
            return $this->json($response, ['error' => 'not found'], 404);
        }

        $this->pdo->prepare("DELETE FROM bank_accounts WHERE id = ?")->execute([$args['id']]);
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
