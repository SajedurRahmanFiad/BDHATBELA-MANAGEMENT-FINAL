-- Migration: Add bills atomic RPC and joined views for bills & transactions

BEGIN;

-- Ensure bill_seq exists
ALTER TABLE IF EXISTS bills ADD COLUMN IF NOT EXISTS bill_seq bigint;
CREATE INDEX IF NOT EXISTS idx_bills_bill_seq ON bills(bill_seq);

-- Ensure foreign keys
ALTER TABLE IF EXISTS bills DROP CONSTRAINT IF EXISTS fk_bills_vendor;
ALTER TABLE IF EXISTS bills
  ADD CONSTRAINT fk_bills_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id);

CREATE INDEX IF NOT EXISTS idx_bills_vendor_id ON bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bills_created_by ON bills(created_by);

-- Indexes for search/sort
CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills(bill_number DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_bills_bill_date_created_at ON bills(bill_date, created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_bills_status_created_at ON bills(status, created_at DESC NULLS LAST);

-- Advisory preview for next bill number
CREATE OR REPLACE FUNCTION public.get_next_bill_number()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefix text;
  v_next bigint;
  v_has_prefix boolean := false;
BEGIN
  -- Check whether invoice_settings table contains a prefix column; if not default to 'Bill-'
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_settings' AND column_name = 'prefix'
  ) INTO v_has_prefix;

  IF v_has_prefix THEN
    SELECT prefix INTO v_prefix FROM invoice_settings LIMIT 1;
  ELSE
    v_prefix := 'Bill-';
  END IF;

  SELECT COALESCE(MAX(bill_seq), 0) + 1
    INTO v_next
    FROM bills
    WHERE bill_seq IS NOT NULL AND (v_prefix IS NULL OR bill_number LIKE v_prefix || '%');
  RETURN COALESCE(v_prefix, '') || v_next::text;
END;
$$;

-- Drop old create_bill_atomic if exists
DROP FUNCTION IF EXISTS create_bill_atomic(date, uuid, uuid, text, jsonb, numeric, numeric, numeric, numeric, numeric, text, jsonb);

-- Create atomic create_bill RPC that allocates bill_seq and inserts, returns joined bill + vendor + creator
CREATE OR REPLACE FUNCTION public.create_bill_atomic(
  p_bill_date date,
  p_vendor_id uuid,
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
  v_bill_id uuid;
  v_bill_number text;
  v_lock_key bigint;
  v_result jsonb;
  v_has_prefix boolean := false;
BEGIN
  -- Safely obtain prefix, defaulting to 'Bill-' if the column is missing or null
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_settings' AND column_name = 'prefix'
  ) INTO v_has_prefix;

  IF v_has_prefix THEN
    SELECT prefix INTO v_prefix FROM invoice_settings LIMIT 1;
  ELSE
    v_prefix := 'Bill-';
  END IF;

  v_lock_key := hashtext(COALESCE(v_prefix, ''))::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);
  SELECT COALESCE(MAX(bill_seq), 0) + 1
    INTO v_next
    FROM bills
    WHERE bill_seq IS NOT NULL AND (v_prefix IS NULL OR bill_number LIKE v_prefix || '%');
  v_bill_number := COALESCE(v_prefix, '') || v_next::text;

  INSERT INTO bills(
    bill_number, bill_seq, bill_date, vendor_id, created_by, status, items,
    subtotal, discount, shipping, total, paid_amount, notes, history
  ) VALUES (
    v_bill_number, v_next, p_bill_date, p_vendor_id, p_created_by, p_status, p_items,
    p_subtotal, p_discount, p_shipping, p_total, p_paid_amount, p_notes, p_history
  ) RETURNING id INTO v_bill_id;

  SELECT jsonb_build_object(
    'id', b.id,
    'bill_number', b.bill_number,
    'bill_date', b.bill_date::text,
    'vendor_id', b.vendor_id,
    'vendor_name', v.name,
    'vendor_phone', v.phone,
    'vendor_address', v.address,
    'created_by', b.created_by,
    'creator_name', u.name,
    'status', b.status,
    'items', b.items,
    'subtotal', b.subtotal,
    'discount', b.discount,
    'shipping', b.shipping,
    'total', b.total,
    'paid_amount', b.paid_amount,
    'notes', b.notes,
    'history', b.history,
    'created_at', b.created_at::text
  ) INTO v_result
  FROM bills b
  LEFT JOIN vendors v ON b.vendor_id = v.id
  LEFT JOIN users u ON b.created_by = u.id
  WHERE b.id = v_bill_id;

  RETURN v_result;
END;
$$;

-- Create view for bills with vendor and creator
DROP VIEW IF EXISTS bills_with_vendor_creator CASCADE;
CREATE VIEW bills_with_vendor_creator AS
SELECT
  b.id,
  b.bill_number,
  b.bill_date,
  b.vendor_id,
  v.name AS vendor_name,
  v.phone AS vendor_phone,
  v.address AS vendor_address,
  b.created_by,
  u.name AS creator_name,
  b.status,
  b.items,
  b.subtotal,
  b.discount,
  b.shipping,
  b.total,
  b.paid_amount,
  b.notes,
  b.history,
  b.created_at
FROM bills b
LEFT JOIN vendors v ON b.vendor_id = v.id
LEFT JOIN users u ON b.created_by = u.id;

-- Transactions view: join accounts, customers/vendors, and creator
DROP VIEW IF EXISTS transactions_with_relations CASCADE;
CREATE VIEW transactions_with_relations AS
SELECT
  t.id,
  t.date,
  t.type,
  t.category,
  t.account_id,
  a.name AS account_name,
  t.to_account_id,
  t.amount,
  t.description,
  t.reference_id,
  t.contact_id,
  COALESCE(c.name, v.name) AS contact_name,
  CASE WHEN c.id IS NOT NULL THEN 'Customer' WHEN v.id IS NOT NULL THEN 'Vendor' ELSE NULL END AS contact_type,
  t.payment_method,
  t.attachment_name,
  t.attachment_url,
  t.created_by,
  u.name AS creator_name,
  t.created_at
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
LEFT JOIN customers c ON t.contact_id = c.id
LEFT JOIN vendors v ON t.contact_id = v.id
-- created_by is stored as varchar in some earlier schema versions; cast to uuid for join
LEFT JOIN users u ON t.created_by::uuid = u.id;

COMMIT;
