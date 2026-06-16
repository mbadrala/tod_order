<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class LogController
{
    private string $logDir;

    public function __construct(string $logDir)
    {
        $this->logDir = $logDir;
    }

    public function list(Request $request, Response $response): Response
    {
        if (!$request->getAttribute('is_superadmin')) {
            return $this->json($response, ['error' => 'superadmin only'], 403);
        }

        if (!is_dir($this->logDir)) {
            return $this->json($response, ['data' => [], 'total' => 0]);
        }

        $files = glob($this->logDir . '/app-*.log');
        if (!$files) {
            return $this->json($response, ['data' => [], 'total' => 0]);
        }

        rsort($files);
        $entries = [];

        foreach ($files as $file) {
            $fh = fopen($file, 'r');
            if (!$fh) continue;
            while (($line = fgets($fh)) !== false) {
                $line = rtrim($line, "\r\n");
                if ($line === '') continue;
                $e = json_decode($line, true);
                if (!$e || !isset($e['ts'], $e['user'], $e['method'], $e['path'], $e['status'], $e['ms'])) continue;
                $entries[] = [
                    'timestamp' => $e['ts'],
                    'username' => $e['user'],
                    'method' => $e['method'],
                    'path' => $e['path'],
                    'query' => $e['query'] ?? '',
                    'status' => (int)$e['status'],
                    'duration_ms' => (int)$e['ms'],
                ];
            }
            fclose($fh);
        }

        $entries = array_reverse($entries);
        $total = count($entries);

        return $this->json($response, ['data' => $entries, 'total' => $total]);
    }

    private function json(Response $response, array $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }
}
