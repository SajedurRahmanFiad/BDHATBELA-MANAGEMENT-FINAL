-- Safe schema-only migration for the User Activity & Performance report.
-- This script does NOT update, insert, or delete existing row data.
-- It only adds the missing composite index when the target table exists.

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_user_activity_report_indexes_schema_only $$

CREATE PROCEDURE migrate_user_activity_report_indexes_schema_only()
BEGIN
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
      AND INDEX_NAME = 'idx_transactions_deleted_created_by_created_at'
  ) THEN
    ALTER TABLE transactions
      ADD INDEX idx_transactions_deleted_created_by_created_at (deleted_at, created_by, created_at);
  END IF;
END $$

CALL migrate_user_activity_report_indexes_schema_only() $$

DROP PROCEDURE IF EXISTS migrate_user_activity_report_indexes_schema_only $$

DELIMITER ;
