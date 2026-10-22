<?php

header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/config.php';

if (!is_file($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Database settings are missing. Copy config.example.php to config.php.']);
    exit;
}

$config = require $configPath;

try {
    $connection = new PDO(
        "mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4",
        $config['username'],
        $config['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $cafes = $connection->query(
        'SELECT c.id, c.name, a.display_name AS area, c.niche_type, c.price_range
         FROM cafes c
         JOIN areas a ON a.area_id = c.area_id
         ORDER BY c.source_row_number'
    )->fetchAll(PDO::FETCH_ASSOC);

    $types = $connection->query(
        'SELECT niche_type AS name, COUNT(*) AS count
         FROM cafes
         GROUP BY niche_type
         ORDER BY count DESC, niche_type'
    )->fetchAll(PDO::FETCH_ASSOC);

    $areas = $connection->query(
        'SELECT a.display_name AS name, COUNT(c.id) AS count
         FROM areas a
         JOIN cafes c ON c.area_id = a.area_id
         GROUP BY a.area_id, a.display_name
         ORDER BY count DESC, a.display_name'
    )->fetchAll(PDO::FETCH_ASSOC);

    foreach ($types as &$type) {
        $type['count'] = (int) $type['count'];
    }
    unset($type);

    foreach ($areas as &$area) {
        $area['count'] = (int) $area['count'];
    }
    unset($area);

    echo json_encode(
        ['cafes' => $cafes, 'types' => $types, 'areas' => $areas],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
} catch (PDOException $error) {
    error_log('WHERE? homepage database error: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Could not connect to the cafe database. Check MySQL and api/config.php.']);
}
