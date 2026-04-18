-- Safe schema migration for notifications, service subscriptions,
-- and transaction approval tracking.
-- Existing business data is preserved. The only data inserts performed here
-- are idempotent bootstrap records for the new subscription item/method catalogs.

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_notif_subs_tx_approval_schema $$

CREATE PROCEDURE migrate_notif_subs_tx_approval_schema()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'system_defaults'
      AND COLUMN_NAME = 'max_transaction_amount'
  ) THEN
    ALTER TABLE system_defaults
      ADD COLUMN max_transaction_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER records_per_page;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transactions'
      AND COLUMN_NAME = 'approval_status'
  ) THEN
    ALTER TABLE transactions
      ADD COLUMN approval_status VARCHAR(32) NOT NULL DEFAULT 'approved' AFTER history;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transactions'
      AND COLUMN_NAME = 'account_effect_applied'
  ) THEN
    ALTER TABLE transactions
      ADD COLUMN account_effect_applied TINYINT(1) NOT NULL DEFAULT 1 AFTER approval_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transactions'
      AND COLUMN_NAME = 'approval_requested_by'
  ) THEN
    ALTER TABLE transactions
      ADD COLUMN approval_requested_by VARCHAR(64) NULL AFTER account_effect_applied;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transactions'
      AND COLUMN_NAME = 'approval_requested_at'
  ) THEN
    ALTER TABLE transactions
      ADD COLUMN approval_requested_at DATETIME NULL AFTER approval_requested_by;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transactions'
      AND COLUMN_NAME = 'approved_by'
  ) THEN
    ALTER TABLE transactions
      ADD COLUMN approved_by VARCHAR(64) NULL AFTER approval_requested_at;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transactions'
      AND COLUMN_NAME = 'approved_at'
  ) THEN
    ALTER TABLE transactions
      ADD COLUMN approved_at DATETIME NULL AFTER approved_by;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transactions'
      AND COLUMN_NAME = 'declined_by'
  ) THEN
    ALTER TABLE transactions
      ADD COLUMN declined_by VARCHAR(64) NULL AFTER approved_at;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transactions'
      AND COLUMN_NAME = 'declined_at'
  ) THEN
    ALTER TABLE transactions
      ADD COLUMN declined_at DATETIME NULL AFTER declined_by;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transactions'
      AND COLUMN_NAME = 'approval_note'
  ) THEN
    ALTER TABLE transactions
      ADD COLUMN approval_note TEXT NULL AFTER declined_at;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transactions'
      AND INDEX_NAME = 'idx_transactions_deleted_approval_status_created_at'
  ) THEN
    ALTER TABLE transactions
      ADD INDEX idx_transactions_deleted_approval_status_created_at (deleted_at, approval_status, created_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notifications'
  ) THEN
    CREATE TABLE notifications (
      id VARCHAR(64) NOT NULL,
      system_key VARCHAR(191) NULL,
      subject VARCHAR(255) NOT NULL,
      content_html LONGTEXT NOT NULL,
      target_roles LONGTEXT NOT NULL,
      starts_at DATETIME NULL,
      ends_at DATETIME NULL,
      action_config LONGTEXT NULL,
      metadata LONGTEXT NULL,
      created_by VARCHAR(64) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_system_generated TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_notifications_system_key (system_key),
      KEY idx_notifications_active_window (is_active, starts_at, ends_at),
      KEY idx_notifications_created_by (created_by),
      KEY idx_notifications_created_at (created_at),
      CONSTRAINT fk_notifications_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'system_key'
    ) THEN
      ALTER TABLE notifications
        ADD COLUMN system_key VARCHAR(191) NULL AFTER id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'subject'
    ) THEN
      ALTER TABLE notifications
        ADD COLUMN subject VARCHAR(255) NOT NULL AFTER system_key;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'content_html'
    ) THEN
      ALTER TABLE notifications
        ADD COLUMN content_html LONGTEXT NOT NULL AFTER subject;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'target_roles'
    ) THEN
      ALTER TABLE notifications
        ADD COLUMN target_roles LONGTEXT NOT NULL AFTER content_html;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'starts_at'
    ) THEN
      ALTER TABLE notifications
        ADD COLUMN starts_at DATETIME NULL AFTER target_roles;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'ends_at'
    ) THEN
      ALTER TABLE notifications
        ADD COLUMN ends_at DATETIME NULL AFTER starts_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'action_config'
    ) THEN
      ALTER TABLE notifications
        ADD COLUMN action_config LONGTEXT NULL AFTER ends_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'metadata'
    ) THEN
      ALTER TABLE notifications
        ADD COLUMN metadata LONGTEXT NULL AFTER action_config;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'created_by'
    ) THEN
      ALTER TABLE notifications
        ADD COLUMN created_by VARCHAR(64) NULL AFTER metadata;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'is_active'
    ) THEN
      ALTER TABLE notifications
        ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER created_by;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'is_system_generated'
    ) THEN
      ALTER TABLE notifications
        ADD COLUMN is_system_generated TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'created_at'
    ) THEN
      ALTER TABLE notifications
        ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER is_system_generated;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'updated_at'
    ) THEN
      ALTER TABLE notifications
        ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'uq_notifications_system_key'
    ) THEN
      ALTER TABLE notifications
        ADD UNIQUE KEY uq_notifications_system_key (system_key);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'idx_notifications_active_window'
    ) THEN
      ALTER TABLE notifications
        ADD INDEX idx_notifications_active_window (is_active, starts_at, ends_at);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'idx_notifications_created_by'
    ) THEN
      ALTER TABLE notifications
        ADD INDEX idx_notifications_created_by (created_by);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'idx_notifications_created_at'
    ) THEN
      ALTER TABLE notifications
        ADD INDEX idx_notifications_created_at (created_at);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'notifications'
        AND CONSTRAINT_NAME = 'fk_notifications_created_by'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
      ALTER TABLE notifications
        ADD CONSTRAINT fk_notifications_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notification_receipts'
  ) THEN
    CREATE TABLE notification_receipts (
      notification_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      read_at DATETIME NULL,
      action_result VARCHAR(32) NULL,
      acted_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (notification_id, user_id),
      KEY idx_notification_receipts_user_read (user_id, is_read, read_at),
      KEY idx_notification_receipts_action_result (action_result),
      CONSTRAINT fk_notification_receipts_notification FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE CASCADE,
      CONSTRAINT fk_notification_receipts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_receipts' AND COLUMN_NAME = 'is_read'
    ) THEN
      ALTER TABLE notification_receipts
        ADD COLUMN is_read TINYINT(1) NOT NULL DEFAULT 0 AFTER user_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_receipts' AND COLUMN_NAME = 'read_at'
    ) THEN
      ALTER TABLE notification_receipts
        ADD COLUMN read_at DATETIME NULL AFTER is_read;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_receipts' AND COLUMN_NAME = 'action_result'
    ) THEN
      ALTER TABLE notification_receipts
        ADD COLUMN action_result VARCHAR(32) NULL AFTER read_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_receipts' AND COLUMN_NAME = 'acted_at'
    ) THEN
      ALTER TABLE notification_receipts
        ADD COLUMN acted_at DATETIME NULL AFTER action_result;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_receipts' AND COLUMN_NAME = 'created_at'
    ) THEN
      ALTER TABLE notification_receipts
        ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER acted_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_receipts' AND COLUMN_NAME = 'updated_at'
    ) THEN
      ALTER TABLE notification_receipts
        ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_receipts' AND INDEX_NAME = 'idx_notification_receipts_user_read'
    ) THEN
      ALTER TABLE notification_receipts
        ADD INDEX idx_notification_receipts_user_read (user_id, is_read, read_at);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_receipts' AND INDEX_NAME = 'idx_notification_receipts_action_result'
    ) THEN
      ALTER TABLE notification_receipts
        ADD INDEX idx_notification_receipts_action_result (action_result);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'notification_receipts'
        AND CONSTRAINT_NAME = 'fk_notification_receipts_notification'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
      ALTER TABLE notification_receipts
        ADD CONSTRAINT fk_notification_receipts_notification FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'notification_receipts'
        AND CONSTRAINT_NAME = 'fk_notification_receipts_user'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
      ALTER TABLE notification_receipts
        ADD CONSTRAINT fk_notification_receipts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'service_subscription_settings'
  ) THEN
    CREATE TABLE service_subscription_settings (
      id VARCHAR(64) NOT NULL,
      due_at DATETIME NULL,
      reset_day_of_month TINYINT UNSIGNED NULL,
      reset_time_of_day TIME NULL,
      warning_days INT NOT NULL DEFAULT 7,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      nagad_number VARCHAR(64) NULL,
      billing_version INT NOT NULL DEFAULT 1,
      created_by VARCHAR(64) NULL,
      updated_by VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_service_subscription_settings_due_at (due_at),
      CONSTRAINT fk_service_subscription_settings_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
      CONSTRAINT fk_service_subscription_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_settings' AND COLUMN_NAME = 'due_at'
    ) THEN
      ALTER TABLE service_subscription_settings
        ADD COLUMN due_at DATETIME NULL AFTER id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_settings' AND COLUMN_NAME = 'reset_day_of_month'
    ) THEN
      ALTER TABLE service_subscription_settings
        ADD COLUMN reset_day_of_month TINYINT UNSIGNED NULL AFTER due_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_settings' AND COLUMN_NAME = 'reset_time_of_day'
    ) THEN
      ALTER TABLE service_subscription_settings
        ADD COLUMN reset_time_of_day TIME NULL AFTER reset_day_of_month;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_settings' AND COLUMN_NAME = 'warning_days'
    ) THEN
      ALTER TABLE service_subscription_settings
        ADD COLUMN warning_days INT NOT NULL DEFAULT 7 AFTER reset_time_of_day;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_settings' AND COLUMN_NAME = 'total_amount'
    ) THEN
      ALTER TABLE service_subscription_settings
        ADD COLUMN total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER warning_days;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_settings' AND COLUMN_NAME = 'nagad_number'
    ) THEN
      ALTER TABLE service_subscription_settings
        ADD COLUMN nagad_number VARCHAR(64) NULL AFTER total_amount;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_settings' AND COLUMN_NAME = 'billing_version'
    ) THEN
      ALTER TABLE service_subscription_settings
        ADD COLUMN billing_version INT NOT NULL DEFAULT 1 AFTER nagad_number;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_settings' AND COLUMN_NAME = 'created_by'
    ) THEN
      ALTER TABLE service_subscription_settings
        ADD COLUMN created_by VARCHAR(64) NULL AFTER billing_version;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_settings' AND COLUMN_NAME = 'updated_by'
    ) THEN
      ALTER TABLE service_subscription_settings
        ADD COLUMN updated_by VARCHAR(64) NULL AFTER created_by;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_settings' AND COLUMN_NAME = 'created_at'
    ) THEN
      ALTER TABLE service_subscription_settings
        ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER updated_by;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_settings' AND COLUMN_NAME = 'updated_at'
    ) THEN
      ALTER TABLE service_subscription_settings
        ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_settings' AND INDEX_NAME = 'idx_service_subscription_settings_due_at'
    ) THEN
      ALTER TABLE service_subscription_settings
        ADD INDEX idx_service_subscription_settings_due_at (due_at);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'service_subscription_settings'
        AND CONSTRAINT_NAME = 'fk_service_subscription_settings_created_by'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
      ALTER TABLE service_subscription_settings
        ADD CONSTRAINT fk_service_subscription_settings_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'service_subscription_settings'
        AND CONSTRAINT_NAME = 'fk_service_subscription_settings_updated_by'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
      ALTER TABLE service_subscription_settings
        ADD CONSTRAINT fk_service_subscription_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'service_subscription_settings'
      AND COLUMN_NAME = 'reset_day_of_month'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'service_subscription_settings'
      AND COLUMN_NAME = 'reset_time_of_day'
  ) THEN
    UPDATE service_subscription_settings
    SET
      reset_day_of_month = COALESCE(reset_day_of_month, DAY(due_at)),
      reset_time_of_day = COALESCE(reset_time_of_day, TIME(due_at))
    WHERE due_at IS NOT NULL
      AND (reset_day_of_month IS NULL OR reset_time_of_day IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'service_subscription_items'
  ) THEN
    CREATE TABLE service_subscription_items (
      id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      amount DECIMAL(12,2) NULL,
      is_optional TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      display_order INT NOT NULL DEFAULT 0,
      system_key VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_service_subscription_items_system_key (system_key),
      KEY idx_service_subscription_items_active_order (is_active, display_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_items' AND COLUMN_NAME = 'description'
    ) THEN
      ALTER TABLE service_subscription_items
        ADD COLUMN description TEXT NULL AFTER name;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_items' AND COLUMN_NAME = 'amount'
    ) THEN
      ALTER TABLE service_subscription_items
        ADD COLUMN amount DECIMAL(12,2) NULL AFTER description;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_items' AND COLUMN_NAME = 'is_optional'
    ) THEN
      ALTER TABLE service_subscription_items
        ADD COLUMN is_optional TINYINT(1) NOT NULL DEFAULT 0 AFTER amount;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_items' AND COLUMN_NAME = 'is_active'
    ) THEN
      ALTER TABLE service_subscription_items
        ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER is_optional;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_items' AND COLUMN_NAME = 'display_order'
    ) THEN
      ALTER TABLE service_subscription_items
        ADD COLUMN display_order INT NOT NULL DEFAULT 0 AFTER is_active;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_items' AND COLUMN_NAME = 'system_key'
    ) THEN
      ALTER TABLE service_subscription_items
        ADD COLUMN system_key VARCHAR(191) NULL AFTER display_order;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_items' AND COLUMN_NAME = 'created_at'
    ) THEN
      ALTER TABLE service_subscription_items
        ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER system_key;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_items' AND COLUMN_NAME = 'updated_at'
    ) THEN
      ALTER TABLE service_subscription_items
        ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_items' AND INDEX_NAME = 'uq_service_subscription_items_system_key'
    ) THEN
      ALTER TABLE service_subscription_items
        ADD UNIQUE KEY uq_service_subscription_items_system_key (system_key);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_items' AND INDEX_NAME = 'idx_service_subscription_items_active_order'
    ) THEN
      ALTER TABLE service_subscription_items
        ADD INDEX idx_service_subscription_items_active_order (is_active, display_order);
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'service_subscription_methods'
  ) THEN
    CREATE TABLE service_subscription_methods (
      id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      display_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_service_subscription_methods_active_order (is_active, display_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_methods' AND COLUMN_NAME = 'description'
    ) THEN
      ALTER TABLE service_subscription_methods
        ADD COLUMN description TEXT NULL AFTER name;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_methods' AND COLUMN_NAME = 'is_active'
    ) THEN
      ALTER TABLE service_subscription_methods
        ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER description;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_methods' AND COLUMN_NAME = 'display_order'
    ) THEN
      ALTER TABLE service_subscription_methods
        ADD COLUMN display_order INT NOT NULL DEFAULT 0 AFTER is_active;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_methods' AND COLUMN_NAME = 'created_at'
    ) THEN
      ALTER TABLE service_subscription_methods
        ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER display_order;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_methods' AND COLUMN_NAME = 'updated_at'
    ) THEN
      ALTER TABLE service_subscription_methods
        ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_methods' AND INDEX_NAME = 'idx_service_subscription_methods_active_order'
    ) THEN
      ALTER TABLE service_subscription_methods
        ADD INDEX idx_service_subscription_methods_active_order (is_active, display_order);
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'service_subscription_payments'
  ) THEN
    CREATE TABLE service_subscription_payments (
      id VARCHAR(64) NOT NULL,
      billing_version INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      base_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      tip_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      payment_method_id VARCHAR(64) NULL,
      payment_method_name VARCHAR(255) NOT NULL,
      transaction_id VARCHAR(255) NOT NULL,
      submitted_by VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'processing',
      submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reactivate_at DATETIME NULL,
      processed_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_service_subscription_payments_version_tx (billing_version, transaction_id),
      KEY idx_service_subscription_payments_status_ready (status, reactivate_at),
      KEY idx_service_subscription_payments_billing_version (billing_version, submitted_at),
      KEY idx_service_subscription_payments_submitted_by (submitted_by),
      CONSTRAINT fk_service_subscription_payments_method FOREIGN KEY (payment_method_id) REFERENCES service_subscription_methods (id) ON DELETE SET NULL,
      CONSTRAINT fk_service_subscription_payments_submitted_by FOREIGN KEY (submitted_by) REFERENCES users (id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND COLUMN_NAME = 'billing_version'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD COLUMN billing_version INT NOT NULL DEFAULT 1 AFTER id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND COLUMN_NAME = 'amount'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD COLUMN amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER billing_version;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND COLUMN_NAME = 'base_amount'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD COLUMN base_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER amount;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND COLUMN_NAME = 'tip_amount'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD COLUMN tip_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER base_amount;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND COLUMN_NAME = 'payment_method_id'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD COLUMN payment_method_id VARCHAR(64) NULL AFTER tip_amount;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND COLUMN_NAME = 'payment_method_name'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD COLUMN payment_method_name VARCHAR(255) NOT NULL DEFAULT '' AFTER payment_method_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND COLUMN_NAME = 'transaction_id'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD COLUMN transaction_id VARCHAR(255) NOT NULL DEFAULT '' AFTER payment_method_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND COLUMN_NAME = 'submitted_by'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD COLUMN submitted_by VARCHAR(64) NOT NULL AFTER transaction_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND COLUMN_NAME = 'status'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'processing' AFTER submitted_by;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND COLUMN_NAME = 'submitted_at'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD COLUMN submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER status;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND COLUMN_NAME = 'reactivate_at'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD COLUMN reactivate_at DATETIME NULL AFTER submitted_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND COLUMN_NAME = 'processed_at'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD COLUMN processed_at DATETIME NULL AFTER reactivate_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND COLUMN_NAME = 'created_at'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER processed_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND COLUMN_NAME = 'updated_at'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND INDEX_NAME = 'uq_service_subscription_payments_version_tx'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD UNIQUE KEY uq_service_subscription_payments_version_tx (billing_version, transaction_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND INDEX_NAME = 'idx_service_subscription_payments_status_ready'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD INDEX idx_service_subscription_payments_status_ready (status, reactivate_at);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND INDEX_NAME = 'idx_service_subscription_payments_billing_version'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD INDEX idx_service_subscription_payments_billing_version (billing_version, submitted_at);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_subscription_payments' AND INDEX_NAME = 'idx_service_subscription_payments_submitted_by'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD INDEX idx_service_subscription_payments_submitted_by (submitted_by);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'service_subscription_payments'
        AND CONSTRAINT_NAME = 'fk_service_subscription_payments_method'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD CONSTRAINT fk_service_subscription_payments_method FOREIGN KEY (payment_method_id) REFERENCES service_subscription_methods (id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'service_subscription_payments'
        AND CONSTRAINT_NAME = 'fk_service_subscription_payments_submitted_by'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
      ALTER TABLE service_subscription_payments
        ADD CONSTRAINT fk_service_subscription_payments_submitted_by FOREIGN KEY (submitted_by) REFERENCES users (id) ON DELETE RESTRICT;
    END IF;
  END IF;

  INSERT INTO service_subscription_items (
    id, name, description, amount, is_optional, is_active, display_order, system_key, created_at, updated_at
  )
  SELECT
    'service-item-db-hosting', 'Database hosting', NULL, NULL, 0, 1, 10, 'database-hosting', UTC_TIMESTAMP(), UTC_TIMESTAMP()
  FROM DUAL
  WHERE NOT EXISTS (
    SELECT 1 FROM service_subscription_items WHERE system_key = 'database-hosting'
  );

  INSERT INTO service_subscription_items (
    id, name, description, amount, is_optional, is_active, display_order, system_key, created_at, updated_at
  )
  SELECT
    'service-item-caching', 'Caching (Redis, in-memory stores)', NULL, NULL, 0, 1, 20, 'caching', UTC_TIMESTAMP(), UTC_TIMESTAMP()
  FROM DUAL
  WHERE NOT EXISTS (
    SELECT 1 FROM service_subscription_items WHERE system_key = 'caching'
  );

  INSERT INTO service_subscription_items (
    id, name, description, amount, is_optional, is_active, display_order, system_key, created_at, updated_at
  )
  SELECT
    'service-item-auth', 'Auth', NULL, NULL, 0, 1, 30, 'auth', UTC_TIMESTAMP(), UTC_TIMESTAMP()
  FROM DUAL
  WHERE NOT EXISTS (
    SELECT 1 FROM service_subscription_items WHERE system_key = 'auth'
  );

  INSERT INTO service_subscription_items (
    id, name, description, amount, is_optional, is_active, display_order, system_key, created_at, updated_at
  )
  SELECT
    'service-item-cdn', 'CDN', NULL, NULL, 0, 1, 40, 'cdn', UTC_TIMESTAMP(), UTC_TIMESTAMP()
  FROM DUAL
  WHERE NOT EXISTS (
    SELECT 1 FROM service_subscription_items WHERE system_key = 'cdn'
  );

  INSERT INTO service_subscription_items (
    id, name, description, amount, is_optional, is_active, display_order, system_key, created_at, updated_at
  )
  SELECT
    'service-item-load-balancer', 'Load balancer', NULL, NULL, 0, 1, 50, 'load-balancer', UTC_TIMESTAMP(), UTC_TIMESTAMP()
  FROM DUAL
  WHERE NOT EXISTS (
    SELECT 1 FROM service_subscription_items WHERE system_key = 'load-balancer'
  );

  INSERT INTO service_subscription_items (
    id, name, description, amount, is_optional, is_active, display_order, system_key, created_at, updated_at
  )
  SELECT
    'service-item-maintenance', 'Maintenance cost', NULL, NULL, 1, 1, 60, 'maintenance-cost', UTC_TIMESTAMP(), UTC_TIMESTAMP()
  FROM DUAL
  WHERE NOT EXISTS (
    SELECT 1 FROM service_subscription_items WHERE system_key = 'maintenance-cost'
  );

  INSERT INTO service_subscription_methods (
    id, name, description, is_active, display_order, created_at, updated_at
  )
  SELECT
    'service-method-nagad', 'Nagad', 'Primary renewal payment method', 1, 10, UTC_TIMESTAMP(), UTC_TIMESTAMP()
  FROM DUAL
  WHERE NOT EXISTS (
    SELECT 1 FROM service_subscription_methods WHERE id = 'service-method-nagad'
  );

  DROP VIEW IF EXISTS transactions_with_relations;
  CREATE VIEW transactions_with_relations AS
  SELECT
    t.id,
    t.date,
    t.type,
    t.category,
    t.account_id AS accountId,
    a.name AS accountName,
    t.to_account_id AS toAccountId,
    t.amount,
    t.description,
    t.reference_id AS referenceId,
    t.contact_id AS contactId,
    COALESCE(c.name, v.name) AS contactName,
    CASE
      WHEN c.id IS NOT NULL THEN 'Customer'
      WHEN v.id IS NOT NULL THEN 'Vendor'
      ELSE NULL
    END AS contactType,
    t.payment_method AS paymentMethod,
    t.attachment_name AS attachmentName,
    t.attachment_url AS attachmentUrl,
    t.created_by AS createdBy,
    u.name AS creatorName,
    t.approval_status AS approvalStatus,
    t.account_effect_applied AS accountEffectApplied,
    t.approval_requested_at AS approvalRequestedAt,
    t.approved_at AS approvedAt,
    t.declined_at AS declinedAt,
    t.approval_note AS approvalNote,
    t.created_at AS createdAt,
    t.deleted_at AS deletedAt,
    t.deleted_by AS deletedBy
  FROM transactions t
  LEFT JOIN accounts a ON a.id = t.account_id
  LEFT JOIN customers c ON c.id = t.contact_id
  LEFT JOIN vendors v ON v.id = t.contact_id
  LEFT JOIN users u ON u.id = t.created_by
  WHERE t.deleted_at IS NULL;
END $$

CALL migrate_notif_subs_tx_approval_schema() $$

DROP PROCEDURE IF EXISTS migrate_notif_subs_tx_approval_schema $$

DELIMITER ;
