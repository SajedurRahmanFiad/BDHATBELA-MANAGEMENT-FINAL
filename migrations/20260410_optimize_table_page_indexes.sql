-- Add composite indexes that match the paginated table-page access patterns.
-- These are additive and safe to run repeatedly on MariaDB 10.4+.

CREATE INDEX IF NOT EXISTS idx_customers_deleted_created_at
  ON customers(deleted_at, created_at);

CREATE INDEX IF NOT EXISTS idx_vendors_deleted_created_at
  ON vendors(deleted_at, created_at);

CREATE INDEX IF NOT EXISTS idx_products_deleted_created_at
  ON products(deleted_at, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_deleted_created_at
  ON orders(deleted_at, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_deleted_status_created_at
  ON orders(deleted_at, status, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_deleted_created_by_created_at
  ON orders(deleted_at, created_by, created_at);

CREATE INDEX IF NOT EXISTS idx_bills_deleted_created_at
  ON bills(deleted_at, created_at);

CREATE INDEX IF NOT EXISTS idx_bills_deleted_created_by_created_at
  ON bills(deleted_at, created_by, created_at);

CREATE INDEX IF NOT EXISTS idx_transactions_deleted_created_at
  ON transactions(deleted_at, created_at);

CREATE INDEX IF NOT EXISTS idx_transactions_deleted_type_created_at
  ON transactions(deleted_at, type, created_at);
