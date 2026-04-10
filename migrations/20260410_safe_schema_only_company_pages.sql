-- Safe schema-only migration for multi-page company branding.
-- This script does NOT update, insert, or delete existing row data.
-- It only:
-- 1. Adds nullable columns if they do not already exist
-- 2. Adds an index if it does not already exist
-- 3. Recreates the orders_with_customer_creator view

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_company_pages_schema_only $$

CREATE PROCEDURE migrate_company_pages_schema_only()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'company_settings'
      AND COLUMN_NAME = 'pages'
  ) THEN
    ALTER TABLE company_settings
      ADD COLUMN pages LONGTEXT NULL AFTER logo;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'page_id'
  ) THEN
    ALTER TABLE orders
      ADD COLUMN page_id VARCHAR(64) NULL AFTER customer_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'page_snapshot'
  ) THEN
    ALTER TABLE orders
      ADD COLUMN page_snapshot LONGTEXT NULL AFTER history;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND INDEX_NAME = 'idx_orders_page_id'
  ) THEN
    ALTER TABLE orders
      ADD INDEX idx_orders_page_id (page_id);
  END IF;

  SET @view_sql = '
    CREATE OR REPLACE VIEW orders_with_customer_creator AS
    SELECT
      o.id,
      o.order_number AS orderNumber,
      o.order_date AS orderDate,
      o.customer_id AS customerId,
      o.page_id AS pageId,
      c.name AS customerName,
      c.phone AS customerPhone,
      c.address AS customerAddress,
      o.created_by AS createdBy,
      u.name AS creatorName,
      o.status,
      o.items,
      o.subtotal,
      o.discount,
      o.shipping,
      o.total,
      o.paid_amount AS paidAmount,
      o.notes,
      o.history,
      o.page_snapshot AS pageSnapshot,
      o.created_at AS createdAt,
      o.deleted_at AS deletedAt,
      o.deleted_by AS deletedBy,
      o.carrybee_consignment_id AS carrybeeConsignmentId,
      o.steadfast_consignment_id AS steadfastConsignmentId,
      o.paperfly_tracking_number AS paperflyTrackingNumber
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN users u ON u.id = o.created_by
    WHERE o.deleted_at IS NULL
  ';

  PREPARE stmt FROM @view_sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
END $$

CALL migrate_company_pages_schema_only() $$

DROP PROCEDURE IF EXISTS migrate_company_pages_schema_only $$

DELIMITER ;
