<?php

require_once __DIR__ . '/cafe-data.php';

try {
    $pdo = whereDb();
    $requestedId = trim((string) ($_GET['id'] ?? ''));
    $requestedSlug = trim((string) ($_GET['slug'] ?? ''));
    $requestedArea = trim((string) ($_GET['area'] ?? ''));

    if ($requestedId !== '' || $requestedSlug !== '') {
        $sql = 'SELECT c.*, a.display_name AS area, a.slug AS area_slug
                FROM cafes c
                JOIN areas a ON a.area_id = c.area_id
                WHERE c.status = "published"';
        $params = [];

        if ($requestedId !== '') {
            $sql .= ' AND c.id = ?';
            $params[] = $requestedId;
        } elseif ($requestedSlug !== '') {
            $sql .= ' AND c.slug = ?';
            $params[] = $requestedSlug;
            if ($requestedArea !== '') {
                $sql .= ' AND (a.slug = ? OR a.display_name = ?)';
                $params[] = $requestedArea;
                $params[] = $requestedArea;
            }
        }

        $query = $pdo->prepare($sql);
        $query->execute($params);
        $row = $query->fetch();
        if (!$row) {
            whereJson(['error' => 'Cafe not found.'], 404);
        }
        whereJson(whereCafeRecord($pdo, $row));
    }

    $cafes = whereFetchCafes($pdo);
    if ($requestedArea !== '') {
        $cafes = array_values(array_filter($cafes, static function (array $c) use ($requestedArea): bool {
            return ($c['area_slug'] ?? '') === $requestedArea || ($c['area'] ?? '') === $requestedArea;
        }));
    }
    $requestedNiche = trim((string) ($_GET['niche'] ?? ''));
    if ($requestedNiche !== '') {
        $cafes = array_values(array_filter($cafes, static function (array $c) use ($requestedNiche): bool {
            return strcasecmp($c['niche'] ?? '', $requestedNiche) === 0 || strcasecmp($c['niche_type'] ?? '', $requestedNiche) === 0;
        }));
    }
    whereJson(['cafes' => $cafes]);
} catch (PDOException $error) {
    error_log('WHERE? cafe database error: ' . $error->getMessage());
    whereJson(['error' => 'Could not load cafes from MySQL. Start Docker and check api/config.php.'], 500);
}
