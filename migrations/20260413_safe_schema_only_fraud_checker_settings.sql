-- Safe schema-only migration for Fraud Checker settings.
-- Adds the fraud_checker_api_key column to courier_settings when missing.

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_fraud_checker_schema_only $$

CREATE PROCEDURE migrate_fraud_checker_schema_only()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'courier_settings'
  ) THEN
    CREATE TABLE courier_settings (
      id VARCHAR(64) NOT NULL,
      steadfast_enabled TINYINT(1) NOT NULL DEFAULT 0,
      steadfast_base_url VARCHAR(255) NULL,
      steadfast_api_key VARCHAR(500) NULL,
      steadfast_secret_key VARCHAR(500) NULL,
      carrybee_enabled TINYINT(1) NOT NULL DEFAULT 0,
      carrybee_base_url VARCHAR(255) NULL,
      carrybee_client_id VARCHAR(255) NULL,
      carrybee_client_secret VARCHAR(500) NULL,
      carrybee_client_context VARCHAR(255) NULL,
      carrybee_store_id VARCHAR(255) NULL,
      paperfly_base_url VARCHAR(255) NULL,
      paperfly_username VARCHAR(255) NULL,
      paperfly_password VARCHAR(500) NULL,
      paperfly_key VARCHAR(500) NULL,
      paperfly_default_shop_name VARCHAR(255) NULL,
      paperfly_max_weight_kg DECIMAL(10,3) NOT NULL DEFAULT 0.300,
      fraud_checker_api_key VARCHAR(500) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'courier_settings'
        AND COLUMN_NAME = 'fraud_checker_api_key'
    ) THEN
      ALTER TABLE courier_settings
        ADD COLUMN fraud_checker_api_key VARCHAR(500) NULL AFTER paperfly_max_weight_kg;
    END IF;
  END IF;
END $$

CALL migrate_fraud_checker_schema_only() $$

DROP PROCEDURE IF EXISTS migrate_fraud_checker_schema_only $$

DELIMITER ;
