-- Migration: Add order_seq column and update create_order_atomic to use order_seq for allocation
BEGIN;

-- 1) Add numeric suffix column for fast allocation
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS order_seq bigint;

-- 2) Populate order_seq from existing order_number values where possible
UPDATE orders
SET order_seq = (NULLIF(regexp_replace(order_number, '[^0-9]', '', 'g'), '')::bigint)
WHERE order_seq IS NULL AND order_number IS NOT NULL AND regexp_replace(order_number, '[^0-9]', '', 'g') <> '';

-- 3) Create index to speed MAX(order_seq) queries
CREATE INDEX IF NOT EXISTS idx_orders_order_seq ON orders(order_seq);

-- 4) Replace create_order_atomic to use order_seq for fast allocation. Drop first if exists.
DROP FUNCTION IF EXISTS create_order_atomic(date, uuid, uuid, text, jsonb, numeric, numeric, numeric, numeric, numeric, text, jsonb);

CREATE FUNCTION public.create_order_atomic(
  p_order_date date,
  p_customer_id uuid,
  p_created_by uuid,
  p_status text,
  p_items jsonb,
  p_subtotal numeric,
  p_discount numeric,
  p_shipping numeric,
  p_total numeric,
  p_paid_amount numeric,
  p_notes text,
  p_history jsonb
) RETURNS orders
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefix text;
  v_next bigint;
  v_row orders%ROWTYPE;
  v_lock_key bigint;
BEGIN
  -- Read prefix from order_settings (assumes single row)
  SELECT prefix INTO v_prefix FROM order_settings LIMIT 1;

  -- Compute a lock key derived from prefix so different prefixes allocate in parallel
  v_lock_key := hashtext(COALESCE(v_prefix, ''))::bigint;

  -- Acquire an advisory transaction lock scoped to the prefix
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Compute next number as MAX(order_seq) for this prefix + 1
  SELECT COALESCE(MAX(order_seq), 0) + 1
    INTO v_next
    FROM orders
    WHERE order_seq IS NOT NULL AND (v_prefix IS NULL OR order_number LIKE v_prefix || '%');

  -- Insert using the computed order_seq and composed order_number
  INSERT INTO orders(
    order_number, order_seq, order_date, customer_id, created_by, status, items, subtotal, discount, shipping, total, paid_amount, notes, history
  ) VALUES (
    COALESCE(v_prefix, '') || v_next::text, v_next, p_order_date, p_customer_id, p_created_by, p_status, p_items, p_subtotal, p_discount, p_shipping, p_total, p_paid_amount, p_notes, p_history
  ) RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMIT;

-- Notes:
-- 1) `order_seq` stores the numeric suffix for faster MAX queries.
-- 2) The RPC uses an advisory lock keyed by the prefix so allocations are serialized per-prefix,
--    allowing reuse of lower numbers after deletes while remaining safe under concurrency.
