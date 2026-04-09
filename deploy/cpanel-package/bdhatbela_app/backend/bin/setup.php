<?php

declare(strict_types=1);

use App\Config;
use App\Database;
use App\SchemaManager;
use App\SupabaseImporter;

require_once dirname(__DIR__) . '/bootstrap.php';

$config = Config::load(dirname(__DIR__, 2));
$database = new Database($config);
$schemaManager = new SchemaManager($config, $database);
$dbName = $schemaManager->databaseName();
$fresh = in_array('--fresh', $argv, true) || in_array('--reset', $argv, true);
$schemaManager->provision($fresh);

echo 'MariaDB schema applied successfully to ' . $dbName . ($fresh ? ' (fresh reset).' : '.') . "\n";

if (in_array('--import', $argv, true) || in_array('--with-import', $argv, true)) {
    $importer = new SupabaseImporter($config, $database);
    $summary = $importer->run();
    echo "Supabase import finished.\n";
    echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
}
