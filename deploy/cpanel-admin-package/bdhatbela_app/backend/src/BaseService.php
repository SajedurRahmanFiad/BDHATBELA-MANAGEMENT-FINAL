<?php

declare(strict_types=1);

namespace App;

abstract class BaseService
{
    protected const DEFAULT_PAGE_SIZE = 25;
    protected const DEFAULT_PAYROLL_STATUSES = ['On Hold', 'Processing', 'Picked', 'Completed', 'Cancelled'];
    protected const ORDER_STOCK_STATUSES = ['Processing', 'Picked', 'Completed'];
    protected const BILL_STOCK_STATUSES = ['Received', 'Paid'];
    protected const DEFAULT_WALLET_CUTOFF_DATE = '2026-04-01';
    protected const DEFAULT_WALLET_CUTOFF_AT_UTC = '2026-03-31 18:00:00';

    protected Database $database;
    protected Auth $auth;
    protected Config $config;

    public function __construct(Database $database, Auth $auth, Config $config)
    {
        $this->database = $database;
        $this->auth = $auth;
        $this->config = $config;
    }

    protected function currentUser(): array
    {
        return $this->auth->requireUser();
    }

    protected function requireAdmin(): array
    {
        return $this->auth->requireAdmin();
    }

    /**
     * @param array<int, string> $values
     * @return array{0: array<int, string>, 1: array<string, string>}
     */
    protected function inClause(array $values, string $prefix): array
    {
        $placeholders = [];
        $bindings = [];
        foreach (array_values($values) as $index => $value) {
            $name = ':' . $prefix . '_' . $index;
            $placeholders[] = $name;
            $bindings[$name] = $value;
        }

        return [$placeholders, $bindings];
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<string, array<string, mixed>>
     */
    protected function keyBy(array $rows, string $column): array
    {
        $map = [];
        foreach ($rows as $row) {
            $key = (string) ($row[$column] ?? '');
            if ($key !== '') {
                $map[$key] = $row;
            }
        }

        return $map;
    }

    protected function stringId($value): string
    {
        $string = trim((string) ($value ?? ''));
        if ($string !== '') {
            return $string;
        }

        return $this->uuid4();
    }

    protected function uuid4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }

    protected function normalizeDateOnly(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed) === 1) {
            return $trimmed;
        }

        $timestamp = strtotime($trimmed);
        return $timestamp === false ? '' : gmdate('Y-m-d', $timestamp);
    }

    protected function utcTimezone(): \DateTimeZone
    {
        static $timezone = null;
        if (!$timezone instanceof \DateTimeZone) {
            $timezone = new \DateTimeZone('UTC');
        }

        return $timezone;
    }

    protected function parseDateTimeValue(string $value, ?\DateTimeZone $naiveTimezone = null): ?\DateTimeImmutable
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        $timezone = $naiveTimezone ?? $this->utcTimezone();

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed) === 1) {
            $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $trimmed, $timezone);
            return $date instanceof \DateTimeImmutable ? $date : null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/', $trimmed) === 1) {
            $normalized = str_replace('T', ' ', $trimmed);
            $format = str_contains($normalized, '.') ? 'Y-m-d H:i:s.u' : 'Y-m-d H:i:s';
            $date = \DateTimeImmutable::createFromFormat($format, $normalized, $timezone);
            return $date instanceof \DateTimeImmutable ? $date : null;
        }

        try {
            return new \DateTimeImmutable($trimmed);
        } catch (\Exception) {
            return null;
        }
    }

    protected function normalizeDateTimeInput(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return $this->database->nowUtc();
        }

        $dateTime = $this->parseDateTimeValue($trimmed, $this->utcTimezone());
        return $dateTime instanceof \DateTimeImmutable
            ? $dateTime->setTimezone($this->utcTimezone())->format('Y-m-d H:i:s')
            : $this->database->nowUtc();
    }

    protected function normalizeDateTimeInputWithCurrentLocalTime(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return $this->database->nowUtc();
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed) === 1) {
            $localTimezone = new \DateTimeZone($this->config->timezone());
            $utcTimezone = new \DateTimeZone('UTC');
            $localNow = new \DateTimeImmutable('now', $localTimezone);
            $localDateTime = \DateTimeImmutable::createFromFormat(
                'Y-m-d H:i:s',
                $trimmed . ' ' . $localNow->format('H:i:s'),
                $localTimezone
            );

            if ($localDateTime instanceof \DateTimeImmutable) {
                return $localDateTime->setTimezone($utcTimezone)->format('Y-m-d H:i:s');
            }
        }

        return $this->normalizeDateTimeInput($trimmed);
    }

    protected function toIso(?string $value): ?string
    {
        $trimmed = trim((string) ($value ?? ''));
        if ($trimmed === '') {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed) === 1) {
            return $trimmed;
        }

        $dateTime = $this->parseDateTimeValue($trimmed, $this->utcTimezone());
        return $dateTime instanceof \DateTimeImmutable
            ? $dateTime->setTimezone($this->utcTimezone())->format('Y-m-d\TH:i:s\Z')
            : $trimmed;
    }

    /**
     * @param mixed $value
     */
    protected function money($value): float
    {
        return round((float) $value, 2);
    }

    protected function formatMoney($value): string
    {
        return number_format((float) $value, 2, '.', '');
    }

    /**
     * @param mixed $value
     */
    protected function nullableTrimmedString($value): ?string
    {
        $string = trim((string) ($value ?? ''));
        return $string === '' ? null : $string;
    }

    /**
     * @param mixed $value
     */
    protected function nullableString($value): ?string
    {
        if ($value === null) {
            return null;
        }

        $string = (string) $value;
        return $string === '' ? null : $string;
    }

    /**
     * @param mixed $value
     */
    protected function jsonEncode($value): ?string
    {
        if ($value === null) {
            return null;
        }

        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /**
     * @param mixed $value
     * @return array<int, mixed>
     */
    protected function jsonDecodeList($value): array
    {
        if (is_array($value)) {
            return array_values($value);
        }

        if ($value === null || trim((string) $value) === '') {
            return [];
        }

        $decoded = json_decode((string) $value, true);
        return is_array($decoded) ? array_values($decoded) : [];
    }

    /**
     * @param mixed $value
     * @return array<string, mixed>
     */
    protected function jsonDecodeAssoc($value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if ($value === null || trim((string) $value) === '') {
            return [];
        }

        $decoded = json_decode((string) $value, true);
        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @param array<string, mixed> $updates
     */
    protected function touchUpdate(string $table, string $id, array $updates): void
    {
        if ($updates === []) {
            return;
        }

        $updates['updated_at'] = $this->database->nowUtc();
        [$setClause, $bindings] = $this->database->buildSetClause($updates);
        $bindings[':id'] = $id;
        $this->database->execute("UPDATE {$table} SET {$setClause} WHERE id = :id", $bindings);
    }

    protected function softDelete(string $table, string $id): void
    {
        $actor = $this->currentUser();
        $deletedAt = $this->database->nowUtc();
        $this->database->execute(
            "UPDATE {$table} SET deleted_at = :deleted_at, deleted_by = :deleted_by, updated_at = :updated_at WHERE id = :id AND deleted_at IS NULL",
            [
                ':deleted_at' => $deletedAt,
                ':deleted_by' => (string) $actor['id'],
                ':updated_at' => $deletedAt,
                ':id' => $id,
            ]
        );
    }

    protected function restoreSoftDeletedRow(string $table, string $id): void
    {
        $this->database->execute(
            "UPDATE {$table} SET deleted_at = NULL, deleted_by = NULL, updated_at = :updated_at WHERE id = :id AND deleted_at IS NOT NULL",
            [
                ':updated_at' => $this->database->nowUtc(),
                ':id' => $id,
            ]
        );
    }

    protected function permanentlyDeleteSoftDeletedRow(string $table, string $id): void
    {
        $this->database->execute(
            "DELETE FROM {$table} WHERE id = :id AND deleted_at IS NOT NULL",
            [':id' => $id]
        );
    }

    protected function saveSingleton(string $table, string $id, array $updates, callable $resolver): array
    {
        $row = $this->database->fetchOne("SELECT id FROM {$table} LIMIT 1");
        $existingId = (string) ($row['id'] ?? $id);
        $filtered = [];

        foreach ($updates as $column => $value) {
            if ($value !== null) {
                $filtered[$column] = is_string($value) ? trim($value) : $value;
            }
        }

        if ($row !== null) {
            $this->touchUpdate($table, $existingId, $filtered);
            return $resolver();
        }

        $filtered['id'] = $existingId;
        $filtered['created_at'] = $this->database->nowUtc();
        $filtered['updated_at'] = $this->database->nowUtc();
        $columns = implode(', ', array_keys($filtered));
        $placeholders = implode(', ', array_map(static fn (string $column): string => ':' . $column, array_keys($filtered)));
        $bindings = [];
        foreach ($filtered as $column => $value) {
            $bindings[':' . $column] = $value;
        }
        $this->database->execute("INSERT INTO {$table} ({$columns}) VALUES ({$placeholders})", $bindings);
        return $resolver();
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapCustomer(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'name' => (string) ($row['name'] ?? ''),
            'phone' => (string) ($row['phone'] ?? ''),
            'address' => (string) ($row['address'] ?? ''),
            'totalOrders' => (int) ($row['total_orders'] ?? 0),
            'dueAmount' => (float) ($row['due_amount'] ?? 0),
            'createdBy' => $this->nullableString($row['created_by'] ?? null),
            'createdAt' => $this->toIso($row['created_at'] ?? null),
            'deletedAt' => $this->toIso($row['deleted_at'] ?? null),
            'deletedBy' => $this->nullableString($row['deleted_by'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapVendor(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'name' => (string) ($row['name'] ?? ''),
            'phone' => (string) ($row['phone'] ?? ''),
            'address' => (string) ($row['address'] ?? ''),
            'totalPurchases' => (int) ($row['total_purchases'] ?? 0),
            'dueAmount' => (float) ($row['due_amount'] ?? 0),
            'createdBy' => $this->nullableString($row['created_by'] ?? null),
            'createdAt' => $this->toIso($row['created_at'] ?? null),
            'deletedAt' => $this->toIso($row['deleted_at'] ?? null),
            'deletedBy' => $this->nullableString($row['deleted_by'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapProduct(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'name' => (string) ($row['name'] ?? ''),
            'image' => (string) ($row['image'] ?? ''),
            'category' => (string) ($row['category'] ?? ''),
            'salePrice' => (float) ($row['sale_price'] ?? $row['salePrice'] ?? 0),
            'purchasePrice' => (float) ($row['purchase_price'] ?? $row['purchasePrice'] ?? 0),
            'stock' => (int) ($row['stock'] ?? 0),
            'createdBy' => $this->nullableString($row['created_by'] ?? null),
            'createdAt' => $this->toIso($row['created_at'] ?? null),
            'deletedAt' => $this->toIso($row['deleted_at'] ?? null),
            'deletedBy' => $this->nullableString($row['deleted_by'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapAccount(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'name' => (string) ($row['name'] ?? ''),
            'type' => (string) ($row['type'] ?? 'Bank'),
            'openingBalance' => (float) ($row['opening_balance'] ?? 0),
            'currentBalance' => (float) ($row['current_balance'] ?? 0),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapUser(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'name' => (string) ($row['name'] ?? ''),
            'phone' => (string) ($row['phone'] ?? ''),
            'role' => (string) ($row['role'] ?? ''),
            'image' => (string) ($row['image'] ?? ''),
            'createdAt' => $this->toIso($row['created_at'] ?? null),
            'deletedAt' => $this->toIso($row['deleted_at'] ?? null),
            'deletedBy' => $this->nullableString($row['deleted_by'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapOrder(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'orderNumber' => (string) ($row['order_number'] ?? $row['orderNumber'] ?? ''),
            'orderDate' => (string) ($row['order_date'] ?? $row['orderDate'] ?? ''),
            'customerId' => (string) ($row['customer_id'] ?? $row['customerId'] ?? ''),
            'createdBy' => (string) ($row['created_by'] ?? $row['createdBy'] ?? ''),
            'status' => (string) ($row['status'] ?? ''),
            'items' => $this->jsonDecodeList($row['items'] ?? []),
            'subtotal' => (float) ($row['subtotal'] ?? 0),
            'discount' => (float) ($row['discount'] ?? 0),
            'shipping' => (float) ($row['shipping'] ?? 0),
            'total' => (float) ($row['total'] ?? $row['amount'] ?? 0),
            'notes' => $this->nullableString($row['notes'] ?? null),
            'carrybeeConsignmentId' => $this->nullableString($row['carrybee_consignment_id'] ?? $row['carrybeeConsignmentId'] ?? null),
            'steadfastConsignmentId' => $this->nullableString($row['steadfast_consignment_id'] ?? $row['steadfastConsignmentId'] ?? null),
            'paperflyTrackingNumber' => $this->nullableString($row['paperfly_tracking_number'] ?? $row['paperflyTrackingNumber'] ?? null),
            'history' => $this->jsonDecodeAssoc($row['history'] ?? []),
            'paidAmount' => (float) ($row['paid_amount'] ?? $row['paidAmount'] ?? 0),
            'customerName' => $this->nullableString($row['customer_name'] ?? $row['customerName'] ?? null),
            'customerPhone' => $this->nullableString($row['customer_phone'] ?? $row['customerPhone'] ?? null),
            'customerAddress' => $this->nullableString($row['customer_address'] ?? $row['customerAddress'] ?? null),
            'creatorName' => $this->nullableString($row['creator_name'] ?? $row['creatorName'] ?? null),
            'createdAt' => $this->toIso($row['created_at'] ?? $row['createdAt'] ?? null),
            'deletedAt' => $this->toIso($row['deleted_at'] ?? $row['deletedAt'] ?? null),
            'deletedBy' => $this->nullableString($row['deleted_by'] ?? $row['deletedBy'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapBill(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'billNumber' => (string) ($row['bill_number'] ?? $row['billNumber'] ?? ''),
            'billDate' => (string) ($row['bill_date'] ?? $row['billDate'] ?? ''),
            'vendorId' => (string) ($row['vendor_id'] ?? $row['vendorId'] ?? ''),
            'createdBy' => (string) ($row['created_by'] ?? $row['createdBy'] ?? ''),
            'status' => (string) ($row['status'] ?? ''),
            'items' => $this->jsonDecodeList($row['items'] ?? []),
            'subtotal' => (float) ($row['subtotal'] ?? 0),
            'discount' => (float) ($row['discount'] ?? 0),
            'shipping' => (float) ($row['shipping'] ?? 0),
            'total' => (float) ($row['total'] ?? 0),
            'notes' => $this->nullableString($row['notes'] ?? null),
            'paidAmount' => (float) ($row['paid_amount'] ?? $row['paidAmount'] ?? 0),
            'history' => $this->jsonDecodeAssoc($row['history'] ?? []),
            'vendorName' => $this->nullableString($row['vendor_name'] ?? $row['vendorName'] ?? null),
            'vendorPhone' => $this->nullableString($row['vendor_phone'] ?? $row['vendorPhone'] ?? null),
            'vendorAddress' => $this->nullableString($row['vendor_address'] ?? $row['vendorAddress'] ?? null),
            'creatorName' => $this->nullableString($row['creator_name'] ?? $row['creatorName'] ?? null),
            'createdAt' => $this->toIso($row['created_at'] ?? $row['createdAt'] ?? null),
            'deletedAt' => $this->toIso($row['deleted_at'] ?? $row['deletedAt'] ?? null),
            'deletedBy' => $this->nullableString($row['deleted_by'] ?? $row['deletedBy'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapTransaction(array $row): array
    {
        $dateValue = $row['date'] ?? $row['date_string'] ?? $row['created_at'] ?? $row['createdAt'] ?? null;

        return [
            'id' => (string) $row['id'],
            'date' => $this->toIso($dateValue) ?? (string) ($dateValue ?? ''),
            'type' => (string) ($row['type'] ?? ''),
            'category' => (string) ($row['category'] ?? ''),
            'accountId' => (string) ($row['account_id'] ?? $row['accountId'] ?? ''),
            'toAccountId' => $this->nullableString($row['to_account_id'] ?? $row['toAccountId'] ?? null),
            'amount' => (float) ($row['amount'] ?? 0),
            'description' => (string) ($row['description'] ?? ''),
            'referenceId' => $this->nullableString($row['reference_id'] ?? $row['referenceId'] ?? null),
            'contactId' => $this->nullableString($row['contact_id'] ?? $row['contactId'] ?? null),
            'paymentMethod' => (string) ($row['payment_method'] ?? $row['paymentMethod'] ?? ''),
            'attachmentName' => $this->nullableString($row['attachment_name'] ?? $row['attachmentName'] ?? null),
            'attachmentUrl' => $this->nullableString($row['attachment_url'] ?? $row['attachmentUrl'] ?? null),
            'createdBy' => (string) ($row['created_by'] ?? $row['createdBy'] ?? ''),
            'createdAt' => $this->toIso($row['created_at'] ?? $row['createdAt'] ?? null),
            'accountName' => $this->nullableString($row['account_name'] ?? $row['accountName'] ?? null),
            'contactName' => $this->nullableString($row['contact_name'] ?? $row['contactName'] ?? null),
            'contactType' => $this->nullableString($row['contact_type'] ?? $row['contactType'] ?? null),
            'creatorName' => $this->nullableString($row['creator_name'] ?? $row['creatorName'] ?? null),
            'deletedAt' => $this->toIso($row['deleted_at'] ?? $row['deletedAt'] ?? null),
            'deletedBy' => $this->nullableString($row['deleted_by'] ?? $row['deletedBy'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapCategory(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'name' => (string) ($row['name'] ?? ''),
            'type' => (string) ($row['type'] ?? ''),
            'color' => (string) ($row['color'] ?? '#3B82F6'),
            'parentId' => $this->nullableString($row['parent_id'] ?? $row['parentId'] ?? null),
            'createdAt' => $this->toIso($row['created_at'] ?? $row['createdAt'] ?? null),
            'updatedAt' => $this->toIso($row['updated_at'] ?? $row['updatedAt'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapPaymentMethod(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'name' => (string) ($row['name'] ?? ''),
            'description' => $this->nullableString($row['description'] ?? null),
            'isActive' => (bool) ($row['is_active'] ?? $row['isActive'] ?? false),
            'createdAt' => $this->toIso($row['created_at'] ?? $row['createdAt'] ?? null),
            'updatedAt' => $this->toIso($row['updated_at'] ?? $row['updatedAt'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapUnit(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'name' => (string) ($row['name'] ?? ''),
            'shortName' => (string) ($row['short_name'] ?? $row['shortName'] ?? ''),
            'description' => $this->nullableString($row['description'] ?? null),
            'createdAt' => $this->toIso($row['created_at'] ?? $row['createdAt'] ?? null),
            'updatedAt' => $this->toIso($row['updated_at'] ?? $row['updatedAt'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function defaultPayrollSettings(): array
    {
        return [
            'unitAmount' => 0.0,
            'countedStatuses' => self::DEFAULT_PAYROLL_STATUSES,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapPayrollSettings(array $row): array
    {
        return [
            'unitAmount' => (float) ($row['unit_amount'] ?? $row['unitAmount'] ?? 0),
            'countedStatuses' => $this->normalizePayrollStatuses(
                $this->jsonDecodeList($row['counted_statuses'] ?? $row['countedStatuses'] ?? []),
                true
            ),
        ];
    }

    /**
     * @param array<string, array<string, mixed>> $userMap
     * @return array<string, mixed>
     */
    protected function mapPayrollPayment(array $row, array $userMap = []): array
    {
        $employee = $userMap[(string) ($row['employee_id'] ?? '')] ?? null;
        $payer = $userMap[(string) ($row['paid_by'] ?? '')] ?? null;

        return [
            'id' => (string) $row['id'],
            'employeeId' => (string) ($row['employee_id'] ?? ''),
            'employeeName' => $this->nullableString($row['employee_name'] ?? ($employee['name'] ?? null)),
            'employeeRole' => $this->nullableString($row['employee_role'] ?? ($employee['role'] ?? null)),
            'periodStart' => (string) ($row['period_start'] ?? ''),
            'periodEnd' => (string) ($row['period_end'] ?? ''),
            'periodKind' => (string) ($row['period_kind'] ?? ''),
            'periodLabel' => (string) ($row['period_label'] ?? (($row['period_start'] ?? '') . ' - ' . ($row['period_end'] ?? ''))),
            'unitAmountSnapshot' => (float) ($row['unit_amount_snapshot'] ?? 0),
            'countedStatusesSnapshot' => $this->normalizePayrollStatuses(
                $this->jsonDecodeList($row['counted_statuses_snapshot'] ?? []),
                true
            ),
            'orderCountSnapshot' => (int) ($row['order_count_snapshot'] ?? 0),
            'amountSnapshot' => (float) ($row['amount_snapshot'] ?? 0),
            'paidAt' => $this->toIso($row['paid_at'] ?? null) ?? (string) ($row['paid_at'] ?? ''),
            'paidBy' => (string) ($row['paid_by'] ?? ''),
            'paidByName' => $this->nullableString($row['paid_by_name'] ?? ($payer['name'] ?? null)),
            'note' => $this->nullableString($row['note'] ?? null) ?? '',
            'createdAt' => $this->toIso($row['created_at'] ?? $row['createdAt'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapWalletBalanceCard(array $row): array
    {
        return [
            'employeeId' => (string) ($row['employee_id'] ?? $row['employeeId'] ?? ''),
            'employeeName' => (string) ($row['employee_name'] ?? $row['employeeName'] ?? 'Unknown Employee'),
            'employeeRole' => (string) ($row['employee_role'] ?? $row['employeeRole'] ?? 'Employee'),
            'currentBalance' => (float) ($row['current_balance'] ?? $row['currentBalance'] ?? 0),
            'totalEarned' => (float) ($row['total_earned'] ?? $row['totalEarned'] ?? 0),
            'totalPaid' => (float) ($row['total_paid'] ?? $row['totalPaid'] ?? 0),
            'creditedOrders' => (int) ($row['credited_orders'] ?? $row['creditedOrders'] ?? 0),
            'lastActivityAt' => $this->toIso($row['last_activity_at'] ?? $row['lastActivityAt'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapWalletActivityEntry(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'employeeId' => (string) ($row['employee_id'] ?? $row['employeeId'] ?? ''),
            'employeeName' => $this->nullableString($row['employee_name'] ?? $row['employeeName'] ?? null),
            'employeeRole' => $this->nullableString($row['employee_role'] ?? $row['employeeRole'] ?? null),
            'entryType' => (string) ($row['entry_type'] ?? $row['entryType'] ?? 'order_credit'),
            'amountDelta' => (float) ($row['amount_delta'] ?? $row['amountDelta'] ?? 0),
            'unitAmountSnapshot' => ($row['unit_amount_snapshot'] ?? $row['unitAmountSnapshot'] ?? null) !== null
                ? (float) ($row['unit_amount_snapshot'] ?? $row['unitAmountSnapshot'])
                : null,
            'orderId' => $this->nullableString($row['order_id'] ?? $row['orderId'] ?? null),
            'orderNumber' => $this->nullableString($row['order_number'] ?? $row['orderNumber'] ?? null),
            'payoutId' => $this->nullableString($row['payout_id'] ?? $row['payoutId'] ?? null),
            'transactionId' => $this->nullableString($row['transaction_id'] ?? $row['transactionId'] ?? null),
            'accountId' => $this->nullableString($row['account_id'] ?? $row['accountId'] ?? null),
            'accountName' => $this->nullableString($row['account_name'] ?? $row['accountName'] ?? null),
            'paymentMethod' => $this->nullableString($row['payment_method'] ?? $row['paymentMethod'] ?? null),
            'categoryId' => $this->nullableString($row['category_id'] ?? $row['categoryId'] ?? null),
            'categoryName' => $this->nullableString($row['category_name'] ?? $row['categoryName'] ?? null),
            'note' => $this->nullableString($row['note'] ?? null),
            'createdAt' => $this->toIso($row['created_at'] ?? $row['createdAt'] ?? null) ?? (string) ($row['created_at'] ?? ''),
            'createdBy' => $this->nullableString($row['created_by'] ?? $row['createdBy'] ?? null),
            'createdByName' => $this->nullableString($row['created_by_name'] ?? $row['createdByName'] ?? null),
            'paidAt' => $this->toIso($row['paid_at'] ?? $row['paidAt'] ?? null),
            'paidBy' => $this->nullableString($row['paid_by'] ?? $row['paidBy'] ?? null),
            'paidByName' => $this->nullableString($row['paid_by_name'] ?? $row['paidByName'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapWalletPayout(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'employeeId' => (string) ($row['employee_id'] ?? $row['employeeId'] ?? ''),
            'amount' => (float) ($row['amount'] ?? 0),
            'accountId' => (string) ($row['account_id'] ?? $row['accountId'] ?? ''),
            'paymentMethod' => (string) ($row['payment_method'] ?? $row['paymentMethod'] ?? ''),
            'categoryId' => (string) ($row['category_id'] ?? $row['categoryId'] ?? ''),
            'transactionId' => (string) ($row['transaction_id'] ?? $row['transactionId'] ?? ''),
            'paidAt' => $this->toIso($row['paid_at'] ?? $row['paidAt'] ?? null) ?? (string) ($row['paid_at'] ?? ''),
            'paidBy' => (string) ($row['paid_by'] ?? $row['paidBy'] ?? ''),
            'paidByName' => $this->nullableString($row['paid_by_name'] ?? $row['paidByName'] ?? null),
            'note' => $this->nullableString($row['note'] ?? null),
        ];
    }

    protected function isEmployeeRole(string $role): bool
    {
        return in_array($role, ['Employee', 'Employee1'], true);
    }

    protected function hasAdminAccess(string $role): bool
    {
        return in_array($role, ['Admin', 'Developer'], true);
    }

    /**
     * @param array<int, mixed> $statuses
     * @return array<int, string>
     */
    protected function normalizePayrollStatuses(array $statuses, bool $fallbackToDefault): array
    {
        $allowed = self::DEFAULT_PAYROLL_STATUSES;
        $normalized = [];
        foreach ($statuses as $status) {
            $statusText = trim((string) $status);
            if ($statusText !== '' && in_array($statusText, $allowed, true) && !in_array($statusText, $normalized, true)) {
                $normalized[] = $statusText;
            }
        }

        if ($normalized !== []) {
            return $normalized;
        }

        return $fallbackToDefault ? self::DEFAULT_PAYROLL_STATUSES : [];
    }

    protected function isWalletEligibleOrderDate(string $orderDate, string $createdAt): bool
    {
        $cutoffDate = $this->walletCutoffDate();
        $normalizedOrderDate = $this->normalizeDateOnly($orderDate);
        if ($normalizedOrderDate !== '') {
            return $normalizedOrderDate >= $cutoffDate;
        }

        $normalizedCreatedAt = trim($createdAt);
        if ($normalizedCreatedAt !== '') {
            return $this->normalizeDateTimeInput($normalizedCreatedAt) >= $this->walletCutoffAtUtc();
        }

        return false;
    }

    protected function walletCutoffDate(): string
    {
        return $this->config->get('WALLET_CUTOFF_DATE', self::DEFAULT_WALLET_CUTOFF_DATE)
            ?? self::DEFAULT_WALLET_CUTOFF_DATE;
    }

    protected function walletCutoffAtUtc(): string
    {
        return $this->normalizeDateTimeInput(
            $this->config->get('WALLET_CUTOFF_AT_UTC', self::DEFAULT_WALLET_CUTOFF_AT_UTC)
                ?? self::DEFAULT_WALLET_CUTOFF_AT_UTC
        );
    }

    protected function localDateFromUtc(?string $value): string
    {
        $trimmed = trim((string) $value);
        if ($trimmed === '') {
            return '';
        }

        $date = $this->parseDateTimeValue($trimmed, $this->utcTimezone());
        if (!$date instanceof \DateTimeImmutable) {
            return '';
        }

        $timezone = new \DateTimeZone($this->config->timezone());
        return $date->setTimezone($timezone)->format('Y-m-d');
    }

    protected function walletEligibleLocalDate(string $orderDate, string $createdAt): string
    {
        $normalizedOrderDate = $this->normalizeDateOnly($orderDate);
        if ($normalizedOrderDate !== '') {
            return $normalizedOrderDate;
        }

        return $this->localDateFromUtc($createdAt);
    }
}
