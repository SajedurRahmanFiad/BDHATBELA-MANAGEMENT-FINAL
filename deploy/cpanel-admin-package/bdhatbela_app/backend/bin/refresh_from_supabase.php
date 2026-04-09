<?php

declare(strict_types=1);

use App\Config;
use App\Database;
use App\SchemaManager;
use App\SupabaseImporter;

require_once dirname(__DIR__) . '/bootstrap.php';

try {
    $projectRoot = dirname(__DIR__, 2);
    $config = Config::load($projectRoot);
    $database = new Database($config);
    $schemaManager = new SchemaManager($config, $database);
    $importer = new SupabaseImporter($config, $database);

    $schemaManager->provision(true, null, false);
    $importSummary = $importer->run();

    $postImportPath = dirname(__DIR__) . '/database/post_import.sql';
    $postImportApplied = false;
    if (is_file($postImportPath)) {
        $schemaManager->runSqlFile($postImportPath);
        $postImportApplied = true;
    }

    $counts = [];
    foreach (SupabaseImporter::tables() as $table) {
        $row = $database->fetchOne('SELECT COUNT(*) AS count FROM ' . $table);
        $counts[$table] = (int) ($row['count'] ?? 0);
    }

    $summary = [
        'database' => $schemaManager->databaseName(),
        'refreshedAt' => gmdate('c'),
        'postImportSqlApplied' => $postImportApplied,
        'import' => $importSummary,
        'counts' => $counts,
    ];

    echo "Local MariaDB database rebuilt from Supabase successfully.\n";
    echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage() . PHP_EOL);
    exit(1);
}
