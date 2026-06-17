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
            $label = ($ba['bank_name'] ?? '') . (!empty($ba['account_name']) ? ' (' . $ba['account_name'] . ')' : '');
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
        $params = $request->getQueryParams();
        $clientName = trim($params['client_name'] ?? '');
        $slipNumber = trim($params['slip_number'] ?? '');
        $totalMin = $params['total_min'] ?? '';
        $totalMax = $params['total_max'] ?? '';
        $page = max(1, (int)($params['page'] ?? 1));
        $perPage = max(1, min(200, (int)($params['per_page'] ?? 50)));

        $conditions = [];
        $binds = [];

        if ($clientName !== '') {
            $conditions[] = "(like_ci(?, s.client_name) OR like_ci(?, s.client_code))";
            $binds[] = "%$clientName%";
            $binds[] = "%$clientName%";
        }
        if ($slipNumber !== '') {
            $conditions[] = "like_ci(?, s.slip_number)";
            $binds[] = "%$slipNumber%";
        }
        if ($totalMin !== '') {
            $conditions[] = "s.total_amount >= ?";
            $binds[] = (float)$totalMin;
        }
        if ($totalMax !== '') {
            $conditions[] = "s.total_amount <= ?";
            $binds[] = (float)$totalMax;
        }

        $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM sales s $where");
        $countStmt->execute($binds);
        $total = (int)$countStmt->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $sql = "SELECT s.*, u.name AS user_name, COUNT(si.id) AS items_count
                FROM sales s
                LEFT JOIN users u ON s.user_id = u.id
                LEFT JOIN sale_items si ON si.sale_id = s.id
                $where
                GROUP BY s.id
                ORDER BY s.sale_date DESC, s.id DESC
                LIMIT ? OFFSET ?";
        $execBinds = $binds;
        $execBinds[] = $perPage;
        $execBinds[] = $offset;
        $dataStmt = $this->pdo->prepare($sql);
        $dataStmt->execute($execBinds);
        $sales = $dataStmt->fetchAll();

        $isAdmin = $request->getAttribute('is_admin');
        $userId = (int)$request->getAttribute('user_id');

        foreach ($sales as &$sale) {
            $sale['items'] = [];
            $sale['bank_allocations'] = [];
            if (!$isAdmin && (int)$sale['user_id'] !== $userId) {
                $sale['total_amount'] = 0;
                $sale['cash_amount'] = 0;
                $sale['deferred_amount'] = 0;
                $sale['discount_amount'] = 0;
            }
        }
        unset($sale);

        return $this->json($response, [
            'data' => $sales,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
        ]);
    }

    public function listSummary(Request $request, Response $response): Response
    {
        if (!$request->getAttribute('is_admin')) {
            return $this->json($response, ['error' => 'admin only'], 403);
        }

        $params = $request->getQueryParams();
        $clientName = trim($params['client_name'] ?? '');
        $from = $params['from'] ?? '';
        $to = $params['to'] ?? '';
        $page = max(1, (int)($params['page'] ?? 1));
        $perPage = max(1, min(200, (int)($params['per_page'] ?? 100)));

        $conditions = [];
        $binds = [];

        if ($clientName !== '') {
            $conditions[] = "(like_ci(?, s.client_name) OR like_ci(?, s.client_code))";
            $binds[] = "%$clientName%";
            $binds[] = "%$clientName%";
        }
        if ($from !== '') {
            $conditions[] = "s.sale_date >= ?";
            $binds[] = $from;
        }
        if ($to !== '') {
            $conditions[] = "s.sale_date <= ?";
            $binds[] = $to;
        }

        $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

        $countStmt = $this->pdo->prepare("SELECT COUNT(DISTINCT s.sale_date) FROM sales s $where");
        $countStmt->execute($binds);
        $total = (int)$countStmt->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $sql = "SELECT
                    s.sale_date,
                    COALESCE(SUM(s.total_amount), 0) AS total_amount,
                    COALESCE(SUM(s.cash_amount), 0) AS cash_amount,
                    COALESCE(SUM(s.deferred_amount), 0) AS deferred_amount,
                    COALESCE(SUM(s.discount_amount), 0) AS discount_amount
                FROM sales s
                $where
                GROUP BY s.sale_date
                ORDER BY s.sale_date DESC
                LIMIT ? OFFSET ?";
        $execBinds = $binds;
        $execBinds[] = $perPage;
        $execBinds[] = $offset;
        $dataStmt = $this->pdo->prepare($sql);
        $dataStmt->execute($execBinds);
        $sales = $dataStmt->fetchAll();

        // Attach per-bank allocation breakdown
        if (!empty($sales)) {
            $dates = array_column($sales, 'sale_date');
            $placeholders = implode(',', array_fill(0, count($dates), '?'));
            $stmt = $this->pdo->prepare(
                "SELECT s.sale_date, sba.bank_account_id, COALESCE(SUM(sba.amount), 0) AS total
                 FROM sale_bank_allocations sba
                 JOIN sales s ON sba.sale_id = s.id
                 WHERE s.sale_date IN ($placeholders)
                 GROUP BY s.sale_date, sba.bank_account_id"
            );
            $stmt->execute($dates);
            $allocs = $stmt->fetchAll();
            $allocLookup = [];
            foreach ($allocs as $a) {
                $allocLookup[$a['sale_date']][$a['bank_account_id']] = (float)$a['total'];
            }
            foreach ($sales as &$sale) {
                $sale['bank_allocations'] = $allocLookup[$sale['sale_date']] ?? [];
            }
            unset($sale);
        }

        return $this->json($response, [
            'data' => $sales,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
        ]);
    }

    public function summaryAll(Request $request, Response $response): Response
    {
        if (!$request->getAttribute('is_admin')) {
            return $this->json($response, ['error' => 'admin only'], 403);
        }

        $params = $request->getQueryParams();
        $clientName = trim($params['client_name'] ?? '');
        $from = $params['from'] ?? '';
        $to = $params['to'] ?? '';

        $conditions = [];
        $binds = [];

        if ($clientName !== '') {
            $conditions[] = "(like_ci(?, s.client_name) OR like_ci(?, s.client_code))";
            $binds[] = "%$clientName%";
            $binds[] = "%$clientName%";
        }
        if ($from !== '') {
            $conditions[] = "s.sale_date >= ?";
            $binds[] = $from;
        }
        if ($to !== '') {
            $conditions[] = "s.sale_date <= ?";
            $binds[] = $to;
        }

        $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

        $sql = "SELECT
                    s.sale_date,
                    COALESCE(SUM(s.total_amount), 0) AS total_amount,
                    COALESCE(SUM(s.cash_amount), 0) AS cash_amount,
                    COALESCE(SUM(s.deferred_amount), 0) AS deferred_amount,
                    COALESCE(SUM(s.discount_amount), 0) AS discount_amount
                FROM sales s
                $where
                GROUP BY s.sale_date
                ORDER BY s.sale_date DESC";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($binds);
        $sales = $stmt->fetchAll();

        if (!empty($sales)) {
            $dates = array_column($sales, 'sale_date');
            $placeholders = implode(',', array_fill(0, count($dates), '?'));
            $stmt = $this->pdo->prepare(
                "SELECT s.sale_date, sba.bank_account_id, COALESCE(SUM(sba.amount), 0) AS total
                 FROM sale_bank_allocations sba
                 JOIN sales s ON sba.sale_id = s.id
                 WHERE s.sale_date IN ($placeholders)
                 GROUP BY s.sale_date, sba.bank_account_id"
            );
            $stmt->execute($dates);
            $allocs = $stmt->fetchAll();
            $allocLookup = [];
            foreach ($allocs as $a) {
                $allocLookup[$a['sale_date']][$a['bank_account_id']] = (float)$a['total'];
            }
            foreach ($sales as &$sale) {
                $sale['bank_allocations'] = $allocLookup[$sale['sale_date']] ?? [];
            }
            unset($sale);
        }

        return $this->json($response, $sales);
    }

    public function summaryPdf(Request $request, Response $response): Response
    {
        if (!$request->getAttribute('is_admin')) {
            return $this->json($response, ['error' => 'admin only'], 403);
        }

        $params = $request->getQueryParams();
        $clientName = trim($params['client_name'] ?? '');
        $from = $params['from'] ?? '';
        $to = $params['to'] ?? '';

        $conditions = [];
        $binds = [];

        if ($clientName !== '') {
            $conditions[] = "(like_ci(?, s.client_name) OR like_ci(?, s.client_code))";
            $binds[] = "%$clientName%";
            $binds[] = "%$clientName%";
        }
        if ($from !== '') {
            $conditions[] = "s.sale_date >= ?";
            $binds[] = $from;
        }
        if ($to !== '') {
            $conditions[] = "s.sale_date <= ?";
            $binds[] = $to;
        }

        $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

        $sql = "SELECT
                    s.sale_date,
                    COALESCE(SUM(s.total_amount), 0) AS total_amount,
                    COALESCE(SUM(s.cash_amount), 0) AS cash_amount,
                    COALESCE(SUM(s.deferred_amount), 0) AS deferred_amount,
                    COALESCE(SUM(s.discount_amount), 0) AS discount_amount
                FROM sales s
                $where
                GROUP BY s.sale_date
                ORDER BY s.sale_date DESC";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($binds);
        $sales = $stmt->fetchAll();

        $bankAccounts = $this->pdo->query("SELECT * FROM bank_accounts ORDER BY id")->fetchAll();

        if (!empty($sales)) {
            $dates = array_column($sales, 'sale_date');
            $placeholders = implode(',', array_fill(0, count($dates), '?'));
            $stmt = $this->pdo->prepare(
                "SELECT s.sale_date, sba.bank_account_id, COALESCE(SUM(sba.amount), 0) AS total
                 FROM sale_bank_allocations sba
                 JOIN sales s ON sba.sale_id = s.id
                 WHERE s.sale_date IN ($placeholders)
                 GROUP BY s.sale_date, sba.bank_account_id"
            );
            $stmt->execute($dates);
            $allocs = $stmt->fetchAll();
            $allocLookup = [];
            foreach ($allocs as $a) {
                $allocLookup[$a['sale_date']][$a['bank_account_id']] = (float)$a['total'];
            }
            foreach ($sales as &$sale) {
                $sale['bank_allocations'] = $allocLookup[$sale['sale_date']] ?? [];
            }
            unset($sale);
        }

        $bdr = '#d1d5db';
        $bg = '#f3f4f6';

        $bankTh = '';
        foreach ($bankAccounts as $ba) {
            $label = ($ba['bank_name'] ?? '') . (!empty($ba['account_name']) ? ' (' . $ba['account_name'] . ')' : '');
            $bankTh .= '<th style="padding:3px 4px;border:1px solid ' . $bdr . ';text-align:right;font-weight:bold;white-space:nowrap;font-size:8px;">' . htmlspecialchars($label) . '</th>';
        }

        $totalAmount = 0;
        $totalCash = 0;
        $totalDeferred = 0;
        $totalDiscount = 0;
        $bankTotals = [];
        foreach ($bankAccounts as $ba) {
            $bankTotals[$ba['id']] = 0;
        }

        $bodyRows = '';
        foreach ($sales as $sale) {
            $totalAmount += $sale['total_amount'];
            $totalCash += $sale['cash_amount'];
            $totalDeferred += $sale['deferred_amount'];
            $totalDiscount += $sale['discount_amount'];

            $bankCells = '';
            foreach ($bankAccounts as $ba) {
                $amt = $sale['bank_allocations'][$ba['id']] ?? 0;
                $bankTotals[$ba['id']] += $amt;
                $bankCells .= '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;">' . number_format($amt) . '</td>';
            }

            $bodyRows .= '<tr>'
                . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';white-space:nowrap;font-size:8px;">' . htmlspecialchars($sale['sale_date']) . '</td>'
                . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;">' . number_format($sale['total_amount']) . '</td>'
                . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;">' . number_format($sale['cash_amount']) . '</td>'
                . $bankCells
                . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;">' . number_format($sale['deferred_amount']) . '</td>'
                . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;">' . number_format($sale['discount_amount']) . '</td>'
                . '</tr>';
        }

        $totalBankCells = '';
        foreach ($bankAccounts as $ba) {
            $totalBankCells .= '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;font-weight:bold;">' . number_format($bankTotals[$ba['id']]) . '</td>';
        }

        $totalRow = '<tr style="font-weight:bold;background:' . $bg . ';">'
            . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';white-space:nowrap;font-size:8px;">Нийт</td>'
            . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;">' . number_format($totalAmount) . '</td>'
            . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;">' . number_format($totalCash) . '</td>'
            . $totalBankCells
            . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;">' . number_format($totalDeferred) . '</td>'
            . '<td style="padding:2px 4px;border:1px solid ' . $bdr . ';text-align:right;white-space:nowrap;font-size:8px;">' . number_format($totalDiscount) . '</td>'
            . '</tr>';

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
    <th class="right">Дүн</th>
    <th class="right">Бэлэн</th>
    ' . $bankTh . '
    <th class="right">Дараа төлбөр</th>
    <th class="right">Хөнгөлөлт</th>
</tr>
</thead>
<tbody>
' . $totalRow . '
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
            ->withHeader('Content-Disposition', 'attachment; filename="neltgel.pdf"');
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

        $isAdmin = $request->getAttribute('is_admin');
        $userId = (int)$request->getAttribute('user_id');
        if (!$isAdmin && (int)$sale['user_id'] !== $userId) {
            $sale['total_amount'] = 0;
            $sale['cash_amount'] = 0;
            $sale['deferred_amount'] = 0;
            $sale['discount_amount'] = 0;
        }

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
        $discountAmount = (float)($body['discount_amount'] ?? 0);

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

        if ($status === 'final' && $allocTotal < $totalAmount - $discountAmount) {
            return $this->json($response, ['error' => 'Хуваарилалтын дүн нийт дүнгээс бага байна'], 400);
        }

        if (!$request->getAttribute('is_admin') && is_array($bankAllocations) && !empty($bankAllocations)) {
            $allowedIds = $this->getUserBankAccountIds($userId);
            foreach ($bankAllocations as $a) {
                if (!in_array((int)$a['bank_account_id'], $allowedIds)) {
                    return $this->json($response, ['error' => 'Та энэ банкны дансыг ашиглах эрхгүй байна'], 403);
                }
            }
        }

        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO sales (sale_date, client_code, client_name, client_phone, slip_number, status, total_amount, cash_amount, deferred_amount, discount_amount, user_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$saleDate, $clientCode, $clientName, $clientPhone, $slipNumber, $status, $totalAmount, $cashAmount, $deferredAmount, $discountAmount, $userId, date('Y-m-d H:i:s')]);
            $saleId = $this->pdo->lastInsertId();

            $stmt = $this->pdo->prepare("
                INSERT INTO sale_items (sale_id, product_code, product_name, amount, unit_price, sum_price)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            foreach ($items as $item) {
                if (empty(trim($item['product_code'] ?? ''))) continue;
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

            if ($status === 'final') {
                $this->generateReportRows($saleId);
                $this->pdo->prepare("UPDATE sales SET is_locked = 1 WHERE id = ?")->execute([$saleId]);
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

        $stmt = $this->pdo->prepare("SELECT id, user_id, is_locked FROM sales WHERE id = ?");
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

        if (!$isAdmin && (int)($sale['is_locked'] ?? 0) === 1) {
            return $this->json($response, ['error' => 'Энэ борлуулалт түгжигдсэн тул засах боломжгүй. Админаас түгжээг тайлуулна уу'], 403);
        }

        $fields = ['sale_date', 'client_code', 'client_name', 'client_phone', 'slip_number', 'status', 'cash_amount', 'deferred_amount', 'discount_amount'];
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

        if (!$isAdmin && is_array($bankAllocations) && !empty($bankAllocations)) {
            $allowedIds = $this->getUserBankAccountIds($userId);
            foreach ($bankAllocations as $a) {
                if (!in_array((int)$a['bank_account_id'], $allowedIds)) {
                    return $this->json($response, ['error' => 'Та энэ банкны дансыг ашиглах эрхгүй байна'], 403);
                }
            }
        }

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
            $discountAmount = (float)($body['discount_amount'] ?? $sale['discount_amount'] ?? 0);

            $allocTotal = $cashAmount + $deferredAmount;
            if (is_array($bankAllocations)) {
                foreach ($bankAllocations as &$a) {
                    $aAmount = (float)($a['amount'] ?? 0);
                    $allocTotal += $aAmount;
                    $a['amount'] = $aAmount;
                }
                unset($a);
            }

            if ($status === 'final' && $allocTotal < $totalAmount - $discountAmount) {
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
                    if (empty(trim($item['product_code'] ?? ''))) continue;
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
                            $a['account_name'] ?? '',
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
                $discountAmount = (float)($body['discount_amount'] ?? $sale['discount_amount'] ?? 0);
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

                if ($allocTotal < $existingTotal - $discountAmount) {
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
                            $a['account_name'] ?? '',
                            $a['amount'],
                        ]);
                    }
                }
            }
        }

        if (!empty($set)) {
            $set[] = "updated_at = ?";
            $params[] = date('Y-m-d H:i:s');
            $params[] = $args['id'];
            $this->pdo->prepare("UPDATE sales SET " . implode(', ', $set) . " WHERE id = ?")->execute($params);
        }

        if ($items !== null) {
            $this->pdo->commit();
        }

        $this->deleteReportRows($args['id']);
        $finalStatus = $body['status'] ?? $sale['status'] ?? 'final';
        if ($finalStatus === 'final') {
            $this->generateReportRows($args['id']);
            $this->pdo->prepare("UPDATE sales SET is_locked = 1, updated_at = ? WHERE id = ?")->execute([date('Y-m-d H:i:s'), $args['id']]);
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

        $this->deleteReportRows($args['id']);
        $this->pdo->prepare("DELETE FROM sale_bank_allocations WHERE sale_id = ?")->execute([$args['id']]);
        $this->pdo->prepare("DELETE FROM sale_items WHERE sale_id = ?")->execute([$args['id']]);
        $this->pdo->prepare("DELETE FROM sales WHERE id = ?")->execute([$args['id']]);

        return $this->json($response, ['message' => 'deleted']);
    }

    public function toggleLock(Request $request, Response $response, array $args): Response
    {
        if (!$request->getAttribute('is_admin')) {
            return $this->json($response, ['error' => 'admin only'], 403);
        }

        $stmt = $this->pdo->prepare("SELECT id, is_locked FROM sales WHERE id = ?");
        $stmt->execute([$args['id']]);
        $sale = $stmt->fetch();
        if (!$sale) {
            return $this->json($response, ['error' => 'not found'], 404);
        }

        $newLocked = $sale['is_locked'] ? 0 : 1;
        $this->pdo->prepare("UPDATE sales SET is_locked = ?, updated_at = ? WHERE id = ?")
            ->execute([$newLocked, date('Y-m-d H:i:s'), $args['id']]);

        return $this->json($response, ['is_locked' => $newLocked]);
    }

    private function generateReportRows(int $saleId): void
    {
        $stmt = $this->pdo->prepare("SELECT * FROM sales WHERE id = ?");
        $stmt->execute([$saleId]);
        $sale = $stmt->fetch();
        if (!$sale || $sale['status'] !== 'final') return;

        $stmt = $this->pdo->prepare("SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id");
        $stmt->execute([$saleId]);
        $items = $stmt->fetchAll();

        $stmt = $this->pdo->prepare("SELECT * FROM sale_bank_allocations WHERE sale_id = ? ORDER BY id");
        $stmt->execute([$saleId]);
        $bankAllocs = $stmt->fetchAll();

        $userName = '';
        $stmt = $this->pdo->prepare("SELECT name FROM users WHERE id = ?");
        $stmt->execute([$sale['user_id']]);
        $u = $stmt->fetch();
        if ($u) $userName = $u['name'];

        $now = date('Y-m-d H:i:s');
        $stmt = $this->pdo->prepare("
            INSERT INTO reports (sale_id, sale_date, client_code, client_name, client_phone, slip_number, total_amount, cash_amount, deferred_amount, discount_amount, product_code, product_name, item_amount, unit_price, sum_price, user_id, user_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmtAlloc = $this->pdo->prepare("
            INSERT INTO report_bank_allocations (report_id, bank_account_id, bank_name, account_number, account_name, amount)
            VALUES (?, ?, ?, ?, ?, ?)
        ");

        foreach ($items as $item) {
            if (empty(trim($item['product_code']))) continue;
            $stmt->execute([
                $saleId,
                $sale['sale_date'],
                $sale['client_code'],
                $sale['client_name'],
                $sale['client_phone'],
                $sale['slip_number'],
                $sale['total_amount'],
                $sale['cash_amount'],
                $sale['deferred_amount'],
                $sale['discount_amount'] ?? 0,
                $item['product_code'],
                $item['product_name'],
                $item['amount'],
                $item['unit_price'],
                $item['sum_price'],
                $sale['user_id'],
                $userName,
                $now,
            ]);
            $reportId = $this->pdo->lastInsertId();

            foreach ($bankAllocs as $a) {
                $stmtAlloc->execute([
                    $reportId,
                    $a['bank_account_id'],
                    $a['bank_name'],
                    $a['account_number'],
                    $a['account_name'] ?? '',
                    $a['amount'],
                ]);
            }
        }
    }

    private function deleteReportRows(int $saleId): void
    {
        $this->pdo->prepare("DELETE FROM report_bank_allocations WHERE report_id IN (SELECT id FROM reports WHERE sale_id = ?)")->execute([$saleId]);
        $this->pdo->prepare("DELETE FROM reports WHERE sale_id = ?")->execute([$saleId]);
    }

    private function getUserBankAccountIds(int $userId): array
    {
        $stmt = $this->pdo->prepare("SELECT bank_account_ids FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        return $user && $user['bank_account_ids'] ? json_decode($user['bank_account_ids'], true) : [];
    }

    private function json(Response $response, array $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }
}
