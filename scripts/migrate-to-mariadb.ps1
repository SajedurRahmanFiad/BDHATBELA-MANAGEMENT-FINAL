param(
    [switch]$ImportFromSupabase,
    [switch]$StartBackend
)

$ErrorActionPreference = 'Stop'

Write-Host 'Applying MariaDB schema...'
php backend/bin/setup.php

if ($ImportFromSupabase) {
    Write-Host 'Importing Supabase data into MariaDB...'
    php backend/bin/import_supabase.php
}

if ($StartBackend) {
    Write-Host 'Starting PHP backend on http://127.0.0.1:8001'
    php -S 127.0.0.1:8001 -t backend/public
}
