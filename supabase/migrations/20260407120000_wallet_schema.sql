CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS public.payroll_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payroll_payments DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.wallet_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  payment_method TEXT NOT NULL,
  category_id TEXT NOT NULL,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wallet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('order_credit', 'order_reversal', 'payout')),
  amount_delta NUMERIC(12,2) NOT NULL,
  unit_amount_snapshot NUMERIC(12,2),
  source_order_id UUID,
  source_order_number TEXT,
  wallet_payout_id UUID REFERENCES public.wallet_payouts(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT wallet_entries_sign_check CHECK (
    (entry_type = 'order_credit' AND amount_delta > 0)
    OR (entry_type = 'order_reversal' AND amount_delta < 0)
    OR (entry_type = 'payout' AND amount_delta < 0)
  )
);

ALTER TABLE IF EXISTS public.wallet_payouts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_entries DISABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_entries_single_credit_per_order
  ON public.wallet_entries(source_order_id)
  WHERE entry_type = 'order_credit' AND source_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_entries_single_payout_entry
  ON public.wallet_entries(wallet_payout_id)
  WHERE entry_type = 'payout' AND wallet_payout_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_payouts_transaction_id
  ON public.wallet_payouts(transaction_id);

CREATE INDEX IF NOT EXISTS idx_wallet_entries_employee_created_at
  ON public.wallet_entries(employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_entries_created_at
  ON public.wallet_entries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_entries_entry_type
  ON public.wallet_entries(entry_type);

CREATE INDEX IF NOT EXISTS idx_wallet_payouts_employee_paid_at
  ON public.wallet_payouts(employee_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_payouts_paid_at
  ON public.wallet_payouts(paid_at DESC);

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
GROUP BY u.id, u.name, u.role;

CREATE OR REPLACE VIEW public.wallet_activity_with_relations AS
SELECT
  we.id,
  we.employee_id,
  employee_user.name AS employee_name,
  employee_user.role AS employee_role,
  we.entry_type,
  we.amount_delta,
  we.unit_amount_snapshot,
  we.source_order_id AS order_id,
  COALESCE(we.source_order_number, o.order_number) AS order_number,
  we.wallet_payout_id AS payout_id,
  wp.transaction_id,
  wp.account_id,
  a.name AS account_name,
  wp.payment_method,
  wp.category_id,
  c.name AS category_name,
  we.note,
  we.created_at,
  we.created_by,
  creator_user.name AS created_by_name,
  wp.paid_at,
  wp.paid_by,
  paid_by_user.name AS paid_by_name
FROM public.wallet_entries we
LEFT JOIN public.users employee_user
  ON employee_user.id = we.employee_id
LEFT JOIN public.orders o
  ON o.id = we.source_order_id
LEFT JOIN public.wallet_payouts wp
  ON wp.id = we.wallet_payout_id
LEFT JOIN public.accounts a
  ON a.id = wp.account_id
LEFT JOIN public.categories c
  ON c.id = wp.category_id
LEFT JOIN public.users creator_user
  ON creator_user.id = we.created_by
LEFT JOIN public.users paid_by_user
  ON paid_by_user.id = wp.paid_by;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wallet_entries TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wallet_payouts TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payroll_settings TO anon, authenticated, service_role;
GRANT SELECT ON public.employee_wallet_balances TO anon, authenticated, service_role;
GRANT SELECT ON public.wallet_activity_with_relations TO anon, authenticated, service_role;
