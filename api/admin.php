<?php

require_once __DIR__ . '/cafe-data.php';

function whereAdminDashboard(PDO $pdo): array
{
    $areas = $pdo->query(
        'SELECT DISTINCT a.area_id, a.display_name
         FROM areas a
         JOIN cafes c ON c.area_id = a.area_id
         ORDER BY a.display_name'
    )->fetchAll();
    $amenities = $pdo->query('SELECT amenity_key, display_name FROM amenities ORDER BY display_name')->fetchAll();
    $images = $pdo->query(
        'SELECT image_id, restaurant_name, image_url, local_file, source_status
         FROM image_catalog ORDER BY restaurant_name, image_id'
    )->fetchAll();
    $sections = $pdo->query(
        'SELECT section_key, title, body, media_path, link_label, link_url, sort_order, is_published
         FROM homepage_sections ORDER BY sort_order'
    )->fetchAll();
    $featured = $pdo->query(
        'SELECT cafe_id FROM homepage_featured_cafes ORDER BY position'
    )->fetchAll(PDO::FETCH_COLUMN);
    return [
        'cafes' => whereFetchCafes($pdo, false),
        'areas' => $areas,
        'amenities' => $amenities,
        'images' => $images,
        'sections' => $sections,
        'featured' => $featured
    ];
}

function whereAdminString(array $data, string $key, int $maxLength, bool $required = false): string
{
    $value = trim((string) ($data[$key] ?? ''));
    if ($required && $value === '') {
        whereJson(['error' => "The {$key} field is required."], 422);
    }
    if (whereTextLength($value) > $maxLength) {
        whereJson(['error' => "The {$key} field is too long."], 422);
    }
    return $value;
}

function whereSaveCafe(PDO $pdo, array $data): string
{
    $id = trim((string) ($data['id'] ?? ''));
    $name = whereAdminString($data, 'name', 255, true);
    $areaId = filter_var($data['area_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$areaId || !$pdo->query('SELECT 1 FROM areas WHERE area_id = ' . (int) $areaId)->fetchColumn()) {
        whereJson(['error' => 'Choose a valid area.'], 422);
    }
    $address = whereAdminString($data, 'address', 20000, true);
    $niche = whereAdminString($data, 'niche_type', 200, true);
    $vibe = whereAdminString($data, 'vibe', 20000);
    $cuisineSource = whereAdminString($data, 'cuisine_source', 20000);
    $timing = whereAdminString($data, 'timing', 20000);
    $weekdayHours = whereAdminString($data, 'weekday_hours', 255);
    $weekendHours = whereAdminString($data, 'weekend_hours', 255);
    $hoursNote = whereAdminString($data, 'hours_note', 20000);
    $contact = whereAdminString($data, 'contact', 100);
    $priceRange = whereAdminString($data, 'price_range', 100);
    $priceValue = trim((string) ($data['price_for_two'] ?? ''));
    $price = $priceValue === '' ? 0.0 : filter_var($priceValue, FILTER_VALIDATE_FLOAT);
    if ($price === false || $price < 0) {
        whereJson(['error' => 'Price for two must be a non-negative number.'], 422);
    }
    $mapsUrl = whereAdminString($data, 'maps_url', 500);
    $status = in_array($data['status'] ?? '', ['draft', 'published', 'archived'], true)
        ? $data['status']
        : 'draft';
    $moreInfo = whereAdminString($data, 'more_info', 20000);
    $cuisines = array_values(array_unique(array_filter(array_map(
        static fn ($item) => trim((string) $item),
        is_array($data['cuisines'] ?? null) ? $data['cuisines'] : []
    ))));

    $pdo->beginTransaction();
    try {
        if ($id === '') {
            $id = 'cafe-' . bin2hex(random_bytes(4));
            $statement = $pdo->prepare(
                'INSERT INTO cafes
                 (id, name, area_id, location, cuisine_source, niche_type, timing,
                  weekday_hours, weekend_hours, hours_note, contact_details_number,
                  price_range, price_for_two, vibe_ambiance, more_info, maps_url, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $statement->execute([
                $id, $name, $areaId, $address, $cuisineSource, $niche, $timing,
                $weekdayHours, $weekendHours, $hoursNote, $contact, $priceRange,
                $price, $vibe, $moreInfo, $mapsUrl, $status
            ]);
        } else {
            $statement = $pdo->prepare(
                'UPDATE cafes SET name = ?, area_id = ?, location = ?, cuisine_source = ?,
                 niche_type = ?, timing = ?, weekday_hours = ?, weekend_hours = ?,
                 hours_note = ?, contact_details_number = ?, price_range = ?, price_for_two = ?,
                 vibe_ambiance = ?, more_info = ?, maps_url = ?, status = ?
                 WHERE id = ?'
            );
            $statement->execute([
                $name, $areaId, $address, $cuisineSource, $niche, $timing,
                $weekdayHours, $weekendHours, $hoursNote, $contact, $priceRange,
                $price, $vibe, $moreInfo, $mapsUrl, $status, $id
            ]);
            if ($statement->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT 1 FROM cafes WHERE id = ?');
                $exists->execute([$id]);
                if (!$exists->fetchColumn()) {
                    throw new RuntimeException('That cafe could not be found.');
                }
            }
        }

        $pdo->prepare('DELETE FROM cafe_cuisines WHERE cafe_id = ?')->execute([$id]);
        $insertCuisine = $pdo->prepare(
            'INSERT INTO cuisines (name) VALUES (?) ON DUPLICATE KEY UPDATE name = VALUES(name)'
        );
        $findCuisine = $pdo->prepare('SELECT cuisine_id FROM cuisines WHERE name = ?');
        $linkCuisine = $pdo->prepare('INSERT IGNORE INTO cafe_cuisines (cafe_id, cuisine_id) VALUES (?, ?)');
        foreach ($cuisines as $cuisine) {
            if (whereTextLength($cuisine) > 120) {
                throw new RuntimeException('Cuisine names must be 120 characters or fewer.');
            }
            $insertCuisine->execute([$cuisine]);
            $findCuisine->execute([$cuisine]);
            $linkCuisine->execute([$id, $findCuisine->fetchColumn()]);
        }

        $pdo->commit();
        return $id;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function whereSaveCafeAmenities(PDO $pdo, array $data): void
{
    $cafeId = (string) ($data['cafe_id'] ?? '');
    $exists = $pdo->prepare('SELECT 1 FROM cafes WHERE id = ?');
    $exists->execute([$cafeId]);
    if (!$exists->fetchColumn()) {
        whereJson(['error' => 'Choose a cafe first.'], 422);
    }

    $amenities = is_array($data['amenities'] ?? null) ? $data['amenities'] : [];
    $pdo->beginTransaction();
    try {
        foreach ($amenities as $amenity) {
            if (!is_array($amenity)) {
                continue;
            }
            $name = trim((string) ($amenity['name'] ?? ''));
            if ($name === '') {
                continue;
            }
            $key = whereAmenityKey($name);
            if (whereTextLength($name) > 100 || $key === '' || strlen($key) > 64) {
                whereJson(['error' => 'Amenity names must be 1-100 characters and contain at least one letter or number.'], 422);
            }
            $pdo->prepare(
                'INSERT INTO amenities (amenity_key, display_name) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)'
            )->execute([$key, $name]);
            $pdo->prepare(
                'INSERT INTO cafe_amenities (cafe_id, amenity_key, is_available) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE is_available = VALUES(is_available)'
            )->execute([$cafeId, $key, !empty($amenity['available']) ? 1 : 0]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function whereSaveCafeGallery(PDO $pdo, array $data): void
{
    $cafeId = (string) ($data['cafe_id'] ?? '');
    $exists = $pdo->prepare('SELECT 1 FROM cafes WHERE id = ?');
    $exists->execute([$cafeId]);
    if (!$exists->fetchColumn()) {
        whereJson(['error' => 'Choose a cafe first.'], 422);
    }
    $imageIds = array_values(array_unique(array_filter(array_map('intval', $data['image_ids'] ?? []))));
    if (count($imageIds) > 24) {
        whereJson(['error' => 'A cafe can have up to 24 gallery photos.'], 422);
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM cafe_images WHERE cafe_id = ?')->execute([$cafeId]);
        $insert = $pdo->prepare(
            'INSERT INTO cafe_images (cafe_id, image_id, alt_text, sort_order, is_cover)
             SELECT ?, image_id, ?, ?, ? FROM image_catalog WHERE image_id = ?'
        );
        foreach ($imageIds as $position => $imageId) {
            $insert->execute([$cafeId, '', $position, $position === 0 ? 1 : 0, $imageId]);
            if ($insert->rowCount() !== 1) {
                throw new RuntimeException('One of the selected photos is no longer available.');
            }
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function whereSaveHomepage(PDO $pdo, array $data): void
{
    $sections = is_array($data['sections'] ?? null) ? $data['sections'] : [];
    $pdo->beginTransaction();
    try {
        $saveSection = $pdo->prepare(
            'INSERT INTO homepage_sections
             (section_key, title, body, media_path, link_label, link_url, sort_order, is_published)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body),
             media_path = VALUES(media_path), link_label = VALUES(link_label),
             link_url = VALUES(link_url), sort_order = VALUES(sort_order),
             is_published = VALUES(is_published)'
        );
        foreach ($sections as $index => $section) {
            $key = (string) ($section['section_key'] ?? '');
            if (!in_array($key, ['hero', 'poster'], true)) {
                continue;
            }
            $saveSection->execute([
                $key,
                whereTextSlice(trim((string) ($section['title'] ?? '')), 255),
                trim((string) ($section['body'] ?? '')),
                whereTextSlice(trim((string) ($section['media_path'] ?? '')), 500),
                whereTextSlice(trim((string) ($section['link_label'] ?? '')), 100),
                whereTextSlice(trim((string) ($section['link_url'] ?? '')), 500),
                $index + 1,
                !empty($section['is_published']) ? 1 : 0
            ]);
        }

        $ids = array_values(array_unique(array_map('strval', $data['featured'] ?? [])));
        if (count($ids) > 12) {
            throw new RuntimeException('Choose no more than 12 featured cafes.');
        }
        $pdo->exec('DELETE FROM homepage_featured_cafes');
        $insertFeatured = $pdo->prepare(
            'INSERT INTO homepage_featured_cafes (cafe_id, position)
             SELECT id, ? FROM cafes WHERE id = ? AND status = "published"'
        );
        foreach ($ids as $index => $id) {
            $insertFeatured->execute([$index + 1, $id]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

whereStartSession();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$data = whereRequestData();
$action = (string) ($_GET['action'] ?? $data['action'] ?? '');

try {
    $pdo = whereDb();
    if ($method === 'GET' && $action === 'state') {
        $user = whereCurrentUser();
        whereJson(['user' => $user, 'csrf_token' => whereCsrfToken()]);
    }
    if ($method === 'GET' && $action === 'dashboard') {
        whereRequireUser(true);
        whereJson(whereAdminDashboard($pdo));
    }

    if ($method === 'POST' && $action === 'login') {
        whereRequireCsrf();
        $username = trim((string) ($data['username'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        $statement = $pdo->prepare(
            'SELECT user_id, username, role, password_hash FROM users WHERE username = ?'
        );
        $statement->execute([$username]);
        $user = $statement->fetch();
        if (!$user || $user['role'] !== 'admin' || !password_verify($password, $user['password_hash'])) {
            whereJson(['error' => 'Administrator username or password is incorrect.'], 401);
        }
        whereCreateSession($user);
        whereJson([
            'user' => whereCurrentUser(),
            'csrf_token' => whereCsrfToken()
        ]);
    }

    if ($method === 'POST' && $action === 'logout') {
        whereRequireUser(true);
        whereRequireCsrf();
        $_SESSION = [];
        session_destroy();
        whereJson(['ok' => true]);
    }

    $admin = whereRequireUser(true);
    whereRequireCsrf();

    if ($method !== 'POST') {
        whereJson(['error' => 'Unsupported request.'], 405);
    }

    switch ($action) {
        case 'save_cafe':
            whereJson(['ok' => true, 'cafe_id' => whereSaveCafe($pdo, $data)]);
        case 'save_amenities':
            whereSaveCafeAmenities($pdo, $data);
            whereJson(['ok' => true]);
        case 'save_gallery':
            whereSaveCafeGallery($pdo, $data);
            whereJson(['ok' => true]);
        case 'archive_cafe':
            $id = (string) ($data['cafe_id'] ?? '');
            $statement = $pdo->prepare('UPDATE cafes SET status = "archived" WHERE id = ?');
            $statement->execute([$id]);
            if (!$statement->rowCount()) {
                whereJson(['error' => 'Cafe not found or already archived.'], 404);
            }
            whereJson(['ok' => true]);
        case 'save_homepage':
            whereSaveHomepage($pdo, $data);
            whereJson(['ok' => true]);
        default:
            whereJson(['error' => 'Unknown CMS action.'], 400);
    }
} catch (PDOException $error) {
    error_log('WHERE? CMS database error for ' . $action . ': ' . $error->getMessage());
    whereJson(['error' => 'The database could not complete this CMS action. Check the selected values and try again.'], 500);
} catch (Throwable $error) {
    error_log('WHERE? CMS error for ' . $action . ': ' . $error->getMessage());
    whereJson(['error' => $error->getMessage()], 422);
}
