<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class ReportController
{
    private \PDO $pdo;

    public function __construct(\PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function list(Request $request, Response $response): Response
    {
        $isAdmin = $request->getAttribute('is_admin');
        $userId = $request->getAttribute('user_id');
        $params = $request->getQueryParams();

        // cleanup reports older than 90 days
        $this->pdo->exec("DELETE FROM report_bank_allocations WHERE report_id IN (SELECT id FROM reports WHERE created_at < datetime('now', '-90 days'))");
        $this->pdo->exec("DELETE FROM reports WHERE created_at < datetime('now', '-90 days')");

        $sql = "SELECT r.* FROM reports r WHERE 1=1";
        $binds = [];

        if (!$isAdmin) {
            $sql .= " AND r.user_id = ?";
            $binds[] = $userId;
        }

        $from = $params['from'] ?? '';
        $to = $params['to'] ?? '';
        $clientCode = $params['client_code'] ?? '';
        $productCode = $params['product_code'] ?? '';
        $productName = $params['product_name'] ?? '';
        $amountMin = $params['amount_min'] ?? '';
        $amountMax = $params['amount_max'] ?? '';
        $unitPriceMin = $params['unit_price_min'] ?? '';
        $unitPriceMax = $params['unit_price_max'] ?? '';
        $sumPriceMin = $params['sum_price_min'] ?? '';
        $sumPriceMax = $params['sum_price_max'] ?? '';
        $bankAccountId = $params['bank_account_id'] ?? '';
        $filterUserId = $params['user_id'] ?? '';

        if ($from !== '') {
            $sql .= " AND r.sale_date >= ?";
            $binds[] = $from;
        }
        if ($to !== '') {
            $sql .= " AND r.sale_date <= ?";
            $binds[] = $to;
        }
        if ($clientCode !== '') {
            $sql .= " AND r.client_code = ?";
            $binds[] = $clientCode;
        }
        if ($productCode !== '') {
            $sql .= " AND r.product_code LIKE ?";
            $binds[] = "%$productCode%";
        }
        if ($productName !== '') {
            $sql .= " AND r.product_name LIKE ?";
            $binds[] = "%$productName%";
        }
        if ($amountMin !== '') {
            $sql .= " AND r.item_amount >= ?";
            $binds[] = (float)$amountMin;
        }
        if ($amountMax !== '') {
            $sql .= " AND r.item_amount <= ?";
            $binds[] = (float)$amountMax;
        }
        if ($unitPriceMin !== '') {
            $sql .= " AND r.unit_price >= ?";
            $binds[] = (float)$unitPriceMin;
        }
        if ($unitPriceMax !== '') {
            $sql .= " AND r.unit_price <= ?";
            $binds[] = (float)$unitPriceMax;
        }
        if ($sumPriceMin !== '') {
            $sql .= " AND r.sum_price >= ?";
            $binds[] = (float)$sumPriceMin;
        }
        if ($sumPriceMax !== '') {
            $sql .= " AND r.sum_price <= ?";
            $binds[] = (float)$sumPriceMax;
        }
        if ($isAdmin && $filterUserId !== '') {
            $sql .= " AND r.user_id = ?";
            $binds[] = (int)$filterUserId;
        }
        if ($bankAccountId !== '') {
            $sql .= " AND r.id IN (SELECT report_id FROM report_bank_allocations WHERE bank_account_id = ?)";
            $binds[] = (int)$bankAccountId;
        }

        $sql .= " ORDER BY r.sale_date DESC, r.id DESC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($binds);
        $reports = $stmt->fetchAll();

        // attach bank allocations to each report row
        if (!empty($reports)) {
            $ids = array_column($reports, 'id');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $this->pdo->prepare("SELECT * FROM report_bank_allocations WHERE report_id IN ($placeholders) ORDER BY id");
            $stmt->execute($ids);
            $allAllocs = $stmt->fetchAll();
            $allocsByReport = [];
            foreach ($allAllocs as $a) {
                $allocsByReport[$a['report_id']][] = $a;
            }
            foreach ($reports as &$r) {
                $r['bank_allocations'] = $allocsByReport[$r['id']] ?? [];
            }
            unset($r);
        }

        return $this->json($response, $reports);
    }

    private function json(Response $response, array $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }
}
