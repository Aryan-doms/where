<?php

require_once __DIR__ . '/../api/db.php';

function anyMatch(string $s1, string $s2, string $s3, array $arr): bool
{
    foreach ($arr as $k) {
        if (str_contains($s1, $k) || str_contains($s2, $k) || str_contains($s3, $k)) {
            return true;
        }
    }
    return false;
}

function assignNiche(array $c): string
{
    $name = mb_strtolower($c['name'] ?? '');
    $timing = mb_strtolower(($c['timing'] ?? '') . ' ' . ($c['weekday_hours'] ?? '') . ' ' . ($c['hours_note'] ?? ''));
    $price = (float)($c['price_for_two'] ?? 0);
    $oldNiche = mb_strtolower($c['niche_type'] ?? '');
    $vibe = mb_strtolower($c['vibe_ambiance'] ?? ($c['vibe'] ?? ''));
    $cuisine = mb_strtolower($c['cuisine_source'] ?? ($c['cuisine'] ?? ''));

    // 1. Matcha heads: boba, matcha, japanese, korean, anime, vietnamese
    if (anyMatch($name, $cuisine, $oldNiche, ['matcha', 'bubble tea', 'boba', 'korean', 'japanese', 'anime', 'vietnamese', 'caphe tra'])) {
        return 'matcha heads';
    }

    // 2. SRT OG: heritage Surat legends, travel cafe, crush coffee, brewberry, piplod classics, sports/games
    if (anyMatch($name, '', '', ['brewberry', 'crush coffee', '365 the travel', 'de meet', 'players sports', 'nitrox', 'coffee concept', 'trio beans', 'beans cafe', 'retro beans'])) {
        return 'SRT OG';
    }

    // 3. After hours: genuinely open past 1am / 2am / 3am / 4am
    if (preg_match('/(?<!1)1am|2am|3am|4am|1:00am|1:30am|2:00am|2:30am|3:00am/', $timing) && anyMatch($name, $timing, '', ['hemp', 'last order', 'yeti', 'capeybara', 'koe', 'unvind', 'delissio', 'pizza & frends', 'slice', 'sip', 'cuppuccino'])) {
        return 'after hours';
    }

    // 4. Open air: rooftop / garden / courtyard / al-fresco
    if (anyMatch($oldNiche, $vibe, $name, ['rooftop', 'sky lounge', 'botanical', 'al-fresco', 'garden', 'verandah', 'calista', 'meadows', 'white eye', 'roof', 'sky'])) {
        return 'open air';
    }

    // 5. Boujee: luxury, fine dining cafe, price >= 950
    if ($price >= 950 || str_contains($name, 'marriott') || str_contains($vibe, 'luxury') || str_contains($name, 'poetry') || str_contains($name, 'charcoal') || str_contains($name, 'mykonos')) {
        return 'boujee';
    }

    // 6. Whimsical: patisserie, dessert boutique, fairytale bakes
    if (anyMatch($oldNiche, $name, '', ['patisserie', 'bakehouse', 'dessert cafe', 'truffle', 'bakes & brew', 'hue', 'snowera', 'dessert'])) {
        return 'whimsical';
    }

    // 7. First light: breakfast, healthy, salad, early morning
    if (anyMatch($oldNiche, $cuisine, $timing, ['healthy', 'salad', '7:30am', '8:30am', 'lean bean', 'cave coffee', 'chptr', 'livestream'])) {
        return 'first light';
    }

    // 8. Coffee nerds: third-wave specialty, pour overs, roasteries
    if (anyMatch($oldNiche, $name, '', ['third-wave', 'roastery', 'covalent', 'torque', 'kohi', 'seeds', 'lower ground', 'kaffyn', 'brew you', 'coffee cartel', 'experience center'])) {
        return 'coffee nerds';
    }

    // 9. Hot girl place: aesthetic contemporary bistros, chic, mirror selfie vibe
    return 'hot girl place';
}

try {
    $pdo = whereDb();
    echo "Connected to database.\n";

    $cafes = $pdo->query('SELECT id, name, niche_type, price_for_two, timing, weekday_hours, weekend_hours, hours_note, vibe_ambiance, cuisine_source FROM cafes ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);

    $counts = [];
    $updateStmt = $pdo->prepare('UPDATE cafes SET niche_type = ? WHERE id = ?');
    $nameToNiche = [];
    $idToNiche = [];

    $pdo->beginTransaction();
    foreach ($cafes as $c) {
        $niche = assignNiche($c);
        $updateStmt->execute([$niche, $c['id']]);
        $counts[$niche] = ($counts[$niche] ?? 0) + 1;
        $nameToNiche[mb_strtolower($c['name'])] = $niche;
        $idToNiche[$c['id']] = $niche;
    }
    $pdo->commit();

    echo "Updated " . count($cafes) . " cafes in MySQL.\n";
    arsort($counts);
    foreach ($counts as $niche => $cnt) {
        echo sprintf("  %-15s: %d cafes\n", $niche, $cnt);
    }

    // 2. Update data/cafes.csv
    $dataFile = __DIR__ . '/../data/cafes.csv';
    if (file_exists($dataFile)) {
        $rows = array_map('str_getcsv', file($dataFile));
        $header = array_shift($rows);
        $nicheIdx = array_search('niche_type', $header, true);
        $nameIdx = array_search('name', $header, true);

        if ($nicheIdx !== false && $nameIdx !== false) {
            $fp = fopen($dataFile, 'w');
            fputcsv($fp, $header);
            foreach ($rows as $row) {
                if (empty($row) || count($row) < count($header)) continue;
                $nameKey = mb_strtolower($row[$nameIdx]);
                if (isset($nameToNiche[$nameKey])) {
                    $row[$nicheIdx] = $nameToNiche[$nameKey];
                }
                fputcsv($fp, $row);
            }
            fclose($fp);
            echo "Updated data/cafes.csv\n";
        }
    }

    // 3. Update database_import/cafes.csv if exists
    $importFile = __DIR__ . '/../database_import/cafes.csv';
    if (file_exists($importFile)) {
        $rows = array_map('str_getcsv', file($importFile));
        $header = array_shift($rows);
        $nicheIdx = array_search('niche_type', $header, true);
        $nameIdx = array_search('name', $header, true);

        if ($nicheIdx !== false && $nameIdx !== false) {
            $fp = fopen($importFile, 'w');
            fputcsv($fp, $header);
            foreach ($rows as $row) {
                if (empty($row) || count($row) < count($header)) continue;
                $nameKey = mb_strtolower($row[$nameIdx]);
                if (isset($nameToNiche[$nameKey])) {
                    $row[$nicheIdx] = $nameToNiche[$nameKey];
                }
                fputcsv($fp, $row);
            }
            fclose($fp);
            echo "Updated database_import/cafes.csv\n";
        }
    }

    // 4. Update surat_cafes_data.csv
    $suratFile = __DIR__ . '/../surat_cafes_data.csv';
    if (file_exists($suratFile)) {
        $rows = array_map('str_getcsv', file($suratFile));
        $header = array_shift($rows);
        $nicheIdx = array_search('Niche Type of Cafe', $header, true);
        $nameIdx = array_search('Name', $header, true);

        if ($nicheIdx !== false && $nameIdx !== false) {
            $fp = fopen($suratFile, 'w');
            fputcsv($fp, $header);
            foreach ($rows as $row) {
                if (empty($row) || count($row) < count($header)) continue;
                $nameKey = mb_strtolower($row[$nameIdx]);
                if (isset($nameToNiche[$nameKey])) {
                    $row[$nicheIdx] = $nameToNiche[$nameKey];
                }
                fputcsv($fp, $row);
            }
            fclose($fp);
            echo "Updated surat_cafes_data.csv\n";
        }
    }

    echo "Migration completed successfully.\n";

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "Migration error: " . $e->getMessage() . "\n";
    exit(1);
}
