-- Add carrybee_consignment_id to orders_with_customer_creator view
-- and include it in create_order_atomic JSONB output

BEGIN;

-- Update view to include consignment id
DROP VIEW IF EXISTS orders_with_customer_creator CASCADE;

CREATE VIEW orders_with_customer_creator AS
SELECT
  o.id,
  o.order_number,
  o.order_date,
  o.customer_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  c.address AS customer_address,
  o.created_by,
  u.name AS creator_name,
  o.status,
  o.items,
  o.subtotal,
  o.discount,
  o.shipping,
  o.total,
  o.paid_amount,
  o.notes,
  o.history,
  o.created_at,
  o.carrybee_consignment_id
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN users u ON o.created_by = u.id;

-- Replace RPC to return consignment id as part of JSONB
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
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefix text;
  v_next bigint;
  v_order_id uuid;
  v_order_number text;
  v_lock_key bigint;
  v_result jsonb;
BEGIN
  SELECT prefix INTO v_prefix FROM order_settings LIMIT 1;
  v_lock_key := hashtext(COALESCE(v_prefix, ''))::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(MAX(order_seq), 0) + 1
    INTO v_next
    FROM orders
    WHERE order_seq IS NOT NULL AND (v_prefix IS NULL OR order_number LIKE v_prefix || '%');

  v_order_number := COALESCE(v_prefix, '') || v_next::text;

  INSERT INTO orders(
    order_number, order_seq, order_date, customer_id, created_by, status, items,
    subtotal, discount, shipping, total, paid_amount, notes, history
  ) VALUES (
    v_order_number, v_next, p_order_date, p_customer_id, p_created_by, p_status, p_items,
    p_subtotal, p_discount, p_shipping, p_total, p_paid_amount, p_notes, p_history
  ) RETURNING id INTO v_order_id;

  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'order_date', o.order_date::text,
    'customer_id', o.customer_id,
    'customer_name', c.name,
    'customer_phone', c.phone,
    'customer_address', c.address,
    'created_by', o.created_by,
    'creator_name', u.name,
    'status', o.status,
    'items', o.items,
    'subtotal', o.subtotal,
    'discount', o.discount,
    'shipping', o.shipping,
    'total', o.total,
    'paid_amount', o.paid_amount,
    'notes', o.notes,
    'history', o.history,
    'created_at', o.created_at::text,
    'carrybee_consignment_id', o.carrybee_consignment_id
  ) INTO v_result
  FROM orders o
  LEFT JOIN customers c ON o.customer_id = c.id
  LEFT JOIN users u ON o.created_by = u.id
  WHERE o.id = v_order_id;

  RETURN v_result;
END;
$$;

COMMIT;
