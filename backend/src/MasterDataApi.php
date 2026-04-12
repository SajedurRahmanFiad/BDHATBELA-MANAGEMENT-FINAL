<?php

declare(strict_types=1);

namespace App;

use RuntimeException;

final class MasterDataApi extends BaseService
{
    public function me(array $params = []): array
    {
        return $this->mapUser($this->currentUser());
    }

    public function bootstrapSession(array $params = []): array
    {
        return [
            'user' => $this->mapUser($this->currentUser()),
            'permissions' => $this->buildPermissionsSettingsPayload(),
        ];
    }

    public function loginUser(array $params): array
    {
        $phone = trim((string) ($params['phone'] ?? ''));
        $password = (string) ($params['password'] ?? '');
        if ($phone === '' || $password === '') {
            return ['user' => null, 'error' => 'Phone and password are required.'];
        }

        $row = $this->database->fetchOne(
            'SELECT * FROM users WHERE phone = :phone AND deleted_at IS NULL LIMIT 1',
            [':phone' => $phone]
        );

        if ($row === null) {
            return ['user' => null, 'error' => 'User not found'];
        }

        $hash = (string) ($row['password_hash'] ?? '');
        if ($hash === '' || !password_verify($password, $hash)) {
            return ['user' => null, 'error' => 'Invalid password'];
        }

        return [
            'user' => $this->mapUser($row),
            'token' => $this->auth->issueToken($row),
            'error' => null,
        ];
    }

    public function fetchUsers(array $params = []): array
    {
        $rows = $this->database->fetchAll(
            'SELECT id, name, phone, role, image, created_at, deleted_at, deleted_by
             FROM users
             WHERE deleted_at IS NULL
             ORDER BY created_at DESC, name ASC'
        );

        return array_map(fn (array $row): array => $this->mapUser($row), $rows);
    }

    public function fetchUsersMini(array $params = []): array
    {
        return $this->database->fetchAll(
            'SELECT id, name FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC, name ASC'
        );
    }

    public function fetchUserByPhone(array $params): ?array
    {
        $phone = trim((string) ($params['phone'] ?? ''));
        if ($phone === '') {
            return null;
        }

        $row = $this->database->fetchOne(
            'SELECT * FROM users WHERE phone = :phone AND deleted_at IS NULL LIMIT 1',
            [':phone' => $phone]
        );

        return $row ? $this->mapUser($row) : null;
    }

    public function fetchUserById(array $params): ?array
    {
        $id = trim((string) ($params['id'] ?? ''));
        if ($id === '') {
            return null;
        }

        $row = $this->database->fetchOne(
            'SELECT * FROM users WHERE id = :id AND deleted_at IS NULL LIMIT 1',
            [':id' => $id]
        );

        return $row ? $this->mapUser($row) : null;
    }

    public function createUser(array $params): array
    {
        $requiresAdmin = PHP_SAPI !== 'cli' && PHP_SAPI !== 'phpdbg';
        if ($requiresAdmin) {
            $existingUser = $this->database->fetchOne('SELECT id FROM users WHERE deleted_at IS NULL LIMIT 1');
            if ($existingUser !== null) {
                $this->requireAdmin();
            }
        }

        $password = (string) ($params['password'] ?? '');
        if ($password === '') {
            throw new RuntimeException('Password is required to create a user.');
        }

        $requestedRole = trim((string) ($params['role'] ?? 'Employee'));
        if ($requestedRole === 'Developer') {
            throw new RuntimeException('Developer users can only be assigned directly in the database.');
        }

        $id = $this->stringId($params['id'] ?? null);
        $this->database->execute(
            'INSERT INTO users (id, name, phone, role, image, password_hash, created_at, updated_at)
             VALUES (:id, :name, :phone, :role, :image, :password_hash, :created_at, :updated_at)',
            [
                ':id' => $id,
                ':name' => trim((string) ($params['name'] ?? '')),
                ':phone' => trim((string) ($params['phone'] ?? '')),
                ':role' => $requestedRole,
                ':image' => $this->nullableString($params['image'] ?? null),
                ':password_hash' => password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]),
                ':created_at' => $this->database->nowUtc(),
                ':updated_at' => $this->database->nowUtc(),
            ]
        );

        return $this->fetchUserById(['id' => $id]) ?? throw new RuntimeException('Failed to create user.');
    }

    public function updateUser(array $params): array
    {
        $this->requireAdmin();
        $id = trim((string) ($params['id'] ?? ''));
        if ($id === '') {
            throw new RuntimeException('User id is required.');
        }

        $existing = $this->database->fetchOne(
            'SELECT id, role FROM users WHERE id = :id AND deleted_at IS NULL LIMIT 1',
            [':id' => $id]
        );
        if ($existing === null) {
            throw new RuntimeException('User not found.');
        }

        $updates = $params['updates'] ?? [];
        if (!is_array($updates)) {
            $updates = [];
        }

        $payload = [];
        if (array_key_exists('name', $updates)) {
            $payload['name'] = trim((string) $updates['name']);
        }
        if (array_key_exists('phone', $updates)) {
            $payload['phone'] = trim((string) $updates['phone']);
        }
        if (array_key_exists('role', $updates)) {
            $requestedRole = trim((string) $updates['role']);
            $currentRole = trim((string) ($existing['role'] ?? ''));
            if ($requestedRole === 'Developer' || ($currentRole === 'Developer' && $requestedRole !== 'Developer')) {
                throw new RuntimeException('Developer role changes can only be made directly in the database.');
            }
            $payload['role'] = $requestedRole;
        }
        if (array_key_exists('image', $updates)) {
            $payload['image'] = $this->nullableString($updates['image']);
        }
        if (!empty($updates['password'])) {
            $payload['password_hash'] = password_hash((string) $updates['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        }

        $this->touchUpdate('users', $id, $payload);
        return $this->fetchUserById(['id' => $id]) ?? throw new RuntimeException('User not found.');
    }

    public function deleteUser(array $params): array
    {
        $this->requireAdmin();
        $id = trim((string) ($params['id'] ?? ''));
        $existing = $this->database->fetchOne(
            'SELECT id, role FROM users WHERE id = :id AND deleted_at IS NULL LIMIT 1',
            [':id' => $id]
        );
        if ($existing !== null && trim((string) ($existing['role'] ?? '')) === 'Developer') {
            throw new RuntimeException('Developer users cannot be archived from the app.');
        }

        $this->softDelete('users', $id);
        return ['success' => true];
    }

    public function fetchCustomers(array $params = []): array
    {
        $rows = $this->database->fetchAll(
            'SELECT id, name, phone, address, total_orders, due_amount, created_by, created_at, deleted_at, deleted_by
             FROM customers
             WHERE deleted_at IS NULL
             ORDER BY created_at DESC'
        );

        return array_map(fn (array $row): array => $this->mapCustomer($row), $rows);
    }

    public function fetchCustomersPage(array $params): array
    {
        $page = max(1, (int) ($params['page'] ?? 1));
        $pageSize = max(1, min(200, (int) ($params['pageSize'] ?? self::DEFAULT_PAGE_SIZE)));
        $offset = ($page - 1) * $pageSize;
        $search = trim((string) ($params['search'] ?? ''));

        $where = 'WHERE deleted_at IS NULL';
        $bindings = [];
        if ($search !== '') {
            $where .= ' AND (name LIKE :search_name OR phone LIKE :search_phone OR address LIKE :search_address)';
            $bindings[':search_name'] = '%' . $search . '%';
            $bindings[':search_phone'] = '%' . $search . '%';
            $bindings[':search_address'] = '%' . $search . '%';
        }

        $countRow = $this->database->fetchOne("SELECT COUNT(*) AS count FROM customers {$where}", $bindings);
        $rows = $this->database->fetchAll(
            "SELECT id, name, phone, address, total_orders, due_amount, created_by, created_at, deleted_at, deleted_by
             FROM customers
             {$where}
             ORDER BY created_at DESC
             LIMIT {$pageSize} OFFSET {$offset}",
            $bindings
        );

        return [
            'data' => array_map(fn (array $row): array => $this->mapCustomer($row), $rows),
            'count' => (int) ($countRow['count'] ?? 0),
        ];
    }

    public function fetchCustomersMini(array $params = []): array
    {
        return $this->database->fetchAll(
            'SELECT id, name, phone FROM customers WHERE deleted_at IS NULL ORDER BY created_at DESC'
        );
    }

    public function fetchCustomerById(array $params): ?array
    {
        $id = trim((string) ($params['id'] ?? ''));
        if ($id === '' || str_starts_with($id, 'temp-')) {
            return null;
        }

        $row = $this->database->fetchOne(
            'SELECT * FROM customers WHERE id = :id AND deleted_at IS NULL LIMIT 1',
            [':id' => $id]
        );

        return $row ? $this->mapCustomer($row) : null;
    }

    public function createCustomer(array $params): array
    {
        $actor = $this->currentUser();
        $id = $this->stringId($params['id'] ?? null);
        $this->database->execute(
            'INSERT INTO customers (id, name, phone, address, total_orders, due_amount, created_by, created_at, updated_at)
             VALUES (:id, :name, :phone, :address, :total_orders, :due_amount, :created_by, :created_at, :updated_at)',
            [
                ':id' => $id,
                ':name' => trim((string) ($params['name'] ?? '')),
                ':phone' => trim((string) ($params['phone'] ?? '')),
                ':address' => $this->nullableString($params['address'] ?? null),
                ':total_orders' => (int) ($params['totalOrders'] ?? 0),
                ':due_amount' => $this->formatMoney($params['dueAmount'] ?? 0),
                ':created_by' => (string) $actor['id'],
                ':created_at' => $this->database->nowUtc(),
                ':updated_at' => $this->database->nowUtc(),
            ]
        );

        return $this->fetchCustomerById(['id' => $id]) ?? throw new RuntimeException('Failed to create customer.');
    }

    public function updateCustomer(array $params): array
    {
        $this->currentUser();
        $id = trim((string) ($params['id'] ?? ''));
        $updates = is_array($params['updates'] ?? null) ? $params['updates'] : [];
        $payload = [];

        if (array_key_exists('name', $updates)) {
            $payload['name'] = trim((string) $updates['name']);
        }
        if (array_key_exists('phone', $updates)) {
            $payload['phone'] = trim((string) $updates['phone']);
        }
        if (array_key_exists('address', $updates)) {
            $payload['address'] = $this->nullableString($updates['address']);
        }
        if (array_key_exists('totalOrders', $updates)) {
            $payload['total_orders'] = (int) $updates['totalOrders'];
        }
        if (array_key_exists('dueAmount', $updates)) {
            $payload['due_amount'] = $this->formatMoney($updates['dueAmount']);
        }

        $this->touchUpdate('customers', $id, $payload);
        return $this->fetchCustomerById(['id' => $id]) ?? throw new RuntimeException('Customer not found.');
    }

    public function deleteCustomer(array $params): array
    {
        $this->currentUser();
        $id = trim((string) ($params['id'] ?? ''));
        if (str_starts_with($id, 'temp-')) {
            throw new RuntimeException('Cannot delete unsaved customer. Please refresh and try again.');
        }
        $this->softDelete('customers', $id);
        return ['success' => true];
    }

    public function fetchVendors(array $params = []): array
    {
        $rows = $this->database->fetchAll(
            'SELECT id, name, phone, address, total_purchases, due_amount, created_by, created_at, deleted_at, deleted_by
             FROM vendors
             WHERE deleted_at IS NULL
             ORDER BY created_at DESC'
        );

        return array_map(fn (array $row): array => $this->mapVendor($row), $rows);
    }

    public function fetchVendorsPage(array $params): array
    {
        $page = max(1, (int) ($params['page'] ?? 1));
        $pageSize = max(1, min(200, (int) ($params['pageSize'] ?? self::DEFAULT_PAGE_SIZE)));
        $offset = ($page - 1) * $pageSize;
        $search = trim((string) ($params['search'] ?? ''));

        $where = 'WHERE deleted_at IS NULL';
        $bindings = [];
        if ($search !== '') {
            $where .= ' AND (name LIKE :search_name OR phone LIKE :search_phone OR address LIKE :search_address)';
            $bindings[':search_name'] = '%' . $search . '%';
            $bindings[':search_phone'] = '%' . $search . '%';
            $bindings[':search_address'] = '%' . $search . '%';
        }

        $countRow = $this->database->fetchOne("SELECT COUNT(*) AS count FROM vendors {$where}", $bindings);
        $rows = $this->database->fetchAll(
            "SELECT id, name, phone, address, total_purchases, due_amount, created_by, created_at, deleted_at, deleted_by
             FROM vendors
             {$where}
             ORDER BY created_at DESC
             LIMIT {$pageSize} OFFSET {$offset}",
            $bindings
        );

        return [
            'data' => array_map(fn (array $row): array => $this->mapVendor($row), $rows),
            'count' => (int) ($countRow['count'] ?? 0),
        ];
    }

    public function fetchVendorById(array $params): ?array
    {
        $id = trim((string) ($params['id'] ?? ''));
        if ($id === '') {
            return null;
        }

        $row = $this->database->fetchOne(
            'SELECT * FROM vendors WHERE id = :id AND deleted_at IS NULL LIMIT 1',
            [':id' => $id]
        );

        return $row ? $this->mapVendor($row) : null;
    }

    public function createVendor(array $params): array
    {
        $actor = $this->currentUser();
        $id = $this->stringId($params['id'] ?? null);
        $this->database->execute(
            'INSERT INTO vendors (id, name, phone, address, total_purchases, due_amount, created_by, created_at, updated_at)
             VALUES (:id, :name, :phone, :address, :total_purchases, :due_amount, :created_by, :created_at, :updated_at)',
            [
                ':id' => $id,
                ':name' => trim((string) ($params['name'] ?? '')),
                ':phone' => trim((string) ($params['phone'] ?? '')),
                ':address' => $this->nullableString($params['address'] ?? null),
                ':total_purchases' => (int) ($params['totalPurchases'] ?? 0),
                ':due_amount' => $this->formatMoney($params['dueAmount'] ?? 0),
                ':created_by' => (string) $actor['id'],
                ':created_at' => $this->database->nowUtc(),
                ':updated_at' => $this->database->nowUtc(),
            ]
        );

        return $this->fetchVendorById(['id' => $id]) ?? throw new RuntimeException('Failed to create vendor.');
    }

    public function updateVendor(array $params): array
    {
        $this->currentUser();
        $id = trim((string) ($params['id'] ?? ''));
        $updates = is_array($params['updates'] ?? null) ? $params['updates'] : [];
        $payload = [];

        if (array_key_exists('name', $updates)) {
            $payload['name'] = trim((string) $updates['name']);
        }
        if (array_key_exists('phone', $updates)) {
            $payload['phone'] = trim((string) $updates['phone']);
        }
        if (array_key_exists('address', $updates)) {
            $payload['address'] = $this->nullableString($updates['address']);
        }
        if (array_key_exists('totalPurchases', $updates)) {
            $payload['total_purchases'] = (int) $updates['totalPurchases'];
        }
        if (array_key_exists('dueAmount', $updates)) {
            $payload['due_amount'] = $this->formatMoney($updates['dueAmount']);
        }

        $this->touchUpdate('vendors', $id, $payload);
        return $this->fetchVendorById(['id' => $id]) ?? throw new RuntimeException('Vendor not found.');
    }

    public function deleteVendor(array $params): array
    {
        $this->currentUser();
        $this->softDelete('vendors', trim((string) ($params['id'] ?? '')));
        return ['success' => true];
    }

    public function fetchProducts(array $params = []): array
    {
        $category = trim((string) ($params['category'] ?? ''));
        $sql = 'SELECT id, name, image, category, sale_price, purchase_price, stock, created_by, created_at, deleted_at, deleted_by
                FROM products
                WHERE deleted_at IS NULL';
        $bindings = [];
        if ($category !== '') {
            $sql .= ' AND category = :category';
            $bindings[':category'] = $category;
        }
        $sql .= ' ORDER BY created_at DESC';

        $rows = $this->database->fetchAll($sql, $bindings);
        return array_map(fn (array $row): array => $this->mapProduct($row), $rows);
    }

    public function fetchProductsPage(array $params): array
    {
        $page = max(1, (int) ($params['page'] ?? 1));
        $pageSize = max(1, min(200, (int) ($params['pageSize'] ?? self::DEFAULT_PAGE_SIZE)));
        $offset = ($page - 1) * $pageSize;
        $search = trim((string) ($params['search'] ?? ''));
        $category = trim((string) ($params['category'] ?? ''));
        $createdByIds = is_array($params['createdByIds'] ?? null) ? $params['createdByIds'] : [];

        $where = 'WHERE deleted_at IS NULL';
        $bindings = [];
        if ($search !== '') {
            $where .= ' AND name LIKE :search';
            $bindings[':search'] = '%' . $search . '%';
        }
        if ($category !== '') {
            $where .= ' AND category = :category';
            $bindings[':category'] = $category;
        }
        $createdByIds = array_values(array_filter(array_map('strval', $createdByIds), static fn (string $id): bool => trim($id) !== ''));
        if ($createdByIds !== []) {
            [$placeholders, $inBindings] = $this->inClause($createdByIds, 'created_by');
            $where .= ' AND created_by IN (' . implode(', ', $placeholders) . ')';
            $bindings += $inBindings;
        }

        $countRow = $this->database->fetchOne("SELECT COUNT(*) AS count FROM products {$where}", $bindings);
        $rows = $this->database->fetchAll(
            "SELECT id, name, category, sale_price, purchase_price, stock, created_by, created_at, deleted_at, deleted_by
             FROM products
             {$where}
             ORDER BY created_at DESC
             LIMIT {$pageSize} OFFSET {$offset}",
            $bindings
        );

        return [
            'data' => array_map(fn (array $row): array => $this->mapProduct($row), $rows),
            'count' => (int) ($countRow['count'] ?? 0),
        ];
    }

    public function fetchProductsMini(array $params = []): array
    {
        $rows = $this->database->fetchAll(
            'SELECT id, name, sale_price, purchase_price, stock FROM products WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 100'
        );

        return array_map(fn (array $row): array => $this->mapProduct($row), $rows);
    }

    public function fetchProductsSearch(array $params): array
    {
        $query = trim((string) ($params['q'] ?? ''));
        $limit = max(1, min(200, (int) ($params['limit'] ?? 50)));
        if ($query === '') {
            return [];
        }

        $rows = $this->database->fetchAll(
            "SELECT id, name, sale_price, purchase_price, stock
             FROM products
             WHERE deleted_at IS NULL AND name LIKE :search
             ORDER BY created_at DESC
             LIMIT {$limit}",
            [':search' => '%' . $query . '%']
        );

        return array_map(fn (array $row): array => $this->mapProduct($row), $rows);
    }

    public function fetchProductById(array $params): ?array
    {
        $id = trim((string) ($params['id'] ?? ''));
        if ($id === '') {
            return null;
        }

        $row = $this->database->fetchOne(
            'SELECT * FROM products WHERE id = :id AND deleted_at IS NULL LIMIT 1',
            [':id' => $id]
        );

        return $row ? $this->mapProduct($row) : null;
    }

    public function fetchProductImagesByIds(array $params): array
    {
        $productIds = is_array($params['productIds'] ?? null) ? $params['productIds'] : [];
        $productIds = array_values(array_filter(array_map('strval', $productIds), static fn (string $id): bool => trim($id) !== ''));
        if ($productIds === []) {
            return [];
        }

        [$placeholders, $bindings] = $this->inClause($productIds, 'product');
        return $this->database->fetchAll(
            'SELECT id, image FROM products WHERE deleted_at IS NULL AND id IN (' . implode(', ', $placeholders) . ')',
            $bindings
        );
    }

    public function createProduct(array $params): array
    {
        $actor = $this->currentUser();
        $id = $this->stringId($params['id'] ?? null);
        $this->database->execute(
            'INSERT INTO products (id, name, image, category, sale_price, purchase_price, stock, created_by, created_at, updated_at)
             VALUES (:id, :name, :image, :category, :sale_price, :purchase_price, :stock, :created_by, :created_at, :updated_at)',
            [
                ':id' => $id,
                ':name' => trim((string) ($params['name'] ?? '')),
                ':image' => $this->nullableString($params['image'] ?? null),
                ':category' => $this->nullableString($params['category'] ?? null),
                ':sale_price' => $this->formatMoney($params['salePrice'] ?? 0),
                ':purchase_price' => $this->formatMoney($params['purchasePrice'] ?? 0),
                ':stock' => (int) ($params['stock'] ?? 0),
                ':created_by' => (string) $actor['id'],
                ':created_at' => $this->database->nowUtc(),
                ':updated_at' => $this->database->nowUtc(),
            ]
        );

        return $this->fetchProductById(['id' => $id]) ?? throw new RuntimeException('Failed to create product.');
    }

    public function updateProduct(array $params): array
    {
        $this->currentUser();
        $id = trim((string) ($params['id'] ?? ''));
        $updates = is_array($params['updates'] ?? null) ? $params['updates'] : [];
        $payload = [];

        if (array_key_exists('name', $updates)) {
            $payload['name'] = trim((string) $updates['name']);
        }
        if (array_key_exists('image', $updates)) {
            $payload['image'] = $this->nullableString($updates['image']);
        }
        if (array_key_exists('category', $updates)) {
            $payload['category'] = $this->nullableString($updates['category']);
        }
        if (array_key_exists('salePrice', $updates)) {
            $payload['sale_price'] = $this->formatMoney($updates['salePrice']);
        }
        if (array_key_exists('purchasePrice', $updates)) {
            $payload['purchase_price'] = $this->formatMoney($updates['purchasePrice']);
        }
        if (array_key_exists('stock', $updates)) {
            $payload['stock'] = (int) $updates['stock'];
        }

        $this->touchUpdate('products', $id, $payload);
        return $this->fetchProductById(['id' => $id]) ?? throw new RuntimeException('Product not found.');
    }

    public function deleteProduct(array $params): array
    {
        $this->currentUser();
        $this->softDelete('products', trim((string) ($params['id'] ?? '')));
        return ['success' => true];
    }

    public function fetchAccounts(array $params = []): array
    {
        $rows = $this->database->fetchAll('SELECT * FROM accounts ORDER BY created_at DESC');
        return array_map(fn (array $row): array => $this->mapAccount($row), $rows);
    }

    public function fetchAccountById(array $params): ?array
    {
        $id = trim((string) ($params['id'] ?? ''));
        if ($id === '') {
            return null;
        }

        $row = $this->database->fetchOne('SELECT * FROM accounts WHERE id = :id LIMIT 1', [':id' => $id]);
        return $row ? $this->mapAccount($row) : null;
    }

    public function createAccount(array $params): array
    {
        $this->requireAdmin();
        $id = $this->stringId($params['id'] ?? null);
        $openingBalance = $this->formatMoney($params['openingBalance'] ?? 0);
        $currentBalance = array_key_exists('currentBalance', $params)
            ? $this->formatMoney($params['currentBalance'])
            : $openingBalance;

        $this->database->execute(
            'INSERT INTO accounts (id, name, type, opening_balance, current_balance, created_at, updated_at)
             VALUES (:id, :name, :type, :opening_balance, :current_balance, :created_at, :updated_at)',
            [
                ':id' => $id,
                ':name' => trim((string) ($params['name'] ?? '')),
                ':type' => trim((string) ($params['type'] ?? 'Cash')),
                ':opening_balance' => $openingBalance,
                ':current_balance' => $currentBalance,
                ':created_at' => $this->database->nowUtc(),
                ':updated_at' => $this->database->nowUtc(),
            ]
        );

        return $this->fetchAccountById(['id' => $id]) ?? throw new RuntimeException('Failed to create account.');
    }

    public function updateAccount(array $params): array
    {
        $this->requireAdmin();
        $id = trim((string) ($params['id'] ?? ''));
        $updates = is_array($params['updates'] ?? null) ? $params['updates'] : [];
        $payload = [];
        if (array_key_exists('name', $updates)) {
            $payload['name'] = trim((string) $updates['name']);
        }
        if (array_key_exists('type', $updates)) {
            $payload['type'] = trim((string) $updates['type']);
        }
        if (array_key_exists('openingBalance', $updates)) {
            $payload['opening_balance'] = $this->formatMoney($updates['openingBalance']);
        }
        if (array_key_exists('currentBalance', $updates)) {
            $payload['current_balance'] = $this->formatMoney($updates['currentBalance']);
        }

        $this->touchUpdate('accounts', $id, $payload);
        return $this->fetchAccountById(['id' => $id]) ?? throw new RuntimeException('Account not found.');
    }

    public function deleteAccount(array $params): array
    {
        $this->requireAdmin();
        $id = trim((string) ($params['id'] ?? ''));
        $this->database->execute('DELETE FROM accounts WHERE id = :id', [':id' => $id]);
        return ['success' => true];
    }

    public function fetchCategories(array $params = []): array
    {
        $type = trim((string) ($params['type'] ?? ''));
        $sql = 'SELECT * FROM categories';
        $bindings = [];
        if ($type !== '') {
            $sql .= ' WHERE type = :type';
            $bindings[':type'] = $type;
        }
        $sql .= ' ORDER BY name ASC';
        $rows = $this->database->fetchAll($sql, $bindings);

        return array_map(fn (array $row): array => $this->mapCategory($row), $rows);
    }

    public function fetchCategoriesById(array $params): ?array
    {
        $row = $this->database->fetchOne(
            'SELECT * FROM categories WHERE id = :id LIMIT 1',
            [':id' => trim((string) ($params['id'] ?? ''))]
        );
        return $row ? $this->mapCategory($row) : null;
    }

    public function createCategory(array $params): array
    {
        $this->requireAdmin();
        $id = $this->stringId($params['id'] ?? null);
        $this->database->execute(
            'INSERT INTO categories (id, name, type, color, parent_id, created_at, updated_at)
             VALUES (:id, :name, :type, :color, :parent_id, :created_at, :updated_at)',
            [
                ':id' => $id,
                ':name' => trim((string) ($params['name'] ?? '')),
                ':type' => trim((string) ($params['type'] ?? 'Other')),
                ':color' => trim((string) ($params['color'] ?? '#3B82F6')),
                ':parent_id' => $this->nullableString($params['parentId'] ?? null),
                ':created_at' => $this->database->nowUtc(),
                ':updated_at' => $this->database->nowUtc(),
            ]
        );

        return $this->fetchCategoriesById(['id' => $id]) ?? throw new RuntimeException('Failed to create category.');
    }

    public function updateCategory(array $params): array
    {
        $this->requireAdmin();
        $id = trim((string) ($params['id'] ?? ''));
        $updates = is_array($params['updates'] ?? null) ? $params['updates'] : [];
        $payload = [];
        if (array_key_exists('name', $updates)) {
            $payload['name'] = trim((string) $updates['name']);
        }
        if (array_key_exists('type', $updates)) {
            $payload['type'] = trim((string) $updates['type']);
        }
        if (array_key_exists('color', $updates)) {
            $payload['color'] = trim((string) $updates['color']);
        }
        if (array_key_exists('parentId', $updates)) {
            $payload['parent_id'] = $this->nullableString($updates['parentId']);
        }
        $this->touchUpdate('categories', $id, $payload);
        return $this->fetchCategoriesById(['id' => $id]) ?? throw new RuntimeException('Category not found.');
    }

    public function deleteCategory(array $params): array
    {
        $this->requireAdmin();
        $this->database->execute('DELETE FROM categories WHERE id = :id', [':id' => trim((string) ($params['id'] ?? ''))]);
        return ['success' => true];
    }

    public function fetchPaymentMethods(array $params = []): array
    {
        $activeOnly = !array_key_exists('activeOnly', $params) || (bool) $params['activeOnly'];
        $sql = 'SELECT * FROM payment_methods';
        if ($activeOnly) {
            $sql .= ' WHERE is_active = 1';
        }
        $sql .= ' ORDER BY name ASC';
        $rows = $this->database->fetchAll($sql);

        return array_map(fn (array $row): array => $this->mapPaymentMethod($row), $rows);
    }

    public function fetchPaymentMethodById(array $params): ?array
    {
        $row = $this->database->fetchOne(
            'SELECT * FROM payment_methods WHERE id = :id LIMIT 1',
            [':id' => trim((string) ($params['id'] ?? ''))]
        );
        return $row ? $this->mapPaymentMethod($row) : null;
    }

    public function createPaymentMethod(array $params): array
    {
        $this->requireAdmin();
        $id = $this->stringId($params['id'] ?? null);
        $this->database->execute(
            'INSERT INTO payment_methods (id, name, description, is_active, created_at, updated_at)
             VALUES (:id, :name, :description, 1, :created_at, :updated_at)',
            [
                ':id' => $id,
                ':name' => trim((string) ($params['name'] ?? '')),
                ':description' => $this->nullableString($params['description'] ?? null),
                ':created_at' => $this->database->nowUtc(),
                ':updated_at' => $this->database->nowUtc(),
            ]
        );

        return $this->fetchPaymentMethodById(['id' => $id]) ?? throw new RuntimeException('Failed to create payment method.');
    }

    public function updatePaymentMethod(array $params): array
    {
        $this->requireAdmin();
        $id = trim((string) ($params['id'] ?? ''));
        $updates = is_array($params['updates'] ?? null) ? $params['updates'] : [];
        $payload = [];
        if (array_key_exists('name', $updates)) {
            $payload['name'] = trim((string) $updates['name']);
        }
        if (array_key_exists('description', $updates)) {
            $payload['description'] = $this->nullableString($updates['description']);
        }
        if (array_key_exists('isActive', $updates)) {
            $payload['is_active'] = $updates['isActive'] ? 1 : 0;
        }
        $this->touchUpdate('payment_methods', $id, $payload);
        return $this->fetchPaymentMethodById(['id' => $id]) ?? throw new RuntimeException('Payment method not found.');
    }

    public function deletePaymentMethod(array $params): array
    {
        $this->requireAdmin();
        $this->database->execute(
            'DELETE FROM payment_methods WHERE id = :id',
            [':id' => trim((string) ($params['id'] ?? ''))]
        );
        return ['success' => true];
    }

    public function fetchUnits(array $params = []): array
    {
        $rows = $this->database->fetchAll('SELECT * FROM units ORDER BY name ASC');
        return array_map(fn (array $row): array => $this->mapUnit($row), $rows);
    }

    public function fetchUnitById(array $params): ?array
    {
        $row = $this->database->fetchOne(
            'SELECT * FROM units WHERE id = :id LIMIT 1',
            [':id' => trim((string) ($params['id'] ?? ''))]
        );
        return $row ? $this->mapUnit($row) : null;
    }

    public function createUnit(array $params): array
    {
        $this->requireAdmin();
        $id = strtolower(trim((string) ($params['shortName'] ?? $params['id'] ?? '')));
        if ($id === '') {
            throw new RuntimeException('Unit short name is required.');
        }

        $this->database->execute(
            'INSERT INTO units (id, name, short_name, description, created_at, updated_at)
             VALUES (:id, :name, :short_name, :description, :created_at, :updated_at)',
            [
                ':id' => $id,
                ':name' => trim((string) ($params['name'] ?? '')),
                ':short_name' => trim((string) ($params['shortName'] ?? '')),
                ':description' => $this->nullableString($params['description'] ?? null),
                ':created_at' => $this->database->nowUtc(),
                ':updated_at' => $this->database->nowUtc(),
            ]
        );

        return $this->fetchUnitById(['id' => $id]) ?? throw new RuntimeException('Failed to create unit.');
    }

    public function updateUnit(array $params): array
    {
        $this->requireAdmin();
        $id = trim((string) ($params['id'] ?? ''));
        $updates = is_array($params['updates'] ?? null) ? $params['updates'] : [];
        $payload = [];
        if (array_key_exists('name', $updates)) {
            $payload['name'] = trim((string) $updates['name']);
        }
        if (array_key_exists('shortName', $updates)) {
            $payload['short_name'] = trim((string) $updates['shortName']);
        }
        if (array_key_exists('description', $updates)) {
            $payload['description'] = $this->nullableString($updates['description']);
        }
        $this->touchUpdate('units', $id, $payload);
        return $this->fetchUnitById(['id' => $id]) ?? throw new RuntimeException('Unit not found.');
    }

    public function deleteUnit(array $params): array
    {
        $this->requireAdmin();
        $this->database->execute('DELETE FROM units WHERE id = :id', [':id' => trim((string) ($params['id'] ?? ''))]);
        return ['success' => true];
    }

    public function fetchCompanySettings(array $params = []): array
    {
        $row = $this->database->fetchOne('SELECT * FROM company_settings LIMIT 1');
        $pages = $this->normalizeCompanyPages($row['pages'] ?? [], $row ?? []);
        $globalPage = $this->getGlobalCompanyPage($pages);

        return [
            'id' => (string) ($row['id'] ?? 'company-default'),
            'name' => (string) ($globalPage['name'] ?? 'Your Company'),
            'phone' => (string) ($globalPage['phone'] ?? '+880'),
            'email' => (string) ($globalPage['email'] ?? 'info@company.com'),
            'address' => (string) ($globalPage['address'] ?? ''),
            'logo' => (string) ($globalPage['logo'] ?? ''),
            'pages' => $pages,
        ];
    }

    public function updateCompanySettings(array $params): array
    {
        $this->requireAdmin();
        $current = $this->fetchCompanySettings();
        $pages = [];

        if (array_key_exists('pages', $params)) {
            $pages = $this->normalizeCompanyPages($params['pages'], $current);
        } else {
            $pages = $this->normalizeCompanyPages($current['pages'] ?? [], $current);
            $globalIndex = 0;

            foreach ($pages as $index => $page) {
                if ((bool) ($page['isGlobalBranding'] ?? false)) {
                    $globalIndex = $index;
                    break;
                }
            }

            $pages[$globalIndex] = $this->normalizeCompanyPage(
                [
                    ...$pages[$globalIndex],
                    'name' => $params['name'] ?? $pages[$globalIndex]['name'],
                    'phone' => $params['phone'] ?? $pages[$globalIndex]['phone'],
                    'email' => $params['email'] ?? $pages[$globalIndex]['email'],
                    'address' => array_key_exists('address', $params) ? $params['address'] : $pages[$globalIndex]['address'],
                    'logo' => array_key_exists('logo', $params) ? $params['logo'] : $pages[$globalIndex]['logo'],
                    'isGlobalBranding' => true,
                ],
                $globalIndex
            );
            $pages = $this->normalizeCompanyPages($pages, $current);
        }

        $globalPage = $this->getGlobalCompanyPage($pages);

        return $this->saveSingleton(
            'company_settings',
            'company-default',
            [
                'name' => $globalPage['name'] ?? $current['name'],
                'phone' => $globalPage['phone'] ?? $current['phone'],
                'email' => $globalPage['email'] ?? $current['email'],
                'address' => $globalPage['address'] ?? $current['address'],
                'logo' => $globalPage['logo'] ?? $current['logo'],
                'pages' => $this->jsonEncode($pages),
            ],
            fn (): array => $this->fetchCompanySettings()
        );
    }

    public function fetchOrderSettings(array $params = []): array
    {
        $row = $this->database->fetchOne('SELECT * FROM order_settings LIMIT 1');
        return [
            'prefix' => (string) ($row['prefix'] ?? 'ORD-'),
            'nextNumber' => (int) ($row['next_number'] ?? 1),
        ];
    }

    public function updateOrderSettings(array $params): array
    {
        $this->requireAdmin();
        $current = $this->fetchOrderSettings();
        return $this->saveSingleton(
            'order_settings',
            'order-default',
            [
                'prefix' => $params['prefix'] ?? $current['prefix'],
                'next_number' => array_key_exists('nextNumber', $params) ? (int) $params['nextNumber'] : $current['nextNumber'],
            ],
            fn (): array => $this->fetchOrderSettings()
        );
    }

    public function fetchInvoiceSettings(array $params = []): array
    {
        $row = $this->database->fetchOne('SELECT * FROM invoice_settings LIMIT 1');
        return [
            'title' => (string) ($row['title'] ?? 'Invoice'),
            'logoWidth' => (int) ($row['logo_width'] ?? 120),
            'logoHeight' => (int) ($row['logo_height'] ?? 120),
            'footer' => (string) ($row['footer'] ?? ''),
        ];
    }

    public function updateInvoiceSettings(array $params): array
    {
        $this->requireAdmin();
        $current = $this->fetchInvoiceSettings();
        return $this->saveSingleton(
            'invoice_settings',
            'invoice-default',
            [
                'title' => $params['title'] ?? $current['title'],
                'logo_width' => array_key_exists('logoWidth', $params) ? (int) $params['logoWidth'] : $current['logoWidth'],
                'logo_height' => array_key_exists('logoHeight', $params) ? (int) $params['logoHeight'] : $current['logoHeight'],
                'footer' => array_key_exists('footer', $params) ? $params['footer'] : $current['footer'],
            ],
            fn (): array => $this->fetchInvoiceSettings()
        );
    }

    public function fetchSystemDefaults(array $params = []): array
    {
        $row = $this->database->fetchOne('SELECT * FROM system_defaults LIMIT 1');
        return [
            'defaultAccountId' => (string) ($row['default_account_id'] ?? ''),
            'defaultPaymentMethod' => (string) ($row['default_payment_method'] ?? ''),
            'incomeCategoryId' => (string) ($row['income_category_id'] ?? ''),
            'expenseCategoryId' => (string) ($row['expense_category_id'] ?? ''),
            'recordsPerPage' => (int) ($row['records_per_page'] ?? 10),
        ];
    }

    public function updateSystemDefaults(array $params): array
    {
        $this->requireAdmin();
        $current = $this->fetchSystemDefaults();
        return $this->saveSingleton(
            'system_defaults',
            'system-default',
            [
                'default_account_id' => array_key_exists('defaultAccountId', $params) ? $this->nullableString($params['defaultAccountId']) : $current['defaultAccountId'],
                'default_payment_method' => array_key_exists('defaultPaymentMethod', $params) ? $this->nullableString($params['defaultPaymentMethod']) : $current['defaultPaymentMethod'],
                'income_category_id' => array_key_exists('incomeCategoryId', $params) ? $this->nullableString($params['incomeCategoryId']) : $current['incomeCategoryId'],
                'expense_category_id' => array_key_exists('expenseCategoryId', $params) ? $this->nullableString($params['expenseCategoryId']) : $current['expenseCategoryId'],
                'records_per_page' => array_key_exists('recordsPerPage', $params) ? (int) $params['recordsPerPage'] : $current['recordsPerPage'],
            ],
            fn (): array => $this->fetchSystemDefaults()
        );
    }

    public function fetchCourierSettings(array $params = []): array
    {
        $row = $this->database->fetchOne('SELECT * FROM courier_settings LIMIT 1');
        return [
            'steadfast' => [
                'baseUrl' => (string) ($row['steadfast_base_url'] ?? ''),
                'apiKey' => (string) ($row['steadfast_api_key'] ?? ''),
                'secretKey' => (string) ($row['steadfast_secret_key'] ?? ''),
            ],
            'carryBee' => [
                'baseUrl' => (string) ($row['carrybee_base_url'] ?? ''),
                'clientId' => (string) ($row['carrybee_client_id'] ?? ''),
                'clientSecret' => (string) ($row['carrybee_client_secret'] ?? ''),
                'clientContext' => (string) ($row['carrybee_client_context'] ?? ''),
                'storeId' => (string) ($row['carrybee_store_id'] ?? ''),
            ],
            'paperfly' => [
                'baseUrl' => (string) ($row['paperfly_base_url'] ?? ''),
                'username' => (string) ($row['paperfly_username'] ?? ''),
                'password' => (string) ($row['paperfly_password'] ?? ''),
                'paperflyKey' => (string) ($row['paperfly_key'] ?? ''),
                'defaultShopName' => (string) ($row['paperfly_default_shop_name'] ?? ''),
                'maxWeightKg' => (float) ($row['paperfly_max_weight_kg'] ?? 0.3),
            ],
        ];
    }

    public function updateCourierSettings(array $params): array
    {
        $this->requireAdmin();
        $current = $this->fetchCourierSettings();
        $steadfast = is_array($params['steadfast'] ?? null) ? $params['steadfast'] : [];
        $carryBee = is_array($params['carryBee'] ?? null) ? $params['carryBee'] : [];
        $paperfly = is_array($params['paperfly'] ?? null) ? $params['paperfly'] : [];

        return $this->saveSingleton(
            'courier_settings',
            'courier-default',
            [
                'steadfast_base_url' => $steadfast['baseUrl'] ?? $current['steadfast']['baseUrl'],
                'steadfast_api_key' => $steadfast['apiKey'] ?? $current['steadfast']['apiKey'],
                'steadfast_secret_key' => $steadfast['secretKey'] ?? $current['steadfast']['secretKey'],
                'carrybee_base_url' => $carryBee['baseUrl'] ?? $current['carryBee']['baseUrl'],
                'carrybee_client_id' => $carryBee['clientId'] ?? $current['carryBee']['clientId'],
                'carrybee_client_secret' => $carryBee['clientSecret'] ?? $current['carryBee']['clientSecret'],
                'carrybee_client_context' => $carryBee['clientContext'] ?? $current['carryBee']['clientContext'],
                'carrybee_store_id' => $carryBee['storeId'] ?? $current['carryBee']['storeId'],
                'paperfly_base_url' => $paperfly['baseUrl'] ?? $current['paperfly']['baseUrl'],
                'paperfly_username' => $paperfly['username'] ?? $current['paperfly']['username'],
                'paperfly_password' => $paperfly['password'] ?? $current['paperfly']['password'],
                'paperfly_key' => $paperfly['paperflyKey'] ?? $current['paperfly']['paperflyKey'],
                'paperfly_default_shop_name' => $paperfly['defaultShopName'] ?? $current['paperfly']['defaultShopName'],
                'paperfly_max_weight_kg' => array_key_exists('maxWeightKg', $paperfly) ? (float) $paperfly['maxWeightKg'] : $current['paperfly']['maxWeightKg'],
            ],
            fn (): array => $this->fetchCourierSettings()
        );
    }

    public function fetchPermissionsSettings(array $params = []): array
    {
        return $this->buildPermissionsSettingsPayload();
    }

    public function updatePermissionsSettings(array $params): array
    {
        $this->requireAdmin();
        $roles = is_array($params['roles'] ?? null) ? $params['roles'] : [];
        if (!$this->tableExists('role_permissions')) {
            throw new RuntimeException('Permissions table is missing. Run the permissions migration first.');
        }

        $customRoleNames = [];
        foreach ($roles as $roleConfig) {
            if (!is_array($roleConfig)) {
                continue;
            }

            $roleName = $this->normalizeRoleName((string) ($roleConfig['roleName'] ?? ''));
            if ($roleName === '' || $this->isReservedPermissionRole($roleName)) {
                continue;
            }

            $permissions = $this->normalizeRolePermissions(
                $roleConfig['permissions'] ?? null,
                $this->defaultRolePermissions($roleName),
                $roleName
            );
            $now = $this->database->nowUtc();
            $isCustom = !$this->isBuiltInPermissionRole($roleName);
            if ($isCustom) {
                $customRoleNames[$roleName] = $roleName;
            }

            $this->database->execute(
                'INSERT INTO role_permissions (role_name, permissions, is_custom, created_at, updated_at)
                 VALUES (:role_name, :permissions, :is_custom, :created_at, :updated_at)
                 ON DUPLICATE KEY UPDATE
                   permissions = VALUES(permissions),
                   is_custom = VALUES(is_custom),
                   updated_at = VALUES(updated_at)',
                [
                    ':role_name' => $roleName,
                    ':permissions' => $this->jsonEncode($permissions),
                    ':is_custom' => $isCustom ? 1 : 0,
                    ':created_at' => $now,
                    ':updated_at' => $now,
                ]
            );
        }

        $customRoleNames = array_values($customRoleNames);
        if ($customRoleNames === []) {
            $this->database->execute('DELETE FROM role_permissions WHERE is_custom = 1');
        } else {
            [$placeholders, $bindings] = $this->inClause($customRoleNames, 'permission_role_name');
            $this->database->execute(
                'DELETE FROM role_permissions WHERE is_custom = 1 AND role_name NOT IN (' . implode(', ', $placeholders) . ')',
                $bindings
            );
        }

        return $this->fetchPermissionsSettings();
    }
}
