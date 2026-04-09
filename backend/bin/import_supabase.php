<?php

declare(strict_types=1);

use App\Config;
use App\Database;
use App\SupabaseImporter;

require_once dirname(__DIR__) . '/bootstrap.php';

try {
    $config = Config::load(dirname(__DIR__, 2));
    $database = new Database($config);
    $importer = new SupabaseImporter($config, $database);
    $summary = $importer->run();
    echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage() . PHP_EOL);
    exit(1);
}
