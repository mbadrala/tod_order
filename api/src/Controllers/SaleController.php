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

    public function report(Request $request, Response $response): Response
    {
        $params = $request->getQueryParams();
        $from = $params['from'] ?? '';
        $to = $params['to'] ?? '';
        $clientCode = $params['client_code'] ?? '';

        $sql = "SELECT s.*, u.name AS user_name FROM sales s LEFT JOIN users u ON s.user_id = u.id WHERE s.status = 'final'";
        $binds = [];

        if ($from !== '') {
            $sql .= " AND s.sale_date >= ?";
            $binds[] = $from;
        }
        if ($to !== '') {
            $sql .= " AND s.sale_date <= ?";
            $binds[] = $to;
        }
        if ($clientCode !== '') {
            $sql .= " AND s.client_code = ?";
            $binds[] = $clientCode;
        }

        $sql .= " ORDER BY s.sale_date DESC, s.id DESC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($binds);
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

            $stmt = $this->pdo->prepare("SELECT * FROM sale_bank_allocations WHERE sale_id IN ($placeholders) ORDER BY id");
            $stmt->execute($ids);
            $allAllocs = $stmt->fetchAll();
            $allocsBySale = [];
            foreach ($allAllocs as $a) {
                $allocsBySale[$a['sale_id']][] = $a;
            }

            foreach ($sales as &$sale) {
                $sale['items'] = $itemsBySale[$sale['id']] ?? [];
                $sale['bank_allocations'] = $allocsBySale[$sale['id']] ?? [];
            }
            unset($sale);
        }

        return $this->json($response, $sales);
    }

    public function reportPdf(Request $request, Response $response): Response
    {
        $params = $request->getQueryParams();
        $from = $params['from'] ?? '';
        $to = $params['to'] ?? '';
        $clientCode = $params['client_code'] ?? '';

        $sql = "SELECT s.*, u.name AS user_name FROM sales s LEFT JOIN users u ON s.user_id = u.id WHERE s.status = 'final'";
        $binds = [];

        if ($from !== '') {
            $sql .= " AND s.sale_date >= ?";
            $binds[] = $from;
        }
        if ($to !== '') {
            $sql .= " AND s.sale_date <= ?";
            $binds[] = $to;
        }
        if ($clientCode !== '') {
            $sql .= " AND s.client_code = ?";
            $binds[] = $clientCode;
        }

        $sql .= " ORDER BY s.sale_date DESC, s.id DESC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($binds);
        $sales = $stmt->fetchAll();

        $bankAccounts = $this->pdo->query("SELECT * FROM bank_accounts ORDER BY id")->fetchAll();

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

            $stmt = $this->pdo->prepare("SELECT * FROM sale_bank_allocations WHERE sale_id IN ($placeholders) ORDER BY id");
            $stmt->execute($ids);
            $allAllocs = $stmt->fetchAll();
            $allocsBySale = [];
            foreach ($allAllocs as $a) {
                $allocsBySale[$a['sale_id']][] = $a;
            }

            foreach ($sales as &$sale) {
                $sale['items'] = $itemsBySale[$sale['id']] ?? [];
                $sale['bank_allocations'] = $allocsBySale[$sale['id']] ?? [];
            }
            unset($sale);
        }

        $bdr = '#d1d5db';
        $bg = '#f3f4f6';

        $bankCols = '';
        foreach ($bankAccounts as $ba) {
            $label = !empty($ba['account_name']) ? $ba['account_name'] : ($ba['bank_name'] ?? '');
            $bankCols .= '<th style="padding:3px 4px;border:1px solid ' . $bdr . ';text-align:right;font-weight:bold;white-space:nowrap;font-size:8px;">' . htmlspecialchars($label) . '</th>';
        }

        $bodyRows = '';
        foreach ($sales as $sale) {
            $allocsByAccountId = [];
            foreach (($sale['bank_allocations'] ?? []) as $a) {
                $allocsByAccountId[$a['bank_account_id']] = $a['amount'];
            }
            foreach (($sale['items'] ?? []) as $item) {
                $bankCells = '';
                foreach ($bankAccounts as $ba) {
                    $amt = $allocsByAccountId[$ba['id']] ?? 0;
                    $bankCells .= '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;">' . number_format($amt) . '</td>';
                }
                $bodyRows .= '<tr>'
                    . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';white-space:nowrap;font-size:8px;">' . htmlspecialchars($sale['sale_date']) . '</td>'
                    . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';white-space:nowrap;font-size:8px;">' . htmlspecialchars($sale['client_code'] ?? '') . '</td>'
                    . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';white-space:nowrap;font-size:8px;">' . htmlspecialchars($sale['client_name'] ?? '') . '</td>'
                    . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';white-space:nowrap;font-size:8px;">' . htmlspecialchars($sale['client_phone'] ?? '') . '</td>'
                    . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';white-space:nowrap;font-size:8px;">' . htmlspecialchars($sale['slip_number'] ?? '') . '</td>'
                    . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';white-space:nowrap;font-size:8px;">' . htmlspecialchars($item['product_code']) . '</td>'
                    . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';white-space:nowrap;font-size:8px;">' . htmlspecialchars($item['product_name']) . '</td>'
                    . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;">' . $item['amount'] . '</td>'
                    . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;">' . number_format($item['unit_price']) . '</td>'
                    . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;">' . number_format($item['sum_price']) . '</td>'
                    . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;">' . number_format($sale['cash_amount'] ?? 0) . '</td>'
                    . $bankCells
                    . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;">' . number_format($sale['deferred_amount'] ?? 0) . '</td>'
                    . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';white-space:nowrap;font-size:8px;">' . htmlspecialchars($sale['user_name'] ?? '') . '</td>'
                    . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';white-space:nowrap;font-size:8px;">' . htmlspecialchars($sale['created_at']) . '</td>'
                    . '</tr>';
            }
        }

        $html = '<!DOCTYPE html>
<html lang="mn">
<head>
<meta charset="utf-8">
<style>
    body { font-family: "DejaVu Sans", sans-serif; font-size: 8px; margin: 10px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 2px 4px; border: 1px solid ' . $bdr . '; white-space: nowrap; }
    th { background: ' . $bg . '; font-weight: bold; text-align: left; }
    .right { text-align: right; }
</style>
</head>
<body>
<table>
<thead>
<tr>
    <th>Огноо</th>
    <th>Харилцагчийн код</th>
    <th>Харилцагчийн нэр</th>
    <th>Утасны дугаар</th>
    <th>Падааны дугаар</th>
    <th>Барааны код</th>
    <th>Барааны нэр</th>
    <th class="right">Тоо хэмжээ</th>
    <th class="right">Нэгж үнэ</th>
    <th class="right">Дүн</th>
    <th class="right">Бэлэн</th>
    ' . $bankCols . '
    <th class="right">Дараа төлбөр</th>
    <th>Бүртгэсэн ажилтан</th>
    <th>Бүртгэсэн огноо</th>
</tr>
</thead>
<tbody>
' . $bodyRows . '
</tbody>
</table>
</body>
</html>';

        $dompdf = new \Dompdf\Dompdf();
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'landscape');
        $dompdf->render();

        $response->getBody()->write($dompdf->output());
        return $response
            ->withHeader('Content-Type', 'application/pdf')
            ->withHeader('Content-Disposition', 'attachment; filename="report.pdf"');
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

            $stmt = $this->pdo->prepare("SELECT * FROM sale_bank_allocations WHERE sale_id IN ($placeholders) ORDER BY id");
            $stmt->execute($ids);
            $allAllocs = $stmt->fetchAll();
            $allocsBySale = [];
            foreach ($allAllocs as $a) {
                $allocsBySale[$a['sale_id']][] = $a;
            }

            foreach ($sales as &$sale) {
                $sale['items'] = $itemsBySale[$sale['id']] ?? [];
                $sale['bank_allocations'] = $allocsBySale[$sale['id']] ?? [];
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

        $stmt = $this->pdo->prepare("SELECT * FROM sale_bank_allocations WHERE sale_id = ? ORDER BY id");
        $stmt->execute([$args['id']]);
        $sale['bank_allocations'] = $stmt->fetchAll();

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
        $bankAllocations = $body['bank_allocations'] ?? [];
        $cashAmount = (float)($body['cash_amount'] ?? 0);
        $deferredAmount = (float)($body['deferred_amount'] ?? 0);

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

        $allocTotal = $cashAmount + $deferredAmount;
        if (is_array($bankAllocations)) {
            foreach ($bankAllocations as &$a) {
                $aAmount = (float)($a['amount'] ?? 0);
                $allocTotal += $aAmount;
                $a['amount'] = $aAmount;
            }
            unset($a);
        }

        if ($status === 'final' && $allocTotal < $totalAmount) {
            return $this->json($response, ['error' => 'Хуваарилалтын дүн нийт дүнгээс бага байна'], 400);
        }

        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO sales (sale_date, client_code, client_name, client_phone, slip_number, status, total_amount, cash_amount, deferred_amount, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$saleDate, $clientCode, $clientName, $clientPhone, $slipNumber, $status, $totalAmount, $cashAmount, $deferredAmount, $userId]);
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

            if (is_array($bankAllocations) && !empty($bankAllocations)) {
                $stmt = $this->pdo->prepare("
                    INSERT INTO sale_bank_allocations (sale_id, bank_account_id, bank_name, account_number, account_name, amount)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                foreach ($bankAllocations as $a) {
                    $stmt->execute([
                        $saleId,
                        $a['bank_account_id'],
                        $a['bank_name'] ?? '',
                        $a['account_number'] ?? '',
                        $a['account_name'] ?? '',
                        $a['amount'],
                    ]);
                }
            }

            $this->pdo->commit();

            $stmt = $this->pdo->prepare("SELECT * FROM sales WHERE id = ?");
            $stmt->execute([$saleId]);
            $sale = $stmt->fetch();

            $stmt = $this->pdo->prepare("SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id");
            $stmt->execute([$saleId]);
            $sale['items'] = $stmt->fetchAll();

            $stmt = $this->pdo->prepare("SELECT * FROM sale_bank_allocations WHERE sale_id = ? ORDER BY id");
            $stmt->execute([$saleId]);
            $sale['bank_allocations'] = $stmt->fetchAll();

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

        $fields = ['sale_date', 'client_code', 'client_name', 'client_phone', 'slip_number', 'status', 'cash_amount', 'deferred_amount'];
        $set = [];
        $params = [];

        foreach ($fields as $f) {
            if (array_key_exists($f, $body)) {
                $set[] = "$f = ?";
                $params[] = $body[$f];
            }
        }

        $items = $body['items'] ?? null;
        $bankAllocations = $body['bank_allocations'] ?? null;

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

            $status = $body['status'] ?? $sale['status'] ?? 'final';
            $cashAmount = (float)($body['cash_amount'] ?? $sale['cash_amount'] ?? 0);
            $deferredAmount = (float)($body['deferred_amount'] ?? $sale['deferred_amount'] ?? 0);

            $allocTotal = $cashAmount + $deferredAmount;
            if (is_array($bankAllocations)) {
                foreach ($bankAllocations as &$a) {
                    $aAmount = (float)($a['amount'] ?? 0);
                    $allocTotal += $aAmount;
                    $a['amount'] = $aAmount;
                }
                unset($a);
            }

            if ($status === 'final' && $allocTotal < $totalAmount) {
                return $this->json($response, ['error' => 'Хуваарилалтын дүн нийт дүнгээс бага байна'], 400);
            }

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

                $this->pdo->prepare("DELETE FROM sale_bank_allocations WHERE sale_id = ?")->execute([$args['id']]);

                if (is_array($bankAllocations) && !empty($bankAllocations)) {
                    $stmtAlloc = $this->pdo->prepare("
                        INSERT INTO sale_bank_allocations (sale_id, bank_account_id, bank_name, account_number, account_name, amount)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ");
                    foreach ($bankAllocations as $a) {
                        $stmtAlloc->execute([
                            $args['id'],
                            $a['bank_account_id'],
                            $a['bank_name'] ?? '',
                            $a['account_number'] ?? '',
                            $a['amount'],
                        ]);
                    }
                }
            } catch (\Exception $e) {
                $this->pdo->rollBack();
                return $this->json($response, ['error' => 'update failed'], 500);
            }
        } else {
            $status = $body['status'] ?? $sale['status'] ?? 'final';

            if ($bankAllocations !== null && $status === 'final') {
                $cashAmount = (float)($body['cash_amount'] ?? $sale['cash_amount'] ?? 0);
                $deferredAmount = (float)($body['deferred_amount'] ?? $sale['deferred_amount'] ?? 0);
                $allocTotal = $cashAmount + $deferredAmount;
                if (is_array($bankAllocations)) {
                    foreach ($bankAllocations as &$a) {
                        $aAmount = (float)($a['amount'] ?? 0);
                        $allocTotal += $aAmount;
                        $a['amount'] = $aAmount;
                    }
                    unset($a);
                }

                $stmt = $this->pdo->prepare("SELECT total_amount FROM sales WHERE id = ?");
                $stmt->execute([$args['id']]);
                $existing = $stmt->fetch();
                $existingTotal = (float)($existing['total_amount'] ?? 0);

                if ($allocTotal < $existingTotal) {
                    return $this->json($response, ['error' => 'Хуваарилалтын дүн нийт дүнгээс бага байна'], 400);
                }

                $this->pdo->prepare("DELETE FROM sale_bank_allocations WHERE sale_id = ?")->execute([$args['id']]);

                if (is_array($bankAllocations) && !empty($bankAllocations)) {
                    $stmtAlloc = $this->pdo->prepare("
                        INSERT INTO sale_bank_allocations (sale_id, bank_account_id, bank_name, account_number, account_name, amount)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ");
                    foreach ($bankAllocations as $a) {
                        $stmtAlloc->execute([
                            $args['id'],
                            $a['bank_account_id'],
                            $a['bank_name'] ?? '',
                            $a['account_number'] ?? '',
                            $a['amount'],
                        ]);
                    }
                }
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

        $stmt = $this->pdo->prepare("SELECT * FROM sale_bank_allocations WHERE sale_id = ? ORDER BY id");
        $stmt->execute([$args['id']]);
        $sale['bank_allocations'] = $stmt->fetchAll();

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

        $this->pdo->prepare("DELETE FROM sale_bank_allocations WHERE sale_id = ?")->execute([$args['id']]);
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
