-- Payroll settings and payment history
-- Adds a singleton payroll configuration row plus frozen payroll payment snapshots.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.payroll_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE,
  unit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  counted_statuses TEXT[] NOT NULL DEFAULT ARRAY['On Hold', 'Processing', 'Picked', 'Completed', 'Cancelled']::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_kind TEXT NOT NULL CHECK (period_kind IN ('month', 'custom')),
  period_label TEXT NOT NULL,
  unit_amount_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0,
  counted_statuses_snapshot TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  order_count_snapshot INTEGER NOT NULL DEFAULT 0,
  amount_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_payments_valid_period CHECK (period_end >= period_start)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'no_overlapping_payroll_periods'
  ) THEN
    ALTER TABLE public.payroll_payments
      ADD CONSTRAINT no_overlapping_payroll_periods
      EXCLUDE USING gist (
        employee_id WITH =,
        daterange(period_start, period_end, '[]') WITH &&
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payroll_payments_employee_id
  ON public.payroll_payments(employee_id);

CREATE INDEX IF NOT EXISTS idx_payroll_payments_paid_at_desc
  ON public.payroll_payments(paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_payments_period_bounds
  ON public.payroll_payments(period_start, period_end);

ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_settings_read ON public.payroll_settings;
DROP POLICY IF EXISTS payroll_settings_insert ON public.payroll_settings;
DROP POLICY IF EXISTS payroll_settings_update ON public.payroll_settings;
DROP POLICY IF EXISTS payroll_payments_read ON public.payroll_payments;
DROP POLICY IF EXISTS payroll_payments_insert ON public.payroll_payments;

CREATE POLICY payroll_settings_read
  ON public.payroll_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY payroll_settings_insert
  ON public.payroll_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY payroll_settings_update
  ON public.payroll_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY payroll_payments_read
  ON public.payroll_payments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY payroll_payments_insert
  ON public.payroll_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

INSERT INTO public.payroll_settings (singleton, unit_amount, counted_statuses)
VALUES (
  TRUE,
  0,
  ARRAY['On Hold', 'Processing', 'Picked', 'Completed', 'Cancelled']::TEXT[]
)
ON CONFLICT (singleton) DO NOTHING;
