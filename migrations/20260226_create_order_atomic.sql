-- Migration: Add server-side RPC to atomically allocate order_number and insert order
BEGIN;

-- Drop existing function with the same signature first to allow changing return type safely
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

  -- Compute next number as MAX existing numeric suffix for this prefix + 1
  SELECT COALESCE(MAX((NULLIF(regexp_replace(order_number, '[^0-9]', '', 'g'), '')::bigint)), 0) + 1
    INTO v_next
    FROM orders
    WHERE order_number IS NOT NULL AND (v_prefix IS NULL OR order_number LIKE v_prefix || '%');

  -- Insert using the computed order number
  INSERT INTO orders(
    order_number, order_date, customer_id, created_by, status, items, subtotal, discount, shipping, total, paid_amount, notes, history
  ) VALUES (
    COALESCE(v_prefix, '') || v_next::text, p_order_date, p_customer_id, p_created_by, p_status, p_items, p_subtotal, p_discount, p_shipping, p_total, p_paid_amount, p_notes, p_history
  ) RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMIT;

-- Notes:
-- This RPC computes the next order number using the prefix stored in `order_settings` and the
-- current maximum numeric suffix in `orders.order_number`. It then inserts the order and returns
-- the inserted row. Because the function runs inside the database, allocation is atomic.
