<?php

function whereDb(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $configPath = __DIR__ . '/config.php';
    $config = require (is_file($configPath) ? $configPath : __DIR__ . '/config.example.php');
    $host = getenv('WHERE_DB_HOST') ?: ($config['host'] ?? '127.0.0.1');
    $port = getenv('WHERE_DB_PORT') ?: ($config['port'] ?? 3307);
    $database = getenv('WHERE_DB_NAME') ?: ($config['database'] ?? 'cafecompass');
    $username = getenv('WHERE_DB_USER') ?: ($config['username'] ?? 'where');
    $password = getenv('WHERE_DB_PASSWORD') ?: ($config['password'] ?? '');

    $connection = new PDO(
        "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );

    return $connection;
}

function whereJson($value, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function whereTextLength(string $value): int
{
    preg_match_all('/./us', $value, $characters);
    return count($characters[0]);
}

function whereTextSlice(string $value, int $length): string
{
    preg_match_all('/./us', $value, $characters);
    return implode('', array_slice($characters[0], 0, $length));
}

function whereAmenityKey(string $name): string
{
    $key = strtolower(trim((string) preg_replace('/[^a-z0-9]+/i', '-', $name), '-'));
    return str_replace('wi-fi', 'wifi', $key);
}

function whereRequestData(): array
{
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : $_POST;
}

function whereStartSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'
    ]);
    session_start();
}

function whereCsrfToken(): string
{
    whereStartSession();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function whereRequireCsrf(): void
{
    whereStartSession();
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!$token || !hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
        whereJson(['error' => 'The request expired. Refresh the page and try again.'], 419);
    }
}

function whereCurrentUser(): ?array
{
    whereStartSession();
    return isset($_SESSION['user_id']) ? [
        'user_id' => (int) $_SESSION['user_id'],
        'username' => (string) $_SESSION['username'],
        'role' => (string) $_SESSION['role']
    ] : null;
}

function whereRequireUser(bool $admin = false): array
{
    $user = whereCurrentUser();
    if (!$user || ($admin && $user['role'] !== 'admin')) {
        whereJson(['error' => $admin ? 'Administrator sign-in is required.' : 'Please sign in first.'], 401);
    }
    return $user;
}

function whereCreateSession(array $user): void
{
    whereStartSession();
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['user_id'];
    $_SESSION['username'] = (string) $user['username'];
    $_SESSION['role'] = (string) $user['role'];
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
