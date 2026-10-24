<?php

// Lightweight built-in server router for WHERE?
// Supports clean folders (html/, css/, js/, assets/)
// Run with: php -S localhost:8000 router.php

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

function whereLocate(string $rel): ?string {
    $rel = ltrim($rel, '/');
    $basename = basename($rel);
    $candidates = [
        __DIR__ . '/' . $rel,
        __DIR__ . '/html/' . $rel,
        __DIR__ . '/css/' . $rel,
        __DIR__ . '/js/' . $rel,
        __DIR__ . '/assets/' . $rel,
        __DIR__ . '/html/' . $basename,
        __DIR__ . '/css/' . $basename,
        __DIR__ . '/js/' . $basename,
        __DIR__ . '/assets/' . $basename,
    ];
    foreach ($candidates as $candidate) {
        if (is_file($candidate)) {
            return $candidate;
        }
    }
    return null;
}

// 1. If a real static file or PHP script exists directly, let built-in server handle it (except /cafe.html)
$directFile = __DIR__ . $uri;
if ($uri !== '/' && $uri !== '/cafe.html' && is_file($directFile)) {
    return false;
}

// 2. Static asset handling (css, js, images, media)
$extension = pathinfo($uri, PATHINFO_EXTENSION);
if ($extension && in_array(strtolower($extension), ['css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'mp4', 'ico', 'woff', 'woff2', 'json', 'map'], true)) {
    $found = whereLocate($uri);
    if ($found) {
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
        readfile($found);
        exit;
    }
    http_response_code(404);
    echo 'Asset not found: ' . htmlspecialchars($uri);
    exit;
}

// 3. Route: / or /home -> index.html
if ($uri === '/' || $uri === '/index.html' || $uri === '/home') {
    $page = whereLocate('index.html');
    if ($page) {
        require $page;
        exit;
    }
}

// 4. Route: /admin -> admin.html
if ($uri === '/admin' || $uri === '/admin/' || $uri === '/admin.html') {
    $page = whereLocate('admin.html');
    if ($page) {
        require $page;
        exit;
    }
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
    $page = whereLocate('cafe.html');
    if ($page) {
        require $page;
        exit;
    }
}

// 6. Clean Discovery Routing:
// /surat or /surat/all-spots -> explore.html
// /surat/{area_slug} -> explore.html?area={area_slug}
// /surat/{area_slug}/{cafe_slug} -> cafe.html
$trimmed = trim($uri, '/');
$parts = explode('/', $trimmed);

if ($parts[0] === 'surat') {
    $explorePage = whereLocate('explore.html');
    $cafePage = whereLocate('cafe.html');

    if (count($parts) === 1 || $parts[1] === 'all' || $parts[1] === 'all-spots') {
        if ($explorePage) {
            require $explorePage;
            exit;
        }
    }

    if (count($parts) === 2) {
        $_GET['area'] = $parts[1];
        if ($explorePage) {
            require $explorePage;
            exit;
        }
    }

    if (count($parts) >= 3) {
        $_GET['area'] = $parts[1];
        $_GET['slug'] = $parts[2];
        if ($cafePage) {
            require $cafePage;
            exit;
        }
    }
}

// 7. General HTML page route (e.g. /about.html, /explore.html, /profile.html, /login.html, /signup.html)
$htmlFile = whereLocate($trimmed);
if ($htmlFile && str_ends_with(strtolower($htmlFile), '.html')) {
    require $htmlFile;
    exit;
}

// 8. Fallback to index.html
$indexPage = whereLocate('index.html');
if ($indexPage) {
    require $indexPage;
    exit;
}

return false;
