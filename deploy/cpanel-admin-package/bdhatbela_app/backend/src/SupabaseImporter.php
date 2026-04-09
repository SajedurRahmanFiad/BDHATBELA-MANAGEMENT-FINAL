<?php

declare(strict_types=1);

namespace App;

use RuntimeException;

final class SupabaseImporter
{
    private const BATCH_SIZE = 1000;
    private const TABLES = [
        'users',
        'customers',
        'vendors',
        'products',
        'accounts',
        'categories',
        'payment_methods',
        'units',
        'company_settings',
        'order_settings',
        'invoice_settings',
        'system_defaults',
        'courier_settings',
        'payroll_settings',
        'orders',
        'bills',
        'transactions',
        'payroll_payments',
        'wallet_payouts',
        'wallet_entries',
    ];

    private Config $config;
    private Database $database;

    public function __construct(Config $config, Database $database)
    {
        $this->config = $config;
        $this->database = $database;
    }

    /**
     * @return array<string, int|string>
     */
    public function run(): array
    {
        $summary = ['tables' => 0, 'rows' => 0];
        try {
            $this->database->connectServer()->exec('SET GLOBAL max_allowed_packet = 134217728');
        } catch (\Throwable $exception) {
            // Ignore if the local MariaDB server disallows changing the packet size.
        }
        try {
            $this->database->connect()->exec('SET SESSION max_allowed_packet = 134217728');
        } catch (\Throwable $exception) {
            // Ignore if unsupported for the current MariaDB build.
        }
        $this->database->execute('SET FOREIGN_KEY_CHECKS = 0');

        try {
            foreach (self::TABLES as $table) {
                $rows = $this->fetchTableRows($table);
                $imported = $this->importTable($table, $rows);
                $summary[$table] = $imported;
                $summary['tables'] += 1;
                $summary['rows'] += $imported;
            }
        } finally {
            $this->database->execute('SET FOREIGN_KEY_CHECKS = 1');
        }

        return $summary;
    }

    /**
     * @return array<int, string>
     */
    public static function tables(): array
    {
        return self::TABLES;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchTableRows(string $table): array
    {
        $baseUrl = rtrim((string) ($this->config->get('VITE_SUPABASE_URL') ?? $this->config->get('SUPABASE_URL') ?? ''), '/');
        $serviceRoleKey = (string) ($this->config->get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
        if ($baseUrl === '' || $serviceRoleKey === '') {
            throw new RuntimeException('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for import.');
        }
        $offset = 0;
        $allRows = [];

        while (true) {
            $url = sprintf(
                '%s/rest/v1/%s?select=*&order=id.asc&limit=%d&offset=%d',
                $baseUrl,
                rawurlencode($table),
                self::BATCH_SIZE,
                $offset
            );

            $response = $this->request($url, [
                'apikey' => $serviceRoleKey,
                'Authorization' => 'Bearer ' . $serviceRoleKey,
                'Accept' => 'application/json',
            ]);

            if ($response['status'] < 200 || $response['status'] >= 300) {
                throw new RuntimeException("Supabase import failed for {$table}: HTTP {$response['status']} {$response['body']}");
            }

            $rows = $response['json'];
            if (!is_array($rows)) {
                throw new RuntimeException("Supabase import failed for {$table}: invalid JSON payload.");
            }

            $batchRows = [];
            foreach ($rows as $row) {
                if (is_array($row)) {
                    $batchRows[] = $row;
                }
            }

            $allRows = array_merge($allRows, $batchRows);
            if (count($batchRows) < self::BATCH_SIZE) {
                break;
            }

            $offset += self::BATCH_SIZE;
        }

        return $allRows;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     */
    private function importTable(string $table, array $rows): int
    {
        if ($rows === []) {
            return 0;
        }

        $columnsMeta = $this->tableColumns($table);
        $imported = 0;

        foreach ($rows as $row) {
            $filtered = [];
            foreach ($row as $column => $value) {
                if (!isset($columnsMeta[$column]) || ($columnsMeta[$column]['extra'] ?? '') === 'STORED GENERATED') {
                    continue;
                }

                $filtered[$column] = $this->coerceValue($value, $columnsMeta[$column]);
            }

            if ($filtered === []) {
                continue;
            }

            $columns = array_keys($filtered);
            $columnSql = implode(', ', $columns);
            $valueSql = implode(', ', array_map(static fn (string $column): string => ':' . $column, $columns));
            $updates = [];
            foreach ($columns as $column) {
                if ($column === 'id') {
                    continue;
                }
                $updates[] = $column . ' = VALUES(' . $column . ')';
            }

            $bindings = [];
            foreach ($filtered as $column => $value) {
                $bindings[':' . $column] = $value;
            }

            $sql = 'INSERT INTO ' . $table . ' (' . $columnSql . ') VALUES (' . $valueSql . ')';
            if ($updates !== []) {
                $sql .= ' ON DUPLICATE KEY UPDATE ' . implode(', ', $updates);
            }

            try {
                $this->database->execute($sql, $bindings);
            } catch (\Throwable $exception) {
                $rowId = (string) ($filtered['id'] ?? '');
                throw new RuntimeException(
                    sprintf('Import failed for table %s%s: %s', $table, $rowId !== '' ? ' row ' . $rowId : '', $exception->getMessage()),
                    0,
                    $exception
                );
            }
            $imported += 1;
        }

        return $imported;
    }

    /**
     * @return array<string, array<string, string>>
     */
    private function tableColumns(string $table): array
    {
        $rows = $this->database->fetchAll('SHOW COLUMNS FROM ' . $table);
        $columns = [];
        foreach ($rows as $row) {
            $columns[(string) $row['Field']] = [
                'type' => strtolower((string) ($row['Type'] ?? '')),
                'null' => (string) ($row['Null'] ?? 'YES'),
                'extra' => strtoupper((string) ($row['Extra'] ?? '')),
            ];
        }

        return $columns;
    }

    /**
     * @param array<string, string> $meta
     * @param mixed $value
     * @return mixed
     */
    private function coerceValue($value, array $meta)
    {
        if ($value === null) {
            return null;
        }

        $type = $meta['type'] ?? '';
        if (str_contains($type, 'tinyint(1)')) {
            return $value ? 1 : 0;
        }

        if (str_starts_with($type, 'date') && !str_starts_with($type, 'datetime')) {
            return $this->normalizeDateOnly((string) $value);
        }

        if (str_contains($type, 'datetime') || str_contains($type, 'timestamp')) {
            return $this->normalizeDateTime((string) $value);
        }

        if (is_array($value)) {
            return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        return $value;
    }

    private function normalizeDateOnly(string $value): ?string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed) === 1) {
            return $trimmed;
        }
        $timestamp = strtotime($trimmed);
        return $timestamp === false ? null : gmdate('Y-m-d', $timestamp);
    }

    private function normalizeDateTime(string $value): ?string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }
        $timestamp = strtotime($trimmed);
        return $timestamp === false ? null : gmdate('Y-m-d H:i:s', $timestamp);
    }

    /**
     * @return array{status:int, body:string, json:mixed}
     */
    private function request(string $url, array $headers): array
    {
        if (!function_exists('curl_init')) {
            throw new RuntimeException('cURL is required for the Supabase import script.');
        }

        $handle = curl_init($url);
        if ($handle === false) {
            throw new RuntimeException('Failed to initialize cURL.');
        }

        $headerList = [];
        foreach ($headers as $name => $value) {
            $headerList[] = $name . ': ' . $value;
        }

        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headerList,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_CONNECTTIMEOUT => 20,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        $body = curl_exec($handle);
        if ($body === false) {
            $message = curl_error($handle) ?: 'Unknown cURL error';
            curl_close($handle);
            throw new RuntimeException($message);
        }

        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);

        return [
            'status' => $status,
            'body' => $body,
            'json' => json_decode($body, true),
        ];
    }
}
