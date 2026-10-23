<?php

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Run this script from the command line.\n");
    exit(1);
}

require_once __DIR__ . '/../api/db.php';

function promptForValue(string $prompt): string
{
    fwrite(STDOUT, $prompt);
    $value = fgets(STDIN);
    if ($value === false) {
        throw new RuntimeException('No input was received.');
    }
    return trim($value);
}

$username = strtolower(trim((string) ($argv[1] ?? promptForValue('Admin username: '))));
$phone = trim((string) ($argv[2] ?? promptForValue('10-digit phone number: ')));
$password = (string) ($argv[3] ?? promptForValue('Admin password (input visible): '));

if (!preg_match('/^[a-z0-9_]{3,50}$/', $username)) {
    fwrite(STDERR, "Username must be 3-50 characters: letters, numbers, or underscore.\n");
    exit(1);
}
if (!preg_match('/^\d{10}$/', $phone)) {
    fwrite(STDERR, "Phone number must be exactly 10 digits without country code.\n");
    exit(1);
}
if (strlen($password) < 8) {
    fwrite(STDERR, "Password must be at least 8 characters.\n");
    exit(1);
}

try {
    $pdo = whereDb();
    $statement = $pdo->prepare(
        'INSERT INTO users (username, phone_number, password_hash, role)
         VALUES (?, ?, ?, "admin")'
    );
    $statement->execute([$username, $phone, password_hash($password, PASSWORD_DEFAULT)]);
    fwrite(STDOUT, "Administrator account created. Sign in at admin.html.\n");
} catch (PDOException $error) {
    fwrite(STDERR, $error->getCode() === '23000'
        ? "That username or phone number is already registered.\n"
        : "Could not create admin account: {$error->getMessage()}\n");
    exit(1);
}
