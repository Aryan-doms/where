<?php

ob_start();
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
ini_set('display_errors', '0');

require_once __DIR__ . '/cafe-data.php';

function whereSyncLocalImages(PDO $pdo): void
{
    $dir = dirname(__DIR__) . '/assets/cafe-images';
    if (!is_dir($dir)) {
        return;
    }
    $files = scandir($dir);
    if (!$files) {
        return;
    }
    $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    $check = $pdo->prepare('SELECT 1 FROM image_catalog WHERE image_url = ? OR local_file = ? LIMIT 1');
    $insert = $pdo->prepare(
        'INSERT INTO image_catalog (restaurant_name, image_url, local_file, source_status)
         VALUES (?, ?, ?, "local_file")'
    );
    foreach ($files as $file) {
        if ($file === '.' || $file === '..' || $file[0] === '.') {
            continue;
        }
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowed, true)) {
            continue;
        }
        $rel = 'assets/cafe-images/' . $file;
        $check->execute([$rel, $rel]);
        if (!$check->fetchColumn()) {
            $name = ucwords(str_replace(['-', '_'], ' ', pathinfo($file, PATHINFO_FILENAME)));
            $insert->execute([$name, $rel, $rel]);
        }
    }
}

function whereUploadImage(PDO $pdo, array $data): array
{
    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        $msg = 'No image file uploaded or an upload error occurred.';
        if (isset($_FILES['image'])) {
            switch ($_FILES['image']['error']) {
                case UPLOAD_ERR_INI_SIZE:
                case UPLOAD_ERR_FORM_SIZE:
                    $msg = 'The image file exceeds the maximum allowed size (15MB).';
                    break;
                case UPLOAD_ERR_NO_FILE:
                    $msg = 'Please select an image file to upload.';
                    break;
            }
        }
        whereJson(['error' => $msg], 422);
    }

    $tmpPath = $_FILES['image']['tmp_name'];
    $fileSize = $_FILES['image']['size'];

    if ($fileSize > 15 * 1024 * 1024) {
        whereJson(['error' => 'Image file must be 15MB or smaller.'], 422);
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $tmpPath);

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/pjpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif'
    ];

    if (!isset($allowed[$mime])) {
        whereJson(['error' => 'Only JPG, PNG, and WebP image formats are supported.'], 422);
    }
    $ext = $allowed[$mime];

    $uploadDir = dirname(__DIR__) . '/assets/cafe-images';
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            whereJson(['error' => 'Failed to prepare upload destination folder.'], 500);
        }
    }

    $cafeId = trim((string) ($data['cafe_id'] ?? $_POST['cafe_id'] ?? ''));
    $cafeName = '';
    if ($cafeId !== '') {
        $cStmt = $pdo->prepare('SELECT name FROM cafes WHERE id = ?');
        $cStmt->execute([$cafeId]);
        $cafeName = (string) $cStmt->fetchColumn();
    }

    $restaurantName = trim((string) ($data['restaurant_name'] ?? $_POST['restaurant_name'] ?? ''));
    if ($restaurantName === '' && $cafeName !== '') {
        $restaurantName = $cafeName;
    }
    if ($restaurantName === '') {
        $restaurantName = 'Local Upload';
    }

    $origName = pathinfo($_FILES['image']['name'], PATHINFO_FILENAME);
    $cleanSlug = whereSlugify($origName);
    if ($cleanSlug === '' || $cleanSlug === 'spot') {
        $cleanSlug = 'photo';
    }
    $prefix = $cafeId !== '' ? whereSlugify($cafeId) . '_' : '';
    $filename = $prefix . $cleanSlug . '_' . time() . '_' . bin2hex(random_bytes(3)) . '.' . $ext;
    $targetPath = $uploadDir . '/' . $filename;

    if (!move_uploaded_file($tmpPath, $targetPath)) {
        whereJson(['error' => 'Failed to save uploaded file to assets/cafe-images/.'], 500);
    }

    $relativeUrl = 'assets/cafe-images/' . $filename;

    $insert = $pdo->prepare(
        'INSERT INTO image_catalog (restaurant_name, image_url, local_file, source_status)
         VALUES (?, ?, ?, "local_upload")'
    );
    $insert->execute([$restaurantName, $relativeUrl, $relativeUrl]);
    $imageId = (int) $pdo->lastInsertId();

    if ($cafeId !== '' && $cafeName !== '') {
        $orderStmt = $pdo->prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 FROM cafe_images WHERE cafe_id = ?');
        $orderStmt->execute([$cafeId]);
        $nextOrder = (int) $orderStmt->fetchColumn();

        $hasCoverStmt = $pdo->prepare('SELECT 1 FROM cafe_images WHERE cafe_id = ? AND is_cover = 1 LIMIT 1');
        $hasCoverStmt->execute([$cafeId]);
        $hasCover = (bool) $hasCoverStmt->fetchColumn();

        $linkStmt = $pdo->prepare(
            'INSERT INTO cafe_images (cafe_id, image_id, alt_text, sort_order, is_cover)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE alt_text = VALUES(alt_text)'
        );
        $linkStmt->execute([$cafeId, $imageId, $restaurantName, $nextOrder, $hasCover ? 0 : 1]);
    }

    return [
        'image_id' => $imageId,
        'restaurant_name' => $restaurantName,
        'image_url' => $relativeUrl,
        'local_file' => $relativeUrl,
        'source_status' => 'local_upload'
    ];
}

function whereAdminDashboard(PDO $pdo): array
{
    whereSyncLocalImages($pdo);
    $areas = $pdo->query(
        'SELECT a.area_id, a.display_name, a.slug,
                (SELECT COUNT(*) FROM cafes c WHERE c.area_id = a.area_id) AS cafe_count
         FROM areas a
         ORDER BY a.display_name'
    )->fetchAll();
    $amenities = $pdo->query('SELECT amenity_key, display_name FROM amenities ORDER BY display_name')->fetchAll();
    $images = $pdo->query(
        'SELECT image_id, restaurant_name, image_url, local_file, source_status
         FROM image_catalog ORDER BY image_id DESC'
    )->fetchAll();
    $sections = $pdo->query(
        'SELECT section_key, title, body, media_path, link_label, link_url, sort_order, is_published
         FROM homepage_sections ORDER BY sort_order'
    )->fetchAll();
    $featured = $pdo->query(
        'SELECT cafe_id FROM homepage_featured_cafes ORDER BY position'
    )->fetchAll(PDO::FETCH_COLUMN);

    $homepageAreas = [];
    try {
        $homepageAreas = $pdo->query(
            'SELECT ha.area_id, ha.position, ha.image_1, ha.image_2, ha.image_3,
                    a.display_name, a.slug
             FROM homepage_areas ha
             JOIN areas a ON a.area_id = ha.area_id
             ORDER BY ha.position ASC'
        )->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        $homepageAreas = [];
    }

    return [
        'cafes' => whereFetchCafes($pdo, false),
        'areas' => $areas,
        'amenities' => $amenities,
        'images' => $images,
        'sections' => $sections,
        'featured' => $featured,
        'homepage_areas' => $homepageAreas
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

function whereSlugify(string $text): string
{
    $text = mb_strtolower(trim($text), 'UTF-8');
    $text = preg_replace('/[^\p{L}\p{N}]+/u', '-', $text);
    return trim($text, '-') ?: 'spot';
}

function whereSaveCafe(PDO $pdo, array $data): string
{
    $id = trim((string) ($data['id'] ?? ''));
    $name = whereAdminString($data, 'name', 255, true);
    $slug = trim((string) ($data['slug'] ?? ''));
    if ($slug === '') {
        $slug = whereSlugify($name);
    } else {
        $slug = whereSlugify($slug);
    }

    // Ensure slug uniqueness
    $checkSlug = $pdo->prepare('SELECT id FROM cafes WHERE slug = ? AND id != ?');
    $baseSlug = $slug;
    $counter = 2;
    while (true) {
        $checkSlug->execute([$slug, $id]);
        if (!$checkSlug->fetchColumn()) {
            break;
        }
        $slug = $baseSlug . '-' . $counter;
        $counter++;
    }

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
                 (id, name, slug, area_id, location, cuisine_source, niche_type, timing,
                  weekday_hours, weekend_hours, hours_note, contact_details_number,
                  price_range, price_for_two, vibe_ambiance, more_info, maps_url, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $statement->execute([
                $id, $name, $slug, $areaId, $address, $cuisineSource, $niche, $timing,
                $weekdayHours, $weekendHours, $hoursNote, $contact, $priceRange,
                $price, $vibe, $moreInfo, $mapsUrl, $status
            ]);
        } else {
            $statement = $pdo->prepare(
                'UPDATE cafes SET name = ?, slug = ?, area_id = ?, location = ?, cuisine_source = ?,
                 niche_type = ?, timing = ?, weekday_hours = ?, weekend_hours = ?,
                 hours_note = ?, contact_details_number = ?, price_range = ?, price_for_two = ?,
                 vibe_ambiance = ?, more_info = ?, maps_url = ?, status = ?
                 WHERE id = ?'
            );
            $statement->execute([
                $name, $slug, $areaId, $address, $cuisineSource, $niche, $timing,
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
    $coverImageId = (int) ($data['cover_image_id'] ?? 0);
    if ($coverImageId === 0 && !empty($imageIds)) {
        $coverImageId = $imageIds[0];
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM cafe_images WHERE cafe_id = ?')->execute([$cafeId]);
        $insert = $pdo->prepare(
            'INSERT INTO cafe_images (cafe_id, image_id, alt_text, sort_order, is_cover)
             SELECT ?, image_id, ?, ?, ? FROM image_catalog WHERE image_id = ?'
        );
        foreach ($imageIds as $position => $imageId) {
            $isCover = ($imageId === $coverImageId) ? 1 : 0;
            $insert->execute([$cafeId, '', $position, $isCover, $imageId]);
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

        // Save selected 11 homepage areas & hover images (AREA DISCOVERY)
        if (isset($data['areas']) && is_array($data['areas'])) {
            $pdo->exec('DELETE FROM homepage_areas');
            $insertArea = $pdo->prepare(
                'INSERT INTO homepage_areas (area_id, position, image_1, image_2, image_3)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $pos = 1;
            foreach ($data['areas'] as $item) {
                $areaId = filter_var($item['area_id'] ?? null, FILTER_VALIDATE_INT);
                if (!$areaId) {
                    continue;
                }
                $img1 = trim((string) ($item['image_1'] ?? ''));
                $img2 = trim((string) ($item['image_2'] ?? ''));
                $img3 = trim((string) ($item['image_3'] ?? ''));
                $insertArea->execute([$areaId, $pos, $img1, $img2, $img3]);
                $pos++;
                if ($pos > 11) {
                    break;
                }
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

function whereSaveArea(PDO $pdo, array $data): array
{
    $areaId = filter_var($data['area_id'] ?? null, FILTER_VALIDATE_INT);
    $displayName = whereAdminString($data, 'display_name', 150, true);
    $slug = trim((string) ($data['slug'] ?? ''));
    if ($slug === '') {
        $slug = whereSlugify($displayName);
    } else {
        $slug = whereSlugify($slug);
    }

    $standardized = 'Surat / ' . $displayName;

    // Ensure slug uniqueness
    $checkSlug = $pdo->prepare('SELECT area_id FROM areas WHERE slug = ? AND area_id != ?');
    $checkSlug->execute([$slug, $areaId ?: 0]);
    if ($checkSlug->fetchColumn()) {
        whereJson(['error' => 'An area with this URL slug already exists.'], 422);
    }

    if ($areaId) {
        $stmt = $pdo->prepare('UPDATE areas SET display_name = ?, standardized_category = ?, slug = ? WHERE area_id = ?');
        $stmt->execute([$displayName, $standardized, $slug, $areaId]);
    } else {
        $stmt = $pdo->prepare('INSERT INTO areas (standardized_category, display_name, slug) VALUES (?, ?, ?)');
        $stmt->execute([$standardized, $displayName, $slug]);
        $areaId = (int) $pdo->lastInsertId();
    }

    $find = $pdo->prepare('SELECT a.area_id, a.display_name, a.slug, (SELECT COUNT(*) FROM cafes c WHERE c.area_id = a.area_id) AS cafe_count FROM areas a WHERE a.area_id = ?');
    $find->execute([$areaId]);
    return $find->fetch(PDO::FETCH_ASSOC);
}

function whereDeleteArea(PDO $pdo, array $data): void
{
    $areaId = filter_var($data['area_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$areaId) {
        whereJson(['error' => 'Invalid area ID.'], 422);
    }
    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM cafes WHERE area_id = ?');
    $countStmt->execute([$areaId]);
    $cafeCount = (int) $countStmt->fetchColumn();
    if ($cafeCount > 0) {
        whereJson(['error' => "Cannot delete area: {$cafeCount} cafe(s) are currently located in this area. Reassign them first."], 422);
    }
    $del = $pdo->prepare('DELETE FROM areas WHERE area_id = ?');
    $del->execute([$areaId]);
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
        case 'upload_image':
            $uploaded = whereUploadImage($pdo, $data);
            whereJson(['ok' => true, 'image' => $uploaded]);
        case 'add_image_url':
            $url = trim((string) ($data['image_url'] ?? ''));
            $restaurant = trim((string) ($data['restaurant_name'] ?? 'Custom Photo'));
            if (!filter_var($url, FILTER_VALIDATE_URL)) {
                whereJson(['error' => 'Please provide a valid image URL (http/https).'], 422);
            }
            $insert = $pdo->prepare(
                'INSERT INTO image_catalog (restaurant_name, image_url, source_status)
                 VALUES (?, ?, "admin_added")
                 ON DUPLICATE KEY UPDATE restaurant_name = VALUES(restaurant_name)'
            );
            $insert->execute([$restaurant, $url]);
            $find = $pdo->prepare('SELECT image_id, restaurant_name, image_url FROM image_catalog WHERE image_url = ?');
            $find->execute([$url]);
            $image = $find->fetch();
            whereJson(['ok' => true, 'image' => $image]);
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
        case 'save_area':
            whereJson(['ok' => true, 'area' => whereSaveArea($pdo, $data)]);
        case 'delete_area':
            whereDeleteArea($pdo, $data);
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
