<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class SaleController
{
    private \PDO $pdo;

    public function __construct(\PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function list(Request $request, Response $response): Response
    {
        $stmt = $this->pdo->query("SELECT * FROM sales ORDER BY sale_date DESC, id DESC");
        $sales = $stmt->fetchAll();

        if (!empty($sales)) {
            $ids = array_column($sales, 'id');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $this->pdo->prepare("SELECT * FROM sale_items WHERE sale_id IN ($placeholders) ORDER BY id");
            $stmt->execute($ids);
            $allItems = $stmt->fetchAll();

            $itemsBySale = [];
            foreach ($allItems as $item) {
                $itemsBySale[$item['sale_id']][] = $item;
            }

            foreach ($sales as &$sale) {
                $sale['items'] = $itemsBySale[$sale['id']] ?? [];
            }
            unset($sale);
        }

        return $this->json($response, $sales);
    }

    public function get(Request $request, Response $response, array $args): Response
    {
        $stmt = $this->pdo->prepare("SELECT * FROM sales WHERE id = ?");
        $stmt->execute([$args['id']]);
        $sale = $stmt->fetch();

        if (!$sale) {
            return $this->json($response, ['error' => 'not found'], 404);
        }

        $stmt = $this->pdo->prepare("SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id");
        $stmt->execute([$args['id']]);
        $sale['items'] = $stmt->fetchAll();

        return $this->json($response, $sale);
    }

    public function create(Request $request, Response $response): Response
    {
        $userId = $request->getAttribute('user_id');
        $body = $request->getParsedBody();

        $saleDate = $body['sale_date'] ?? date('Y-m-d');
        $clientCode = $body['client_code'] ?? null;
        $clientName = $body['client_name'] ?? null;
        $clientPhone = $body['client_phone'] ?? null;
        $slipNumber = trim($body['slip_number'] ?? '');
        $status = $body['status'] ?? 'final';
        $items = $body['items'] ?? [];

        if ($slipNumber === '') {
            return $this->json($response, ['error' => 'slip number is required'], 400);
        }

        if (!is_array($items) || empty($items)) {
            return $this->json($response, ['error' => 'at least one item is required'], 400);
        }

        $totalAmount = 0;
        foreach ($items as &$item) {
            $item['amount'] = (float)($item['amount'] ?? 1);
            $item['unit_price'] = (float)($item['unit_price'] ?? 0);
            $item['sum_price'] = $item['amount'] * $item['unit_price'];
            $totalAmount += $item['sum_price'];
        }
        unset($item);

        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO sales (sale_date, client_code, client_name, client_phone, slip_number, status, total_amount, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$saleDate, $clientCode, $clientName, $clientPhone, $slipNumber, $status, $totalAmount, $userId]);
            $saleId = $this->pdo->lastInsertId();

            $stmt = $this->pdo->prepare("
                INSERT INTO sale_items (sale_id, product_code, product_name, amount, unit_price, sum_price)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            foreach ($items as $item) {
                $stmt->execute([
                    $saleId,
                    $item['product_code'] ?? '',
                    $item['product_name'] ?? '',
                    $item['amount'],
                    $item['unit_price'],
                    $item['sum_price'],
                ]);
            }

            $this->pdo->commit();

            $stmt = $this->pdo->prepare("SELECT * FROM sales WHERE id = ?");
            $stmt->execute([$saleId]);
            $sale = $stmt->fetch();

            $stmt = $this->pdo->prepare("SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id");
            $stmt->execute([$saleId]);
            $sale['items'] = $stmt->fetchAll();

            return $this->json($response, $sale, 201);
        } catch (\Exception $e) {
            $this->pdo->rollBack();
            return $this->json($response, ['error' => 'create failed'], 500);
        }
    }

    public function update(Request $request, Response $response, array $args): Response
    {
        $body = $request->getParsedBody();

        $stmt = $this->pdo->prepare("SELECT id, user_id FROM sales WHERE id = ?");
        $stmt->execute([$args['id']]);
        $sale = $stmt->fetch();
        if (!$sale) {
            return $this->json($response, ['error' => 'not found'], 404);
        }

        $isAdmin = $request->getAttribute('is_admin');
        $userId = $request->getAttribute('user_id');
        if (!$isAdmin && (int)$sale['user_id'] !== (int)$userId) {
            return $this->json($response, ['error' => 'Та зөвхөн өөрийн үүсгэсэн борлуулалтыг засах боломжтой'], 403);
        }

        $fields = ['sale_date', 'client_code', 'client_name', 'client_phone', 'slip_number', 'status'];
        $set = [];
        $params = [];

        foreach ($fields as $f) {
            if (array_key_exists($f, $body)) {
                $set[] = "$f = ?";
                $params[] = $body[$f];
            }
        }

        $items = $body['items'] ?? null;
        if ($items !== null) {
            if (!is_array($items) || empty($items)) {
                return $this->json($response, ['error' => 'at least one item is required'], 400);
            }

            $totalAmount = 0;
            foreach ($items as &$item) {
                $item['amount'] = (float)($item['amount'] ?? 1);
                $item['unit_price'] = (float)($item['unit_price'] ?? 0);
                $item['sum_price'] = $item['amount'] * $item['unit_price'];
                $totalAmount += $item['sum_price'];
            }
            unset($item);

            $set[] = "total_amount = ?";
            $params[] = $totalAmount;

            $this->pdo->beginTransaction();
            try {
                $this->pdo->prepare("DELETE FROM sale_items WHERE sale_id = ?")->execute([$args['id']]);

                $stmtItem = $this->pdo->prepare("
                    INSERT INTO sale_items (sale_id, product_code, product_name, amount, unit_price, sum_price)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                foreach ($items as $item) {
                    $stmtItem->execute([
                        $args['id'],
                        $item['product_code'] ?? '',
                        $item['product_name'] ?? '',
                        $item['amount'],
                        $item['unit_price'],
                        $item['sum_price'],
                    ]);
                }
            } catch (\Exception $e) {
                $this->pdo->rollBack();
                return $this->json($response, ['error' => 'update failed'], 500);
            }
        }

        if (!empty($set)) {
            $set[] = "updated_at = datetime('now')";
            $params[] = $args['id'];
            $this->pdo->prepare("UPDATE sales SET " . implode(', ', $set) . " WHERE id = ?")->execute($params);
        }

        if ($items !== null) {
            $this->pdo->commit();
        }

        $stmt = $this->pdo->prepare("SELECT * FROM sales WHERE id = ?");
        $stmt->execute([$args['id']]);
        $sale = $stmt->fetch();

        $stmt = $this->pdo->prepare("SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id");
        $stmt->execute([$args['id']]);
        $sale['items'] = $stmt->fetchAll();

        return $this->json($response, $sale);
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        if (!$request->getAttribute('is_admin')) {
            return $this->json($response, ['error' => 'Зөвхөн админ борлуулалт устгах боломжтой'], 403);
        }

        $stmt = $this->pdo->prepare("SELECT id FROM sales WHERE id = ?");
        $stmt->execute([$args['id']]);
        if (!$stmt->fetch()) {
            return $this->json($response, ['error' => 'not found'], 404);
        }

        $this->pdo->prepare("DELETE FROM sale_items WHERE sale_id = ?")->execute([$args['id']]);
        $this->pdo->prepare("DELETE FROM sales WHERE id = ?")->execute([$args['id']]);

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
