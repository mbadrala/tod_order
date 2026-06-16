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
        $cutoff = date('Y-m-d H:i:s', strtotime('-90 days'));
        $stmt = $this->pdo->prepare("DELETE FROM report_bank_allocations WHERE report_id IN (SELECT id FROM reports WHERE created_at < ?)");
        $stmt->execute([$cutoff]);
        $stmt = $this->pdo->prepare("DELETE FROM reports WHERE created_at < ?");
        $stmt->execute([$cutoff]);

        $conditions = [];
        $binds = [];

        if (!$isAdmin) {
            $conditions[] = "r.user_id = ?";
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
        $page = max(1, (int)($params['page'] ?? 1));
        $perPage = max(1, min(500, (int)($params['per_page'] ?? 100)));

        if ($from !== '') {
            $conditions[] = "r.sale_date >= ?";
            $binds[] = $from;
        }
        if ($to !== '') {
            $conditions[] = "r.sale_date <= ?";
            $binds[] = $to;
        }
        if ($clientCode !== '') {
            $conditions[] = "r.client_code = ?";
            $binds[] = $clientCode;
        }
        if ($productCode !== '') {
            $conditions[] = "like_ci(?, r.product_code)";
            $binds[] = "%$productCode%";
        }
        if ($productName !== '') {
            $conditions[] = "like_ci(?, r.product_name)";
            $binds[] = "%$productName%";
        }
        if ($amountMin !== '') {
            $conditions[] = "r.item_amount >= ?";
            $binds[] = (float)$amountMin;
        }
        if ($amountMax !== '') {
            $conditions[] = "r.item_amount <= ?";
            $binds[] = (float)$amountMax;
        }
        if ($unitPriceMin !== '') {
            $conditions[] = "r.unit_price >= ?";
            $binds[] = (float)$unitPriceMin;
        }
        if ($unitPriceMax !== '') {
            $conditions[] = "r.unit_price <= ?";
            $binds[] = (float)$unitPriceMax;
        }
        if ($sumPriceMin !== '') {
            $conditions[] = "r.sum_price >= ?";
            $binds[] = (float)$sumPriceMin;
        }
        if ($sumPriceMax !== '') {
            $conditions[] = "r.sum_price <= ?";
            $binds[] = (float)$sumPriceMax;
        }
        if ($isAdmin && $filterUserId !== '') {
            $conditions[] = "r.user_id = ?";
            $binds[] = (int)$filterUserId;
        }
        if ($bankAccountId !== '') {
            $conditions[] = "r.id IN (SELECT report_id FROM report_bank_allocations WHERE bank_account_id = ?)";
            $binds[] = (int)$bankAccountId;
        }

        $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM reports r $where");
        $countStmt->execute($binds);
        $total = (int)$countStmt->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $sql = "SELECT r.*, COALESCE(s.is_locked, 0) AS is_locked FROM reports r LEFT JOIN sales s ON r.sale_id = s.id $where ORDER BY r.sale_date DESC, r.id DESC LIMIT ? OFFSET ?";
        $execBinds = $binds;
        $execBinds[] = $perPage;
        $execBinds[] = $offset;
        $dataStmt = $this->pdo->prepare($sql);
        $dataStmt->execute($execBinds);
        $reports = $dataStmt->fetchAll();

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

        return $this->json($response, [
            'data' => $reports,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
        ]);
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        if (!$request->getAttribute('is_admin')) {
            return $this->json($response, ['error' => 'Зөвхөн админ'], 403);
        }

        $saleId = $args['sale_id'];
        $this->pdo->prepare("DELETE FROM report_bank_allocations WHERE report_id IN (SELECT id FROM reports WHERE sale_id = ?)")->execute([$saleId]);
        $this->pdo->prepare("DELETE FROM reports WHERE sale_id = ?")->execute([$saleId]);

        return $this->json($response, ['message' => 'deleted']);
    }

    public function listAll(Request $request, Response $response): Response
    {
        $isAdmin = $request->getAttribute('is_admin');
        $userId = $request->getAttribute('user_id');
        $params = $request->getQueryParams();

        $conditions = [];
        $binds = [];

        if (!$isAdmin) {
            $conditions[] = "r.user_id = ?";
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
            $conditions[] = "r.sale_date >= ?";
            $binds[] = $from;
        }
        if ($to !== '') {
            $conditions[] = "r.sale_date <= ?";
            $binds[] = $to;
        }
        if ($clientCode !== '') {
            $conditions[] = "r.client_code = ?";
            $binds[] = $clientCode;
        }
        if ($productCode !== '') {
            $conditions[] = "like_ci(?, r.product_code)";
            $binds[] = "%$productCode%";
        }
        if ($productName !== '') {
            $conditions[] = "like_ci(?, r.product_name)";
            $binds[] = "%$productName%";
        }
        if ($amountMin !== '') {
            $conditions[] = "r.item_amount >= ?";
            $binds[] = (float)$amountMin;
        }
        if ($amountMax !== '') {
            $conditions[] = "r.item_amount <= ?";
            $binds[] = (float)$amountMax;
        }
        if ($unitPriceMin !== '') {
            $conditions[] = "r.unit_price >= ?";
            $binds[] = (float)$unitPriceMin;
        }
        if ($unitPriceMax !== '') {
            $conditions[] = "r.unit_price <= ?";
            $binds[] = (float)$unitPriceMax;
        }
        if ($sumPriceMin !== '') {
            $conditions[] = "r.sum_price >= ?";
            $binds[] = (float)$sumPriceMin;
        }
        if ($sumPriceMax !== '') {
            $conditions[] = "r.sum_price <= ?";
            $binds[] = (float)$sumPriceMax;
        }
        if ($isAdmin && $filterUserId !== '') {
            $conditions[] = "r.user_id = ?";
            $binds[] = (int)$filterUserId;
        }
        if ($bankAccountId !== '') {
            $conditions[] = "r.id IN (SELECT report_id FROM report_bank_allocations WHERE bank_account_id = ?)";
            $binds[] = (int)$bankAccountId;
        }

        $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

        $dataStmt = $this->pdo->prepare("SELECT r.*, COALESCE(s.is_locked, 0) AS is_locked FROM reports r LEFT JOIN sales s ON r.sale_id = s.id $where ORDER BY r.sale_date DESC, r.id DESC");
        $dataStmt->execute($binds);
        $reports = $dataStmt->fetchAll();

        // attach bank allocations
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
