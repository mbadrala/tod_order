<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class FileController
{
    private \PDO $pdo;
    private string $uploadDir;

    public function __construct(\PDO $pdo, string $uploadDir)
    {
        $this->pdo = $pdo;
        $this->uploadDir = $uploadDir;

        if (!is_dir($this->uploadDir)) {
            mkdir($this->uploadDir, 0755, true);
        }
    }

    public function upload(Request $request, Response $response): Response
    {
        $userId = $request->getAttribute('user_id');
        $files = $request->getUploadedFiles();

        $uploadedFile = $files['file'] ?? null;
        if (!$uploadedFile || $uploadedFile->getError() !== UPLOAD_ERR_OK) {
            return $this->json($response, ['error' => 'file is required'], 400);
        }

        $originalName = $uploadedFile->getClientFilename();
        $mimeType = $uploadedFile->getClientMediaType();
        $size = $uploadedFile->getSize();

        $ext = pathinfo($originalName, PATHINFO_EXTENSION);
        $storedName = bin2hex(random_bytes(16)) . ($ext ? ".$ext" : '');

        $uploadedFile->moveTo("{$this->uploadDir}/$storedName");

        $stmt = $this->pdo->prepare(
            "INSERT INTO files (user_id, original_name, stored_name, mime_type, size) VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->execute([$userId, $originalName, $storedName, $mimeType, $size]);

        $fileId = $this->pdo->lastInsertId();

        return $this->json($response, [
            'id' => (int)$fileId,
            'original_name' => $originalName,
            'mime_type' => $mimeType,
            'size' => $size,
            'url' => "/files/$fileId",
        ], 201);
    }

    public function get(Request $request, Response $response, array $args): Response
    {
        $stmt = $this->pdo->prepare("SELECT * FROM files WHERE id = ?");
        $stmt->execute([$args['id']]);
        $file = $stmt->fetch();

        if (!$file) {
            return $this->json($response, ['error' => 'not found'], 404);
        }

        $path = "{$this->uploadDir}/{$file['stored_name']}";
        if (!file_exists($path)) {
            return $this->json($response, ['error' => 'file not found on disk'], 404);
        }

        $mimeType = $file['mime_type'] ?? 'application/octet-stream';
        $body = file_get_contents($path);

        $response->getBody()->write($body);
        return $response
            ->withHeader('Content-Type', $mimeType)
            ->withHeader('Content-Disposition', 'inline; filename="' . $file['original_name'] . '"')
            ->withHeader('Cache-Control', 'private, max-age=3600');
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $stmt = $this->pdo->prepare("SELECT * FROM files WHERE id = ?");
        $stmt->execute([$args['id']]);
        $file = $stmt->fetch();

        if (!$file) {
            return $this->json($response, ['error' => 'not found'], 404);
        }

        $path = "{$this->uploadDir}/{$file['stored_name']}";
        if (file_exists($path)) {
            unlink($path);
        }

        $this->pdo->prepare("DELETE FROM files WHERE id = ?")->execute([$args['id']]);
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
