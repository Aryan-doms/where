<?php

require_once __DIR__ . '/../api/db.php';

try {
    $pdo = whereDb();
    $pdo->beginTransaction();

    echo "Starting area consolidation...\n";

    // 1. Rename 'Mota Varachha' (11) to 'Varachha'
    $pdo->prepare("
        UPDATE areas
        SET display_name = 'Varachha', slug = 'varachha', standardized_category = 'Surat / Varachha'
        WHERE area_id = 11
    ")->execute();
    echo "- Updated area 11 to Varachha\n";

    // 2. Rename 'Piplod (Dumas Road & Piplod)' (15) to 'Piplod'
    $pdo->prepare("
        UPDATE areas
        SET display_name = 'Piplod', slug = 'piplod', standardized_category = 'Surat / Piplod'
        WHERE area_id = 15
    ")->execute();
    echo "- Updated area 15 to Piplod\n";

    // 3. Rename 'Vesu (VIP Road & Vesu)' (18) to 'Vesu'
    $pdo->prepare("
        UPDATE areas
        SET display_name = 'Vesu', slug = 'vesu', standardized_category = 'Surat / Vesu'
        WHERE area_id = 18
    ")->execute();
    echo "- Updated area 18 to Vesu\n";

    // 4. Merge Adajan (Anand Park) (2) -> Adajan (1)
    $stmt = $pdo->prepare("UPDATE cafes SET area_id = 1 WHERE area_id = 2");
    $stmt->execute();
    echo "- Reassigned " . $stmt->rowCount() . " cafes from Adajan (Anand Park) to Adajan\n";

    // 5. Move Kapodara (7) and Khajod (9) -> Jahangirpura (6)
    $stmt = $pdo->prepare("UPDATE cafes SET area_id = 6 WHERE area_id IN (7, 9)");
    $stmt->execute();
    echo "- Reassigned " . $stmt->rowCount() . " cafes from Kapodara & Khajod to Jahangirpura\n";

    // 6. Merge Nana Varachha (12) -> Varachha (11)
    $stmt = $pdo->prepare("UPDATE cafes SET area_id = 11 WHERE area_id = 12");
    $stmt->execute();
    echo "- Reassigned " . $stmt->rowCount() . " cafes from Nana Varachha to Varachha\n";

    // 7. Merge Palanpore (14) -> Pal (13)
    $stmt = $pdo->prepare("UPDATE cafes SET area_id = 13 WHERE area_id = 14");
    $stmt->execute();
    echo "- Reassigned " . $stmt->rowCount() . " cafes from Palanpore to Pal\n";

    // 8. Move Utran (17) -> Varachha (11)
    $stmt = $pdo->prepare("UPDATE cafes SET area_id = 11 WHERE area_id = 17");
    $stmt->execute();
    echo "- Reassigned " . $stmt->rowCount() . " cafes from Utran to Varachha\n";

    // 9. Move Salabatpura (16) -> Athwa (3)
    $stmt = $pdo->prepare("UPDATE cafes SET area_id = 3 WHERE area_id = 16");
    $stmt->execute();
    echo "- Reassigned " . $stmt->rowCount() . " cafes from Salabatpura to Athwa\n";

    // 10. Delete merged/removed areas: 2, 7, 9, 12, 14, 16, 17
    $deleteIds = [2, 7, 9, 12, 14, 16, 17];
    $inClause = implode(',', $deleteIds);
    $pdo->prepare("DELETE FROM area_sources WHERE area_id IN ($inClause)")->execute();
    $stmt = $pdo->prepare("DELETE FROM areas WHERE area_id IN ($inClause)");
    $stmt->execute();
    echo "- Deleted " . $stmt->rowCount() . " obsolete area rows (IDs: $inClause)\n";

    $pdo->commit();
    echo "Area consolidation completed successfully!\n";

    // Display summary of remaining areas
    $summary = $pdo->query("
        SELECT a.area_id, a.display_name, a.slug, COUNT(c.id) AS spot_count
        FROM areas a
        LEFT JOIN cafes c ON c.area_id = a.area_id
        GROUP BY a.area_id, a.display_name, a.slug
        ORDER BY a.display_name
    ")->fetchAll(PDO::FETCH_ASSOC);

    echo "\nConsolidated Areas:\n";
    foreach ($summary as $row) {
        echo sprintf(" - [%2d] %-15s (slug: %-15s) -> %d spots\n", $row['area_id'], $row['display_name'], $row['slug'], $row['spot_count']);
    }

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, "Migration failed: " . $e->getMessage() . "\n");
    exit(1);
}
