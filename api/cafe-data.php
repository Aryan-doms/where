<?php

require_once __DIR__ . '/db.php';

function whereCafeRecord(PDO $pdo, array $row): array
{
    $cafeId = $row['id'];

    $cuisines = $pdo->prepare(
        'SELECT cu.name
         FROM cafe_cuisines cc
         JOIN cuisines cu ON cu.cuisine_id = cc.cuisine_id
         WHERE cc.cafe_id = ?
         ORDER BY cu.name'
    );
    $cuisines->execute([$cafeId]);

    $amenities = $pdo->prepare(
        'SELECT a.display_name
         FROM cafe_amenities ca
         JOIN amenities a ON a.amenity_key = ca.amenity_key
         WHERE ca.cafe_id = ? AND ca.is_available = 1
         ORDER BY a.display_name'
    );
    $amenities->execute([$cafeId]);

    $images = $pdo->prepare(
        'SELECT ic.image_id, ic.image_url, ic.local_file, ci.alt_text
         FROM cafe_images ci
         JOIN image_catalog ic ON ic.image_id = ci.image_id
         WHERE ci.cafe_id = ?
         ORDER BY ci.is_cover DESC, ci.sort_order, ci.image_id'
    );
    $images->execute([$cafeId]);

    $cuisineNames = array_column($cuisines->fetchAll(), 'name');
    $gallery = $images->fetchAll();
    $timing = trim((string) $row['timing']);
    if ($timing === '') {
        $timing = trim(implode("\n", array_filter([
            $row['weekday_hours'] !== '' ? 'Mon–Fri: ' . $row['weekday_hours'] : '',
            $row['weekend_hours'] !== '' ? 'Sat–Sun: ' . $row['weekend_hours'] : '',
            $row['hours_note'] !== '' ? $row['hours_note'] : ''
        ])));
    }
    $price = $row['price_range'] ?: '₹' . number_format((float) $row['price_for_two'], 0);

    return [
        'id' => $cafeId,
        'name' => $row['name'],
        'area_id' => (int) $row['area_id'],
        'area' => $row['area'],
        'location' => $row['location'],
        'address' => $row['location'],
        'cuisine' => implode(', ', $cuisineNames) ?: $row['cuisine_source'],
        'cuisines' => $cuisineNames,
        'niche' => $row['niche_type'],
        'niche_type' => $row['niche_type'],
        'timing' => $timing,
        'weekday_hours' => $row['weekday_hours'],
        'weekend_hours' => $row['weekend_hours'],
        'hours_note' => $row['hours_note'],
        'contact' => $row['contact_details_number'],
        'price' => $price,
        'price_for_two' => (float) $row['price_for_two'],
        'vibe' => $row['vibe_ambiance'],
        'moreInfo' => $row['more_info'],
        'maps_url' => $row['maps_url'],
        'amenities' => array_column($amenities->fetchAll(), 'display_name'),
        'images' => array_map(static function (array $image): array {
            $localPath = dirname(__DIR__) . '/' . ltrim($image['local_file'], '/');
            $image['src'] = $image['local_file'] !== '' && is_file($localPath)
                ? $image['local_file']
                : $image['image_url'];
            return $image;
        }, $gallery),
        'cover_image' => isset($gallery[0])
            ? ($gallery[0]['local_file'] && is_file(dirname(__DIR__) . '/' . ltrim($gallery[0]['local_file'], '/'))
                ? $gallery[0]['local_file']
                : $gallery[0]['image_url'])
            : '',
        'status' => $row['status']
    ];
}

function whereFetchCafes(PDO $pdo, bool $publishedOnly = true): array
{
    $sql = 'SELECT c.*, a.display_name AS area
            FROM cafes c
            JOIN areas a ON a.area_id = c.area_id';
    if ($publishedOnly) {
        $sql .= ' WHERE c.status = "published"';
    }
    $sql .= ' ORDER BY c.source_row_number IS NULL, c.source_row_number, c.name';
    $rows = $pdo->query($sql)->fetchAll();
    return array_map(static function (array $row) use ($pdo): array {
        return whereCafeRecord($pdo, $row);
    }, $rows);
}
