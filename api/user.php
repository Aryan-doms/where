<?php

require_once __DIR__ . '/db.php';

whereStartSession();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$data = whereRequestData();
$action = (string) ($_GET['action'] ?? $data['action'] ?? '');

try {
    $pdo = whereDb();

    if ($method === 'GET' && $action === 'state') {
        $user = whereCurrentUser();
        if ($user) {
            $statement = $pdo->prepare(
                'SELECT phone_number, profile_image_path, created_at FROM users WHERE user_id = ?'
            );
            $statement->execute([$user['user_id']]);
            $profile = $statement->fetch() ?: [];
            $user['phone'] = $profile['phone_number'] ?? '';
            $user['profile_image'] = $profile['profile_image_path'] ?? '';
            $user['created_at'] = $profile['created_at'] ?? null;
        }
        whereJson(['user' => $user, 'csrf_token' => whereCsrfToken()]);
    }

    if ($method === 'POST' && $action === 'signup') {
        whereRequireCsrf();
        $username = strtolower(trim((string) ($data['username'] ?? '')));
        $phone = trim((string) ($data['phone'] ?? ''));
        $password = (string) ($data['password'] ?? '');

        // Validation for username, phone and password
        if (!preg_match('/^[a-z0-9_]{3,15}$/', $username)) {
            whereJson(['error' => 'Username must be 3-15 characters: letters, numbers, and underscores only.'], 422);
        }
        if (!preg_match('/^\d{10}$/', $phone)) {
            whereJson(['error' => 'Phone number must be exactly 10 digits (0-9).'], 422);
        }
        if (strlen($password) < 8 || !preg_match('/[a-zA-Z]/', $password) || !preg_match('/\d/', $password)) {
            whereJson(['error' => 'Password must be at least 8 characters and contain both letters and numbers.'], 422);
        }

        // Distinct duplicate checks with clear error messages
        $checkUser = $pdo->prepare('SELECT 1 FROM users WHERE username = ?');
        $checkUser->execute([$username]);
        if ($checkUser->fetchColumn()) {
            whereJson(['error' => 'This username is already taken. Please choose another username.'], 409);
        }

        $checkPhone = $pdo->prepare('SELECT 1 FROM users WHERE phone_number = ?');
        $checkPhone->execute([$phone]);
        if ($checkPhone->fetchColumn()) {
            whereJson(['error' => 'This phone number is already registered. Please log in or use another number.'], 409);
        }

        try {
            $statement = $pdo->prepare(
                'INSERT INTO users (username, phone_number, password_hash) VALUES (?, ?, ?)'
            );
            $statement->execute([$username, $phone, password_hash($password, PASSWORD_DEFAULT)]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                whereJson(['error' => 'That username or phone number is already registered.'], 409);
            }
            throw $error;
        }

        $newUserId = (int) $pdo->lastInsertId();
        whereCreateSession([
            'user_id' => $newUserId,
            'username' => $username,
            'role' => 'user'
        ]);
        whereJson([
            'user' => [
                'user_id' => $newUserId,
                'username' => $username,
                'phone' => $phone,
                'role' => 'user'
            ],
            'csrf_token' => whereCsrfToken()
        ]);
    }

    if ($method === 'POST' && $action === 'login') {
        whereRequireCsrf();
        $username = strtolower(trim((string) ($data['username'] ?? '')));
        $password = (string) ($data['password'] ?? '');
        $statement = $pdo->prepare(
            'SELECT user_id, username, role, password_hash FROM users WHERE username = ?'
        );
        $statement->execute([$username]);
        $user = $statement->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            whereJson(['error' => 'Username or password is incorrect.'], 401);
        }
        whereCreateSession($user);
        whereJson(['user' => whereCurrentUser(), 'csrf_token' => whereCsrfToken()]);
    }

    if ($method === 'POST' && $action === 'logout') {
        whereRequireUser();
        whereRequireCsrf();
        $_SESSION = [];
        session_destroy();
        whereJson(['ok' => true]);
    }

    if ($method === 'GET' && $action === 'reviews') {
        $cafeId = trim((string) ($_GET['cafe_id'] ?? ''));
        $statement = $pdo->prepare(
            'SELECT r.review_id, r.review_text AS message, r.created_at, u.username AS name
             FROM reviews r JOIN users u ON u.user_id = r.user_id
             WHERE r.cafe_id = ? ORDER BY r.created_at DESC'
        );
        $statement->execute([$cafeId]);
        whereJson(['reviews' => $statement->fetchAll()]);
    }

    $user = whereRequireUser();
    if ($method === 'GET' && $action === 'favorites') {
        $statement = $pdo->prepare('SELECT cafe_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC');
        $statement->execute([$user['user_id']]);
        whereJson(['favorites' => $statement->fetchAll(PDO::FETCH_COLUMN)]);
    }

    if ($method !== 'POST') {
        whereJson(['error' => 'Unsupported request.'], 405);
    }
    whereRequireCsrf();

    if ($action === 'toggle_favorite') {
        $cafeId = trim((string) ($data['cafe_id'] ?? ''));
        $pdo->beginTransaction();
        $statement = $pdo->prepare('SELECT 1 FROM favorites WHERE user_id = ? AND cafe_id = ?');
        $statement->execute([$user['user_id'], $cafeId]);
        if ($statement->fetchColumn()) {
            $pdo->prepare('DELETE FROM favorites WHERE user_id = ? AND cafe_id = ?')
                ->execute([$user['user_id'], $cafeId]);
            $saved = false;
        } else {
            $exists = $pdo->prepare('SELECT 1 FROM cafes WHERE id = ? AND status = "published"');
            $exists->execute([$cafeId]);
            if (!$exists->fetchColumn()) {
                $pdo->rollBack();
                whereJson(['error' => 'Cafe not found.'], 404);
            }
            $pdo->prepare('INSERT INTO favorites (user_id, cafe_id) VALUES (?, ?)')
                ->execute([$user['user_id'], $cafeId]);
            $saved = true;
        }
        $pdo->commit();
        whereJson(['saved' => $saved]);
    }

    if ($action === 'add_review') {
        $cafeId = trim((string) ($data['cafe_id'] ?? ''));
        $message = trim((string) ($data['message'] ?? ''));
        preg_match_all('/./us', $message, $characters);
        if ($message === '' || count($characters[0]) > 280) {
            whereJson(['error' => 'Reviews must be between 1 and 280 characters.'], 422);
        }
        $exists = $pdo->prepare('SELECT 1 FROM cafes WHERE id = ? AND status = "published"');
        $exists->execute([$cafeId]);
        if (!$exists->fetchColumn()) {
            whereJson(['error' => 'Cafe not found.'], 404);
        }
        $statement = $pdo->prepare(
            'INSERT INTO reviews (cafe_id, user_id, review_text) VALUES (?, ?, ?)'
        );
        $statement->execute([$cafeId, $user['user_id'], $message]);
        whereJson(['ok' => true, 'review_id' => $pdo->lastInsertId()]);
    }

    whereJson(['error' => 'Unknown account action.'], 400);
} catch (PDOException $error) {
    error_log('WHERE? account database error for ' . $action . ': ' . $error->getMessage());
    whereJson(['error' => 'The account request could not be completed. Check Docker MySQL and try again.'], 500);
}
