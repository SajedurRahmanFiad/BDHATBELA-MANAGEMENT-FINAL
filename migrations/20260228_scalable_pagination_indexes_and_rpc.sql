-- Migration: Implement scalable pagination with relational joins and indexing
-- Adds indexes for searchable/sortable columns and creates RPC function that returns
-- joined customer name/phone and creator username with each order.

BEGIN;

-- Ensure order_seq column exists (may have been added in migration 20260227)
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS order_seq bigint;
CREATE INDEX IF NOT EXISTS idx_orders_order_seq ON orders(order_seq);

-- Ensure foreign keys and indexes for relational integrity
-- PostgreSQL doesn't allow IF NOT EXISTS on constraint creation, so drop first
ALTER TABLE IF EXISTS orders DROP CONSTRAINT IF EXISTS fk_orders_customer;
ALTER TABLE IF EXISTS orders DROP CONSTRAINT IF EXISTS fk_orders_creator;
ALTER TABLE IF EXISTS orders
  ADD CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  ADD CONSTRAINT fk_orders_creator FOREIGN KEY (created_by) REFERENCES users(id);
-- index on customer_id already exists below but ensure anyway
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);

-- ========== INDEXES FOR SEARCH AND SORTING ==========

-- Index on order_number for fast searches and sorting
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number DESC NULLS LAST);

-- Index on created_at for deterministic pagination (ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC NULLS LAST);

-- Index on customer_id for filtering by customer
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Index on created_by for filtering by creator
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);

-- Composite index for paginated filtering: (status, created_at DESC) for status-filtered browsing
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC NULLS LAST);

-- Composite index for date range filtering: (order_date, created_at DESC)
CREATE INDEX IF NOT EXISTS idx_orders_order_date_created_at ON orders(order_date, created_at DESC NULLS LAST);

-- Index on customer names for ILIKE searches
CREATE INDEX IF NOT EXISTS idx_customers_name_lower ON customers(LOWER(name) text_pattern_ops);

-- Index on customer phone for ILIKE searches
CREATE INDEX IF NOT EXISTS idx_customers_phone_lower ON customers(LOWER(phone) text_pattern_ops);

-- ========== COMPOSITE INDEXES FOR COMMON FILTER COMBINATIONS ==========

-- For filtering by status and customer
CREATE INDEX IF NOT EXISTS idx_orders_status_customer ON orders(status, customer_id, created_at DESC NULLS LAST);

-- For filtering by creator and created_at (common for employee-filtered views)
CREATE INDEX IF NOT EXISTS idx_orders_created_by_created_at ON orders(created_by, created_at DESC NULLS LAST);

-- ========== RPC FUNCTIONS FOR ORDER NUMBERING AND CREATION ==========

-- Get the next order number WITHOUT allocating it (advisory only, for UI preview)
-- Returns formatted number like "ORD-251"
-- This function is safe to call multiple times; it does not acquire locks
-- Actual allocation happens in create_order_atomic when order is inserted
CREATE OR REPLACE FUNCTION public.get_next_order_number()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefix text;
  v_next bigint;
BEGIN
  -- Read prefix from order_settings (assumes single row)
  SELECT prefix INTO v_prefix FROM order_settings LIMIT 1;

  -- Compute what the next number would be (advisory, without locking)
  SELECT COALESCE(MAX(order_seq), 0) + 1
    INTO v_next
    FROM orders
    WHERE order_seq IS NOT NULL AND (v_prefix IS NULL OR order_number LIKE v_prefix || '%');

  -- Return formatted order number
  RETURN COALESCE(v_prefix, '') || v_next::text;
END;
$$;

-- Drop the old function (it returns just the orders row without joined data)
DROP FUNCTION IF EXISTS create_order_atomic(date, uuid, uuid, text, jsonb, numeric, numeric, numeric, numeric, numeric, text, jsonb);

-- Create new RPC function that returns joined data (customer name/phone, creator username)
-- This is returned as a single composite containing the order + denormalized customer/creator info
-- for efficient caching and display without additional queries
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

  -- Compose the order number
  v_order_number := COALESCE(v_prefix, '') || v_next::text;

  -- Insert order and capture the ID
  INSERT INTO orders(
    order_number, order_seq, order_date, customer_id, created_by, status, items, 
    subtotal, discount, shipping, total, paid_amount, notes, history
  ) VALUES (
    v_order_number, v_next, p_order_date, p_customer_id, p_created_by, p_status, p_items, 
    p_subtotal, p_discount, p_shipping, p_total, p_paid_amount, p_notes, p_history
  ) RETURNING id INTO v_order_id;

  -- Return joined data as JSON (order + customer name/phone + creator username)
  -- This allows the frontend to cache the complete row without additional queries
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
    'created_at', o.created_at::text
  ) INTO v_result
  FROM orders o
  LEFT JOIN customers c ON o.customer_id = c.id
  LEFT JOIN users u ON o.created_by = u.id
  WHERE o.id = v_order_id;

  RETURN v_result;
END;
$$;

-- ========== CREATE VIEW FOR EFFICIENT PAGINATED QUERIES WITH JOINS ==========

-- Drop old view if exists
DROP VIEW IF EXISTS orders_with_customer_creator CASCADE;

-- Create a view that joins orders with customer and creator info
-- This is used for paginated fetches to avoid repeated manual joins in the frontend
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
  o.created_at
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN users u ON o.created_by = u.id;

COMMIT;

-- Notes:
-- 1. Indexes are designed for:
--    - Fast ORDER BY created_at DESC pagination
--    - Fast ILIKE searches on order_number, customer name/phone
--    - Fast filtering by status, customer_id, created_by
--    - Composite indexes for common filter combinations
--
-- 2. create_order_atomic now returns JSONB with all joined data
--    This ensures atomicity: the order and its metadata are created and returned in one transaction
--
-- 3. orders_with_customer_creator view provides a convenient way to query joined data
--    but frontend can also query directly from orders and join as needed
--
-- 4. Frontend caching strategy:
--    - Browsing mode (no search): Fetch paginated data using ORDER BY created_at DESC LIMIT N OFFSET X
--      Cache under keys ['orders', page]
--    - Search mode (search term exists): Query Supabase directly with server-side ILIKE filtering
--      Cache under keys ['orders-search', term, page]
--    - After creation: Inject new row into cached first page if not searching,
--      or verify it matches search filter if searching
