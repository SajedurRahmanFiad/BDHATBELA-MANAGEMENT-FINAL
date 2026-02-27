-- Ensure customers cannot be deleted if referenced by orders
-- This replaces any existing FK with ON DELETE CASCADE/SET NULL behavior.

BEGIN;

-- Drop existing FK if present
ALTER TABLE IF EXISTS orders DROP CONSTRAINT IF EXISTS fk_orders_customer;

-- Recreate FK with RESTRICT (default) to prevent cascading deletes
ALTER TABLE IF EXISTS orders
  ADD CONSTRAINT fk_orders_customer
  FOREIGN KEY (customer_id)
  REFERENCES customers(id)
  ON DELETE RESTRICT;

COMMIT;
