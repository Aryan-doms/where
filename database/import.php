<?php

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Run this importer from the command line.\n");
    exit(1);
}

require_once __DIR__ . '/../api/db.php';

function readCsvRows(string $path): array
{
    if (!is_file($path)) {
        throw new RuntimeException("Source CSV not found: {$path}");
    }
    $handle = fopen($path, 'rb');
    if (!$handle) {
        throw new RuntimeException("Could not open source CSV: {$path}");
    }
    $headers = fgetcsv($handle);
    if (!$headers) {
        fclose($handle);
        throw new RuntimeException("Source CSV is empty: {$path}");
    }
    $headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', $headers[0]);
    $rows = [];
    while (($values = fgetcsv($handle)) !== false) {
        if (count(array_filter($values, static fn ($value) => trim((string) $value) !== '')) === 0) {
            continue;
        }
        $rows[] = array_combine($headers, array_pad($values, count($headers), ''));
    }
    fclose($handle);
    return $rows;
}

function requiredCsvValue(array $row, string $column, string $source): string
{
    if (!array_key_exists($column, $row)) {
        throw new RuntimeException("The {$source} dataset is missing the {$column} column.");
    }
    return trim((string) $row[$column]);
}

function cafeDatabaseId(string $sourceId): string
{
    if (!preg_match('/^\d+$/', $sourceId)) {
        throw new RuntimeException("Invalid cafe_id in data/cafes.csv: {$sourceId}");
    }
    return 'cafe-' . str_pad($sourceId, 3, '0', STR_PAD_LEFT);
}

function priceAmount(string $value): float
{
    if (!is_numeric($value) || (float) $value < 0) {
        throw new RuntimeException("Invalid price_for_two value: {$value}");
    }
    return (float) $value;
}

try {
    $pdo = whereDb();
    $existingCount = (int) $pdo->query('SELECT COUNT(*) FROM cafes')->fetchColumn();
    if ($existingCount > 0 && !in_array('--force', $argv, true)) {
        throw new RuntimeException(
            'Cafe records already exist. The importer will not overwrite CMS data. '
            . 'Pass --force only if you intend to replace CSV-sourced cafe details and relationships.'
        );
    }

    $dataDirectory = __DIR__ . '/../data/';
    $areas = readCsvRows($dataDirectory . 'areas.csv');
    $cafes = readCsvRows($dataDirectory . 'cafes.csv');
    $cuisines = readCsvRows($dataDirectory . 'cuisines.csv');
    $cafeCuisines = readCsvRows($dataDirectory . 'cafe_cuisines.csv');
    $amenities = readCsvRows($dataDirectory . 'amenities.csv');
    $cafeAmenities = readCsvRows($dataDirectory . 'cafe_amenities.csv');
    $catalogPath = __DIR__ . '/../catalog.csv';
    $catalog = is_file($catalogPath) ? readCsvRows($catalogPath) : [];

    $pdo->beginTransaction();

    $upsertArea = $pdo->prepare(
        'INSERT INTO areas (standardized_category, display_name) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)'
    );
    $findArea = $pdo->prepare('SELECT area_id FROM areas WHERE standardized_category = ?');
    $areaIds = [];
    foreach ($areas as $area) {
        $sourceId = requiredCsvValue($area, 'area_id', 'areas');
        $category = requiredCsvValue($area, 'standardized_category', 'areas');
        $displayName = requiredCsvValue($area, 'display_name', 'areas');
        if ($category === '' || $displayName === '') {
            throw new RuntimeException("Area {$sourceId} is missing its category or display name.");
        }
        $upsertArea->execute([$category, $displayName]);
        $findArea->execute([$category]);
        $areaIds[$sourceId] = (int) $findArea->fetchColumn();
    }

    $upsertCuisine = $pdo->prepare(
        'INSERT INTO cuisines (name) VALUES (?) ON DUPLICATE KEY UPDATE name = VALUES(name)'
    );
    $findCuisine = $pdo->prepare('SELECT cuisine_id FROM cuisines WHERE name = ?');
    $cuisineIds = [];
    $cuisineNamesBySourceId = [];
    foreach ($cuisines as $cuisine) {
        $sourceId = requiredCsvValue($cuisine, 'cuisine_id', 'cuisines');
        $name = requiredCsvValue($cuisine, 'name', 'cuisines');
        $upsertCuisine->execute([$name]);
        $findCuisine->execute([$name]);
        $cuisineIds[$sourceId] = (int) $findCuisine->fetchColumn();
        $cuisineNamesBySourceId[$sourceId] = $name;
    }

    $upsertAmenity = $pdo->prepare(
        'INSERT INTO amenities (amenity_key, display_name) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)'
    );
    $amenityIds = [];
    foreach ($amenities as $amenity) {
        $sourceId = requiredCsvValue($amenity, 'amenity_id', 'amenities');
        $name = requiredCsvValue($amenity, 'name', 'amenities');
        $key = whereAmenityKey($name);
        if ($key === '') {
            throw new RuntimeException("Amenity {$sourceId} has an invalid name.");
        }
        $upsertAmenity->execute([$key, $name]);
        $amenityIds[$sourceId] = $key;
    }

    $knownCafeSourceIds = [];
    foreach ($cafes as $cafe) {
        $sourceCafeId = requiredCsvValue($cafe, 'cafe_id', 'cafes');
        if (isset($knownCafeSourceIds[$sourceCafeId])) {
            throw new RuntimeException("Duplicate cafe_id in data/cafes.csv: {$sourceCafeId}");
        }
        $knownCafeSourceIds[$sourceCafeId] = true;
    }
    $cuisineLinksByCafe = [];
    foreach ($cafeCuisines as $link) {
        $sourceCafeId = requiredCsvValue($link, 'cafe_id', 'cafe_cuisines');
        $sourceCuisineId = requiredCsvValue($link, 'cuisine_id', 'cafe_cuisines');
        if (!isset($knownCafeSourceIds[$sourceCafeId])) {
            throw new RuntimeException("Unknown cafe_id {$sourceCafeId} in data/cafe_cuisines.csv.");
        }
        if (!isset($cuisineIds[$sourceCuisineId])) {
            throw new RuntimeException("Unknown cuisine_id {$sourceCuisineId} in data/cafe_cuisines.csv.");
        }
        $cuisineLinksByCafe[$sourceCafeId][] = $sourceCuisineId;
    }
    $amenityLinksByCafe = [];
    foreach ($cafeAmenities as $link) {
        $sourceCafeId = requiredCsvValue($link, 'cafe_id', 'cafe_amenities');
        $sourceAmenityId = requiredCsvValue($link, 'amenity_id', 'cafe_amenities');
        if (!isset($knownCafeSourceIds[$sourceCafeId])) {
            throw new RuntimeException("Unknown cafe_id {$sourceCafeId} in data/cafe_amenities.csv.");
        }
        if (!isset($amenityIds[$sourceAmenityId])) {
            throw new RuntimeException("Unknown amenity_id {$sourceAmenityId} in data/cafe_amenities.csv.");
        }
        $amenityLinksByCafe[$sourceCafeId][] = $link;
    }

    $insertCafe = $pdo->prepare(
        'INSERT INTO cafes
          (id, source_row_number, name, area_id, location, cuisine_source, niche_type, timing,
           weekday_hours, weekend_hours, hours_note, contact_details_number, price_range,
           price_for_two, vibe_ambiance, more_info, maps_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), area_id = VALUES(area_id),
           location = VALUES(location), cuisine_source = VALUES(cuisine_source),
           niche_type = VALUES(niche_type), timing = VALUES(timing),
           weekday_hours = VALUES(weekday_hours), weekend_hours = VALUES(weekend_hours),
           hours_note = VALUES(hours_note), contact_details_number = VALUES(contact_details_number),
           price_range = VALUES(price_range), price_for_two = VALUES(price_for_two),
           vibe_ambiance = VALUES(vibe_ambiance), more_info = VALUES(more_info),
           maps_url = VALUES(maps_url), status = VALUES(status)'
    );
    $deleteCafeCuisines = $pdo->prepare('DELETE FROM cafe_cuisines WHERE cafe_id = ?');
    $insertCafeCuisine = $pdo->prepare(
        'INSERT IGNORE INTO cafe_cuisines (cafe_id, cuisine_id) VALUES (?, ?)'
    );
    $deleteCafeAmenities = $pdo->prepare('DELETE FROM cafe_amenities WHERE cafe_id = ?');
    $insertCafeAmenity = $pdo->prepare(
        'INSERT INTO cafe_amenities (cafe_id, amenity_key, is_available) VALUES (?, ?, ?)'
    );
    $sourceCafeIds = [];
    foreach ($cafes as $cafe) {
        $sourceId = requiredCsvValue($cafe, 'cafe_id', 'cafes');
        $cafeId = cafeDatabaseId($sourceId);
        $areaSourceId = requiredCsvValue($cafe, 'area_id', 'cafes');
        if (!isset($areaIds[$areaSourceId])) {
            throw new RuntimeException("Cafe {$sourceId} references an unknown area_id {$areaSourceId}.");
        }
        $name = requiredCsvValue($cafe, 'name', 'cafes');
        $niche = requiredCsvValue($cafe, 'niche_type', 'cafes');
        $weekdayHours = requiredCsvValue($cafe, 'weekday_hours', 'cafes');
        $weekendHours = requiredCsvValue($cafe, 'weekend_hours', 'cafes');
        $hoursNote = requiredCsvValue($cafe, 'hours_note', 'cafes');
        $timing = implode("\n", array_values(array_unique(array_filter([
            $weekdayHours, $weekendHours, $hoursNote
        ]))));
        $price = priceAmount(requiredCsvValue($cafe, 'price_for_two', 'cafes'));
        $status = requiredCsvValue($cafe, 'status', 'cafes');
        if (!in_array($status, ['draft', 'published', 'archived'], true)) {
            throw new RuntimeException("Cafe {$sourceId} has an invalid status.");
        }

        $cafeCuisineNames = $cuisineLinksByCafe[$sourceId] ?? [];
        $cuisineNames = array_map(
            static fn (string $cuisineSourceId): string => $cuisineNamesBySourceId[$cuisineSourceId],
            $cafeCuisineNames
        );

        $insertCafe->execute([
            $cafeId,
            (int) $sourceId,
            $name,
            $areaIds[$areaSourceId],
            requiredCsvValue($cafe, 'address', 'cafes'),
            implode(', ', $cuisineNames),
            $niche,
            $timing,
            $weekdayHours,
            $weekendHours,
            $hoursNote,
            requiredCsvValue($cafe, 'contact_number', 'cafes'),
            '₹' . number_format($price, 0),
            $price,
            requiredCsvValue($cafe, 'vibe', 'cafes'),
            requiredCsvValue($cafe, 'more_info', 'cafes'),
            requiredCsvValue($cafe, 'maps_url', 'cafes'),
            $status
        ]);
        $sourceCafeIds[$sourceId] = $cafeId;

        $deleteCafeCuisines->execute([$cafeId]);
        foreach ($cafeCuisineNames as $cuisineSourceId) {
            $insertCafeCuisine->execute([$cafeId, $cuisineIds[$cuisineSourceId]]);
        }

        $deleteCafeAmenities->execute([$cafeId]);
        foreach ($amenityLinksByCafe[$sourceId] ?? [] as $link) {
            $amenitySourceId = (string) $link['amenity_id'];
            $available = filter_var($link['is_available'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($available === null && !in_array($link['is_available'], ['0', '1'], true)) {
                throw new RuntimeException("Invalid amenity availability for cafe {$sourceId}.");
            }
            $insertCafeAmenity->execute([$cafeId, $amenityIds[$amenitySourceId], $available ? 1 : 0]);
        }
    }

    $pdo->exec('DELETE FROM area_sources');
    $areaIdList = array_values(array_unique(array_values($areaIds)));
    $unusedAreas = $pdo->prepare(
        'DELETE FROM areas
         WHERE area_id NOT IN (' . implode(',', array_fill(0, count($areaIdList), '?')) . ')
           AND NOT EXISTS (SELECT 1 FROM cafes WHERE cafes.area_id = areas.area_id)'
    );
    $unusedAreas->execute($areaIdList);

    $insertImage = $pdo->prepare(
        'INSERT IGNORE INTO image_catalog (restaurant_name, image_url, local_file, source_status)
         VALUES (?, ?, ?, ?)'
    );
    foreach ($catalog as $image) {
        if (trim((string) ($image['image_url'] ?? '')) === '') {
            continue;
        }
        $insertImage->execute([
            $image['restaurant'] ?? '',
            $image['image_url'],
            $image['local_file'] ?? '',
            $image['status'] ?? ''
        ]);
    }

    $insertFeatured = $pdo->prepare(
        'INSERT IGNORE INTO homepage_featured_cafes (cafe_id, position) VALUES (?, ?)'
    );
    foreach (array_slice(array_values($sourceCafeIds), 0, 6) as $index => $cafeId) {
        $insertFeatured->execute([$cafeId, $index + 1]);
    }

    $pdo->commit();
    fwrite(STDOUT, sprintf(
        "Imported %d areas, %d cafes, %d cuisines, %d amenities, %d cafe-cuisine links, and %d cafe-amenity links. Catalog images available: %d.\n",
        count($areas),
        count($cafes),
        count($cuisines),
        count($amenities),
        count($cafeCuisines),
        count($cafeAmenities),
        (int) $pdo->query('SELECT COUNT(*) FROM image_catalog')->fetchColumn()
    ));
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
