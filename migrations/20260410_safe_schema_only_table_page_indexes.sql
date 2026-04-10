-- Safe schema-only migration for table-page performance indexes.
-- This script does NOT update, insert, or delete existing row data.
-- It only adds missing indexes, and only when the target table exists.
--
-- Note:
-- Building an index reads existing rows to construct the index structure,
-- but it does not change any row values.

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_table_page_indexes_schema_only $$

CREATE PROCEDURE migrate_table_page_indexes_schema_only()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customers'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customers'
      AND INDEX_NAME = 'idx_customers_deleted_created_at'
  ) THEN
    ALTER TABLE customers
      ADD INDEX idx_customers_deleted_created_at (deleted_at, created_at);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vendors'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vendors'
      AND INDEX_NAME = 'idx_vendors_deleted_created_at'
  ) THEN
    ALTER TABLE vendors
      ADD INDEX idx_vendors_deleted_created_at (deleted_at, created_at);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND INDEX_NAME = 'idx_products_deleted_created_at'
  ) THEN
    ALTER TABLE products
      ADD INDEX idx_products_deleted_created_at (deleted_at, created_at);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND INDEX_NAME = 'idx_orders_deleted_created_at'
  ) THEN
    ALTER TABLE orders
      ADD INDEX idx_orders_deleted_created_at (deleted_at, created_at);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND INDEX_NAME = 'idx_orders_deleted_status_created_at'
  ) THEN
    ALTER TABLE orders
      ADD INDEX idx_orders_deleted_status_created_at (deleted_at, status, created_at);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND INDEX_NAME = 'idx_orders_deleted_created_by_created_at'
  ) THEN
    ALTER TABLE orders
      ADD INDEX idx_orders_deleted_created_by_created_at (deleted_at, created_by, created_at);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bills'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bills'
      AND INDEX_NAME = 'idx_bills_deleted_created_at'
  ) THEN
    ALTER TABLE bills
      ADD INDEX idx_bills_deleted_created_at (deleted_at, created_at);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bills'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bills'
      AND INDEX_NAME = 'idx_bills_deleted_created_by_created_at'
  ) THEN
    ALTER TABLE bills
      ADD INDEX idx_bills_deleted_created_by_created_at (deleted_at, created_by, created_at);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transactions'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transactions'
      AND INDEX_NAME = 'idx_transactions_deleted_created_at'
  ) THEN
    ALTER TABLE transactions
      ADD INDEX idx_transactions_deleted_created_at (deleted_at, created_at);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transactions'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transactions'
      AND INDEX_NAME = 'idx_transactions_deleted_type_created_at'
  ) THEN
    ALTER TABLE transactions
      ADD INDEX idx_transactions_deleted_type_created_at (deleted_at, type, created_at);
  END IF;
END $$

CALL migrate_table_page_indexes_schema_only() $$

DROP PROCEDURE IF EXISTS migrate_table_page_indexes_schema_only $$

DELIMITER ;
