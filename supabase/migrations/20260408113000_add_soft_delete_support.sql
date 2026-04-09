BEGIN;

ALTER TABLE IF EXISTS public.customers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE IF EXISTS public.bills
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE IF EXISTS public.transactions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE IF EXISTS public.vendors
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON public.customers(deleted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON public.orders(deleted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_bills_deleted_at ON public.bills(deleted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at ON public.transactions(deleted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users(deleted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_vendors_deleted_at ON public.vendors(deleted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON public.products(deleted_at DESC NULLS LAST);

CREATE OR REPLACE VIEW public.orders_with_customer_creator AS
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
  o.carrybee_consignment_id,
  o.steadfast_consignment_id,
  o.paperfly_tracking_number
FROM public.orders o
LEFT JOIN public.customers c ON o.customer_id = c.id
LEFT JOIN public.users u ON o.created_by = u.id
WHERE o.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.bills_with_vendor_creator AS
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
FROM public.bills b
LEFT JOIN public.vendors v ON b.vendor_id = v.id
LEFT JOIN public.users u ON b.created_by = u.id
WHERE b.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.transactions_with_relations AS
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
  CASE
    WHEN c.id IS NOT NULL THEN 'Customer'
    WHEN v.id IS NOT NULL THEN 'Vendor'
    ELSE NULL
  END AS contact_type,
  t.payment_method,
  t.attachment_name,
  t.attachment_url,
  t.created_by,
  u.name AS creator_name,
  t.created_at
FROM public.transactions t
LEFT JOIN public.accounts a ON t.account_id = a.id
LEFT JOIN public.customers c ON t.contact_id = c.id
LEFT JOIN public.vendors v ON t.contact_id = v.id
LEFT JOIN public.users u ON t.created_by::uuid = u.id
WHERE t.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.employee_wallet_balances AS
SELECT
  u.id AS employee_id,
  u.name AS employee_name,
  u.role AS employee_role,
  COALESCE(SUM(we.amount_delta), 0)::NUMERIC(12,2) AS current_balance,
  COALESCE(SUM(CASE WHEN we.entry_type = 'order_credit' THEN we.amount_delta ELSE 0 END), 0)::NUMERIC(12,2) AS total_earned,
  ABS(COALESCE(SUM(CASE WHEN we.entry_type = 'payout' THEN we.amount_delta ELSE 0 END), 0))::NUMERIC(12,2) AS total_paid,
  COALESCE(COUNT(*) FILTER (WHERE we.entry_type = 'order_credit'), 0)::INTEGER AS credited_orders,
  MAX(we.created_at) AS last_activity_at
FROM public.users u
LEFT JOIN public.wallet_entries we
  ON we.employee_id = u.id
WHERE u.role IN ('Employee', 'Employee1')
  AND u.deleted_at IS NULL
GROUP BY u.id, u.name, u.role;

COMMIT;
