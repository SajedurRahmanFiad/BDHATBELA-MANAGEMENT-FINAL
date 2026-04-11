-- Safe schema-only migration for role-based permissions.
-- This script does NOT insert, update, or delete row data.
-- It only creates the role_permissions table when missing and
-- adds missing columns/indexes when the table already exists.

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_role_permissions_schema_only $$

CREATE PROCEDURE migrate_role_permissions_schema_only()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'role_permissions'
  ) THEN
    CREATE TABLE role_permissions (
      role_name VARCHAR(64) NOT NULL,
      permissions LONGTEXT NULL,
      is_custom TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (role_name),
      KEY idx_role_permissions_is_custom (is_custom)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'role_permissions'
        AND COLUMN_NAME = 'permissions'
    ) THEN
      ALTER TABLE role_permissions
        ADD COLUMN permissions LONGTEXT NULL AFTER role_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'role_permissions'
        AND COLUMN_NAME = 'is_custom'
    ) THEN
      ALTER TABLE role_permissions
        ADD COLUMN is_custom TINYINT(1) NOT NULL DEFAULT 0 AFTER permissions;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'role_permissions'
        AND COLUMN_NAME = 'created_at'
    ) THEN
      ALTER TABLE role_permissions
        ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER is_custom;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'role_permissions'
        AND COLUMN_NAME = 'updated_at'
    ) THEN
      ALTER TABLE role_permissions
        ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'role_permissions'
        AND INDEX_NAME = 'idx_role_permissions_is_custom'
    ) THEN
      ALTER TABLE role_permissions
        ADD INDEX idx_role_permissions_is_custom (is_custom);
    END IF;
  END IF;
END $$

CALL migrate_role_permissions_schema_only() $$

DROP PROCEDURE IF EXISTS migrate_role_permissions_schema_only $$

DELIMITER ;
