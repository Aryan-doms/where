<?php

// Lightweight built-in server router for WHERE?
// Run with: php -S localhost:8000 router.php

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$file = __DIR__ . $uri;

// 1. If a real static file or PHP script exists directly, let the built-in server handle it (except /cafe.html so we can redirect legacy query strings)
if ($uri !== '/' && $uri !== '/cafe.html' && (is_file($file) || (is_dir($file) && is_file($file . '/index.html')))) {
    return false;
}

// 2. Prevent static asset subpaths (e.g. /surat/athwa/styles.css) from being captured as HTML routes
$extension = pathinfo($uri, PATHINFO_EXTENSION);
if ($extension && in_array(strtolower($extension), ['css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'mp4', 'ico', 'woff', 'woff2', 'json', 'map'], true)) {
    $fallback = __DIR__ . '/' . ltrim($uri, '/');
    if (is_file($fallback)) {
        return false;
    }
    $basename = basename($uri);
    $rootFile = __DIR__ . '/' . $basename;
    if (is_file($rootFile)) {
        $mimes = [
            'css' => 'text/css; charset=utf-8',
            'js' => 'application/javascript; charset=utf-8',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'svg' => 'image/svg+xml',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'mp4' => 'video/mp4',
            'json' => 'application/json; charset=utf-8',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
        ];
        header('Content-Type: ' . ($mimes[strtolower($extension)] ?? 'application/octet-stream'));
        readfile($rootFile);
        exit;
    }
    $assetsFile = __DIR__ . '/assets/' . $basename;
    if (is_file($assetsFile)) {
        $mimes = [
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'svg' => 'image/svg+xml',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
        ];
        header('Content-Type: ' . ($mimes[strtolower($extension)] ?? 'application/octet-stream'));
        readfile($assetsFile);
        exit;
    }
    http_response_code(404);
    echo 'Asset not found: ' . htmlspecialchars($uri);
    exit;
}

// 3. Route: / or /home -> index.html
if ($uri === '/' || $uri === '/index.html' || $uri === '/home') {
    require __DIR__ . '/index.html';
    exit;
}

// 4. Route: /admin -> admin.html
if ($uri === '/admin' || $uri === '/admin/') {
    require __DIR__ . '/admin.html';
    exit;
}

// 5. Redirect legacy ugly cafe URLs (/cafe.html?id=cafe-005...) to clean /surat/{area}/{slug}
if ($uri === '/cafe.html' || $uri === '/cafe') {
    $reqId = trim((string)($_GET['id'] ?? ''));
    $reqSlug = trim((string)($_GET['slug'] ?? ''));
    $reqArea = trim((string)($_GET['area'] ?? ''));

    if ($reqSlug !== '' && $reqArea !== '') {
        header('Location: /surat/' . rawurlencode($reqArea) . '/' . rawurlencode($reqSlug), true, 301);
        exit;
    }

    if ($reqId !== '' || $reqSlug !== '') {
        try {
            require_once __DIR__ . '/api/db.php';
            $pdo = whereDb();
            if ($reqId !== '') {
                $stmt = $pdo->prepare('SELECT c.slug, a.slug AS area_slug FROM cafes c JOIN areas a ON a.area_id = c.area_id WHERE c.id = ?');
                $stmt->execute([$reqId]);
            } else {
                $stmt = $pdo->prepare('SELECT c.slug, a.slug AS area_slug FROM cafes c JOIN areas a ON a.area_id = c.area_id WHERE c.slug = ?');
                $stmt->execute([$reqSlug]);
            }
            $found = $stmt->fetch();
            if ($found && !empty($found['slug']) && !empty($found['area_slug'])) {
                header('Location: /surat/' . rawurlencode($found['area_slug']) . '/' . rawurlencode($found['slug']), true, 301);
                exit;
            }
        } catch (Throwable $t) {
            // Fallback to serving cafe.html
        }
    }
    require __DIR__ . '/cafe.html';
    exit;
}

// 6. Clean Discovery Routing:
// 1. /surat or /surat/all-spots -> explore.html
// 2. /surat/{area_slug} -> explore.html?area={area_slug}
// 3. /surat/{area_slug}/{cafe_slug} -> cafe.html
$trimmed = trim($uri, '/');
$parts = explode('/', $trimmed);

if ($parts[0] === 'surat') {
    if (count($parts) === 1 || $parts[1] === 'all' || $parts[1] === 'all-spots') {
        require __DIR__ . '/explore.html';
        exit;
    }

    if (count($parts) === 2) {
        $_GET['area'] = $parts[1];
        require __DIR__ . '/explore.html';
        exit;
    }

    if (count($parts) >= 3) {
        $_GET['area'] = $parts[1];
        $_GET['slug'] = $parts[2];
        require __DIR__ . '/cafe.html';
        exit;
    }
}

// Fallback to index.html
if (is_file(__DIR__ . '/index.html')) {
    require __DIR__ . '/index.html';
    exit;
}

return false;
