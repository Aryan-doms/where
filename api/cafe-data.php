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
    $extractRange = static function (?string $t): string {
        if (!$t) return '';
        $cleaned = preg_replace('/12midnight/i', '12am', $t);
        $cleaned = preg_replace('/12noon/i', '12pm', $cleaned);
        $cleaned = str_replace(["\xE2\x80\x93", "\xE2\x80\x94", "–", "—"], '-', $cleaned);
        if (preg_match('/(\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*-\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))/i', $cleaned, $m)) {
            return str_replace('-', '–', trim($m[1]));
        }
        return '';
    };

    $weekdayRange = $extractRange($row['weekday_hours']) ?: ($extractRange($row['timing']) ?: '11am – 11pm');
    $weekendRange = $extractRange($row['weekend_hours']) ?: ($extractRange($row['timing']) ?: $weekdayRange);
    $timing = "Mon–Fri: {$weekdayRange}\nSat–Sun: {$weekendRange}";

    $price = $row['price_range'] ?: '₹' . number_format((float) $row['price_for_two'], 0);

    return [
        'id' => $cafeId,
        'name' => $row['name'],
        'slug' => $row['slug'] ?? '',
        'area_id' => (int) $row['area_id'],
        'area' => $row['area'],
        'area_slug' => $row['area_slug'] ?? '',
        'city' => 'Surat',
        'city_slug' => 'surat',
        'url_path' => 'surat/' . ($row['area_slug'] ?? 'area') . '/' . ($row['slug'] ?? $cafeId),
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
        'rating' => isset($row['rating']) && (float) $row['rating'] > 0 ? number_format((float) $row['rating'], 1) : null,
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
    $sql = 'SELECT c.*, a.display_name AS area, a.slug AS area_slug
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
