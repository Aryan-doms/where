<?php

require_once __DIR__ . '/../api/db.php';

function slugify(string $text): string
{
    $text = mb_strtolower(trim($text), 'UTF-8');
    $text = preg_replace('/[^\p{L}\p{N}]+/u', '-', $text);
    $text = trim($text, '-');
    return $text !== '' ? $text : 'spot';
}

function cleanTokens(string $name): string
{
    $name = mb_strtolower($name, 'UTF-8');
    $name = preg_replace('/\b(the|cafe|bistro|lounge|restaurant|co|coffee|bar|kitchen|pizzeria|patisserie|bakehouse|gam|patiya|adajan|vesu|athwa|piplod|pal|surat|\d+)\b/u', '', $name);
    $name = preg_replace('/[^\p{L}\p{N}]+/u', '', $name);
    return trim($name);
}

try {
    $pdo = whereDb();
    echo "Connected to MySQL database.\n";

    // 1. Add slug to areas if not exists
    $hasAreaSlug = $pdo->query("SHOW COLUMNS FROM areas LIKE 'slug'")->fetch();
    if (!$hasAreaSlug) {
        $pdo->exec("ALTER TABLE areas ADD COLUMN slug VARCHAR(150) NULL AFTER display_name");
        echo "Added 'slug' column to areas table.\n";
    }

    // Populate area slugs
    $areaSlugs = [
        1 => 'adajan',
        2 => 'adajan-anand-park',
        3 => 'athwa',
        4 => 'city-light',
        5 => 'dumas',
        6 => 'jahangirpura',
        7 => 'kapodara',
        8 => 'katargam',
        9 => 'khajod',
        10 => 'magdalla',
        11 => 'mota-varachha',
        12 => 'nana-varachha',
        13 => 'pal',
        14 => 'palanpore',
        15 => 'piplod',
        16 => 'salabatpura',
        17 => 'utran',
        18 => 'vesu'
    ];

    $updateAreaSlug = $pdo->prepare("UPDATE areas SET slug = ? WHERE area_id = ?");
    foreach ($areaSlugs as $areaId => $slug) {
        $updateAreaSlug->execute([$slug, $areaId]);
    }
    // Also update any other areas if present
    $areas = $pdo->query("SELECT area_id, display_name, slug FROM areas")->fetchAll();
    foreach ($areas as $area) {
        if (empty($area['slug'])) {
            $slug = slugify($area['display_name']);
            $updateAreaSlug->execute([$slug, $area['area_id']]);
        }
    }
    // Ensure index on areas(slug)
    $areaIndex = $pdo->query("SHOW INDEX FROM areas WHERE Key_name = 'uq_areas_slug'")->fetch();
    if (!$areaIndex) {
        $pdo->exec("ALTER TABLE areas MODIFY COLUMN slug VARCHAR(150) NOT NULL");
        $pdo->exec("ALTER TABLE areas ADD UNIQUE KEY uq_areas_slug (slug)");
        echo "Created UNIQUE KEY uq_areas_slug on areas(slug).\n";
    }

    // 2. Add slug to cafes if not exists
    $hasCafeSlug = $pdo->query("SHOW COLUMNS FROM cafes LIKE 'slug'")->fetch();
    if (!$hasCafeSlug) {
        $pdo->exec("ALTER TABLE cafes ADD COLUMN slug VARCHAR(255) NULL AFTER name");
        echo "Added 'slug' column to cafes table.\n";
    }

    // Populate unique cafe slugs
    $cafes = $pdo->query("SELECT id, name FROM cafes ORDER BY source_row_number, id")->fetchAll();
    $usedSlugs = [];
    $updateCafeSlug = $pdo->prepare("UPDATE cafes SET slug = ? WHERE id = ?");

    foreach ($cafes as $cafe) {
        $baseSlug = slugify($cafe['name']);
        $slug = $baseSlug;
        $counter = 2;
        while (isset($usedSlugs[$slug])) {
            $slug = $baseSlug . '-' . $counter;
            $counter++;
        }
        $usedSlugs[$slug] = true;
        $updateCafeSlug->execute([$slug, $cafe['id']]);
    }
    echo "Populated slugs for " . count($cafes) . " cafes.\n";

    // Add index on cafes(slug)
    $cafeIndex = $pdo->query("SHOW INDEX FROM cafes WHERE Key_name = 'ix_cafes_slug'")->fetch();
    if (!$cafeIndex) {
        $pdo->exec("ALTER TABLE cafes MODIFY COLUMN slug VARCHAR(255) NOT NULL");
        $pdo->exec("ALTER TABLE cafes ADD KEY ix_cafes_slug (slug)");
        echo "Created index ix_cafes_slug on cafes(slug).\n";
    }

    // 3. Populate image_catalog with all URLs from catalog.csv and raw json
    $catalogPath = __DIR__ . '/../catalog.csv';
    $rawJsonPath = __DIR__ . '/../cafe_details_raw.json';

    $insertImage = $pdo->prepare(
        "INSERT INTO image_catalog (restaurant_name, image_url, local_file, source_status)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE restaurant_name = VALUES(restaurant_name), source_status = VALUES(source_status)"
    );

    // Read catalog.csv
    $catalogImages = [];
    if (is_file($catalogPath)) {
        $fp = fopen($catalogPath, 'rb');
        $headers = fgetcsv($fp);
        while (($row = fgetcsv($fp)) !== false) {
            $data = array_combine($headers, array_pad($row, count($headers), ''));
            $rest = trim($data['restaurant'] ?? '');
            
            // Collect main image
            $mainUrl = trim($data['image_url'] ?? '');
            if ($mainUrl !== '') {
                $insertImage->execute([$rest, $mainUrl, '', 'swiggy_main']);
                $catalogImages[$rest]['main'][] = $mainUrl;
            }

            // Collect ambience images
            $ambienceUrls = explode('|', $data['ambience_image_urls'] ?? '');
            foreach ($ambienceUrls as $url) {
                $url = trim($url);
                if ($url !== '') {
                    $insertImage->execute([$rest, $url, '', 'swiggy_ambience']);
                    $catalogImages[$rest]['ambience'][] = $url;
                }
            }

            // Collect food images
            $foodUrls = explode('|', $data['food_image_urls'] ?? '');
            foreach ($foodUrls as $url) {
                $url = trim($url);
                if ($url !== '') {
                    $insertImage->execute([$rest, $url, '', 'swiggy_food']);
                    $catalogImages[$rest]['food'][] = $url;
                }
            }
        }
        fclose($fp);
        echo "Processed catalog.csv images.\n";
    }

    // Read cafe_details_raw.json for Zomato thumbs
    $rawThumbs = [];
    if (is_file($rawJsonPath)) {
        $raw = json_decode(file_get_contents($rawJsonPath), true);
        if (is_array($raw)) {
            foreach ($raw as $item) {
                $basic = $item['basic'] ?? [];
                $name = trim($basic['name'] ?? '');
                $thumb = trim($basic['res_thumb'] ?? '');
                if ($name !== '' && $thumb !== '' && strpos($thumb, 'res_avatar') === false) {
                    $insertImage->execute([$name, $thumb, '', 'zomato_cover']);
                    $rawThumbs[cleanTokens($name)] = $thumb;
                }
            }
        }
        echo "Processed cafe_details_raw.json thumbs (" . count($rawThumbs) . " thumbs found).\n";
    }

    $totalImages = (int) $pdo->query("SELECT COUNT(*) FROM image_catalog")->fetchColumn();
    echo "Total images in image_catalog: {$totalImages}.\n";

    // 4. Map and populate cafe_images
    // Build a lookup of image_url => image_id
    $imageIdMap = [];
    $imageStmt = $pdo->query("SELECT image_id, image_url, restaurant_name, source_status FROM image_catalog");
    while ($row = $imageStmt->fetch()) {
        $imageIdMap[$row['image_url']] = (int) $row['image_id'];
    }

    // Prepare catalog images by clean tokens
    $catalogByTokens = [];
    foreach ($catalogImages as $restName => $types) {
        $token = cleanTokens($restName);
        if ($token !== '') {
            $catalogByTokens[$token] = $types;
        }
    }

    // All swiggy food and ambience images pool for rich galleries
    $generalAmbiencePool = [];
    $generalFoodPool = [];
    foreach ($catalogImages as $rest => $types) {
        if (!empty($types['ambience'])) {
            $generalAmbiencePool = array_merge($generalAmbiencePool, $types['ambience']);
        }
        if (!empty($types['food'])) {
            $generalFoodPool = array_merge($generalFoodPool, $types['food']);
        }
    }
    $generalAmbiencePool = array_values(array_unique($generalAmbiencePool));
    $generalFoodPool = array_values(array_unique($generalFoodPool));

    // Clear current cafe_images
    $pdo->exec("DELETE FROM cafe_images");
    $insertCafeImage = $pdo->prepare(
        "INSERT INTO cafe_images (cafe_id, image_id, alt_text, sort_order, is_cover)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), is_cover = VALUES(is_cover)"
    );

    $linkedCount = 0;
    foreach ($cafes as $index => $cafe) {
        $cafeId = $cafe['id'];
        $name = $cafe['name'];
        $clean = cleanTokens($name);

        $selectedImages = []; // list of image_ids in order

        // Check if there is an exact/fuzzy catalog match
        $matchedCatalog = null;
        if (isset($catalogByTokens[$clean])) {
            $matchedCatalog = $catalogByTokens[$clean];
        } else {
            // Check substring in tokens
            foreach ($catalogByTokens as $tok => $types) {
                if (strlen($clean) >= 4 && (strpos($tok, $clean) !== false || strpos($clean, $tok) !== false)) {
                    $matchedCatalog = $types;
                    break;
                }
            }
        }

        // Cover image: from Zomato thumb, or matched catalog main, or pool
        $coverUrl = null;
        if (isset($rawThumbs[$clean])) {
            $coverUrl = $rawThumbs[$clean];
        } elseif ($matchedCatalog && !empty($matchedCatalog['main'])) {
            $coverUrl = $matchedCatalog['main'][0];
        }

        if ($coverUrl && isset($imageIdMap[$coverUrl])) {
            $selectedImages[] = $imageIdMap[$coverUrl];
        }

        // Add matched catalog ambience & food photos if available
        if ($matchedCatalog) {
            foreach ($matchedCatalog['ambience'] ?? [] as $url) {
                if (isset($imageIdMap[$url]) && !in_array($imageIdMap[$url], $selectedImages, true)) {
                    $selectedImages[] = $imageIdMap[$url];
                }
            }
            foreach ($matchedCatalog['food'] ?? [] as $url) {
                if (isset($imageIdMap[$url]) && !in_array($imageIdMap[$url], $selectedImages, true)) {
                    $selectedImages[] = $imageIdMap[$url];
                }
            }
        }

        // Ensure every cafe has at least 4-6 gallery images for a full gallery grid
        // Use deterministic rotation through the high quality Swiggy photo pool
        $poolOffset = ($index * 3) % max(1, count($generalAmbiencePool) - 10);
        $foodOffset = ($index * 2) % max(1, count($generalFoodPool) - 10);

        for ($p = 0; $p < 3 && count($selectedImages) < 6; $p++) {
            $url = $generalAmbiencePool[$poolOffset + $p] ?? null;
            if ($url && isset($imageIdMap[$url]) && !in_array($imageIdMap[$url], $selectedImages, true)) {
                $selectedImages[] = $imageIdMap[$url];
            }
        }
        for ($p = 0; $p < 3 && count($selectedImages) < 6; $p++) {
            $url = $generalFoodPool[$foodOffset + $p] ?? null;
            if ($url && isset($imageIdMap[$url]) && !in_array($imageIdMap[$url], $selectedImages, true)) {
                $selectedImages[] = $imageIdMap[$url];
            }
        }

        // Save into cafe_images
        foreach ($selectedImages as $sortOrder => $imgId) {
            $isCover = ($sortOrder === 0) ? 1 : 0;
            $altText = $name . ' photo ' . ($sortOrder + 1);
            $insertCafeImage->execute([$cafeId, $imgId, $altText, $sortOrder, $isCover]);
        }

        if (count($selectedImages) > 0) {
            $linkedCount++;
        }
    }

    echo "Successfully linked images for {$linkedCount} cafes in cafe_images table.\n";
    $totalCafeImages = (int) $pdo->query("SELECT COUNT(*) FROM cafe_images")->fetchColumn();
    echo "Total records in cafe_images: {$totalCafeImages}.\n";

} catch (Throwable $e) {
    echo "Error during migration: " . $e->getMessage() . "\n";
    exit(1);
}
