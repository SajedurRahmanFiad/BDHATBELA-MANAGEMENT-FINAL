-- Migration: Create sequence for order numbers and set default order_number
-- Ensures atomic allocation of numeric suffix and preserves existing prefix from order_settings
BEGIN;

-- Create sequence if not exists
CREATE SEQUENCE IF NOT EXISTS order_number_seq;

-- Initialize sequence to the current maximum numeric suffix found in orders.order_number
DO $$
DECLARE
  maxnum bigint := 0;
BEGIN
  -- Remove non-digits using POSIX-compatible class and guard empty results before casting
  SELECT COALESCE(MAX((NULLIF(regexp_replace(order_number, '[^0-9]', '', 'g'), '')::bigint)), 0) INTO maxnum FROM orders WHERE order_number IS NOT NULL;
  PERFORM setval('order_number_seq', maxnum, true);
END$$;

-- Create helper function to compose the order number using prefix + sequence.
-- Using a function avoids putting a subquery in a DEFAULT expression (which is disallowed).
CREATE OR REPLACE FUNCTION next_order_number() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  p text := '';
  n bigint;
BEGIN
  SELECT prefix INTO p FROM order_settings LIMIT 1;
  n := nextval('order_number_seq');
  RETURN COALESCE(p, '') || n::text;
END$$;

-- Set default to call the function which atomically advances the sequence and reads the prefix.
ALTER TABLE IF EXISTS orders ALTER COLUMN order_number SET DEFAULT next_order_number();

COMMIT;

-- Notes:
-- 1) This migration creates a sequence `order_number_seq` and seeds it with the current maximum numeric
--    suffix found within the `orders.order_number` values. It then sets a column default so future inserts
--    that omit `order_number` will receive an atomic value of `prefix || nextval('order_number_seq')`.
-- 2) If your application stores prefix elsewhere or uses multiple prefixes, prefer an RPC that assigns
--    the composed order_number in a controlled transaction instead. This migration assumes a single
--    canonical prefix row in `order_settings`.
