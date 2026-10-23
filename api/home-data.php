<?php

require_once __DIR__ . '/cafe-data.php';

try {
    $pdo = whereDb();
    $cafes = whereFetchCafes($pdo);
    $types = [];
    $areas = [];
    foreach ($cafes as $cafe) {
        $types[$cafe['niche']] = ($types[$cafe['niche']] ?? 0) + 1;
        $areas[$cafe['area']] = ($areas[$cafe['area']] ?? 0) + 1;
    }
    arsort($types);
    arsort($areas);

    $featured = $pdo->query(
        'SELECT c.id
         FROM homepage_featured_cafes h
         JOIN cafes c ON c.id = h.cafe_id
         WHERE c.status = "published"
         ORDER BY h.position'
    )->fetchAll(PDO::FETCH_COLUMN);
    if (!$featured) {
        $featured = array_column(array_slice($cafes, 0, 6), 'id');
    }

    $sections = $pdo->query(
        'SELECT section_key, title, body, media_path, link_label, link_url, is_published
         FROM homepage_sections
         ORDER BY sort_order'
    )->fetchAll();

    whereJson([
        'cafes' => $cafes,
        'types' => array_map(static function (string $name, int $count): array {
            return ['name' => $name, 'count' => $count];
        }, array_keys($types), array_values($types)),
        'areas' => array_map(static function (string $name, int $count): array {
            return ['name' => $name, 'count' => $count];
        }, array_keys($areas), array_values($areas)),
        'featured' => $featured,
        'sections' => $sections
    ]);
} catch (PDOException $error) {
    error_log('WHERE? homepage database error: ' . $error->getMessage());
    whereJson(['error' => 'Could not load cafe data from MySQL. Start Docker and check api/config.php.'], 500);
}
