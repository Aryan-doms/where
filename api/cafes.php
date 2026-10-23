<?php

require_once __DIR__ . '/cafe-data.php';

try {
    $pdo = whereDb();
    $requestedId = trim((string) ($_GET['id'] ?? ''));
    if ($requestedId !== '') {
        $query = $pdo->prepare(
            'SELECT c.*, a.display_name AS area
             FROM cafes c
             JOIN areas a ON a.area_id = c.area_id
             WHERE c.status = "published" AND c.id = ?'
        );
        $query->execute([$requestedId]);
        $row = $query->fetch();
        if (!$row) {
            whereJson(['error' => 'Cafe not found.'], 404);
        }
        whereJson(whereCafeRecord($pdo, $row));
    }

    $cafes = whereFetchCafes($pdo);
    whereJson(['cafes' => $cafes]);
} catch (PDOException $error) {
    error_log('WHERE? cafe database error: ' . $error->getMessage());
    whereJson(['error' => 'Could not load cafes from MySQL. Start Docker and check api/config.php.'], 500);
}
