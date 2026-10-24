<?php

require_once __DIR__ . '/cafe-data.php';

try {
    $pdo = whereDb();
    $cafes = whereFetchCafes($pdo);
    $types = [];
    foreach ($cafes as $cafe) {
        $types[$cafe['niche']] = ($types[$cafe['niche']] ?? 0) + 1;
    }
    arsort($types);

    $hasHomepageAreas = false;
    try {
        $hasHomepageAreas = (int) $pdo->query('SELECT COUNT(*) FROM homepage_areas')->fetchColumn() > 0;
    } catch (PDOException $e) {
        $hasHomepageAreas = false;
    }

    if ($hasHomepageAreas) {
        $areasList = $pdo->query(
            'SELECT a.area_id, a.display_name AS name, a.slug,
                    COUNT(c.id) AS count,
                    ha.position, ha.image_1, ha.image_2, ha.image_3
             FROM homepage_areas ha
             JOIN areas a ON a.area_id = ha.area_id
             LEFT JOIN cafes c ON c.area_id = a.area_id AND c.status = "published"
             GROUP BY a.area_id, a.display_name, a.slug, ha.position, ha.image_1, ha.image_2, ha.image_3
             ORDER BY ha.position ASC'
        )->fetchAll(PDO::FETCH_ASSOC);
        foreach ($areasList as &$areaRow) {
            $imgs = array_values(array_filter([
                $areaRow['image_1'] ?? '',
                $areaRow['image_2'] ?? '',
                $areaRow['image_3'] ?? ''
            ]));
            $areaRow['images'] = $imgs;
        }
        unset($areaRow);
    } else {
        $areasList = $pdo->query(
            'SELECT a.area_id, a.display_name AS name, a.slug,
                    COUNT(c.id) AS count
             FROM areas a
             LEFT JOIN cafes c ON c.area_id = a.area_id AND c.status = "published"
             GROUP BY a.area_id, a.display_name, a.slug
             ORDER BY count DESC, a.display_name ASC'
        )->fetchAll(PDO::FETCH_ASSOC);
    }

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
        'areas' => $areasList,
        'featured' => $featured,
        'sections' => $sections
    ]);
} catch (PDOException $error) {
    error_log('WHERE? homepage database error: ' . $error->getMessage());
    whereJson(['error' => 'Could not load cafe data from MySQL. Start Docker and check api/config.php.'], 500);
}
