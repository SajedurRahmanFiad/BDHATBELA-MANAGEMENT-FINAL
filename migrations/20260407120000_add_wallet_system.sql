-- Wallet-based employee payments
-- Replaces period payroll usage with a rolling wallet ledger while preserving payroll_settings.unit_amount.

BEGIN;

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

CREATE OR REPLACE FUNCTION public.create_order_atomic(
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_next bigint;
  v_order_id uuid;
  v_order_number text;
  v_lock_key bigint;
  v_result jsonb;
  v_order_created_at timestamptz;
  v_creator_role text;
  v_unit_amount numeric(12,2);
BEGIN
  SELECT prefix INTO v_prefix FROM public.order_settings LIMIT 1;
  v_lock_key := hashtext(COALESCE(v_prefix, ''))::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(MAX(order_seq), 0) + 1
    INTO v_next
    FROM public.orders
    WHERE order_seq IS NOT NULL
      AND (v_prefix IS NULL OR order_number LIKE v_prefix || '%');

  v_order_number := COALESCE(v_prefix, '') || v_next::text;

  INSERT INTO public.orders(
    order_number,
    order_seq,
    order_date,
    customer_id,
    created_by,
    status,
    items,
    subtotal,
    discount,
    shipping,
    total,
    paid_amount,
    notes,
    history
  ) VALUES (
    v_order_number,
    v_next,
    p_order_date,
    p_customer_id,
    p_created_by,
    p_status,
    p_items,
    p_subtotal,
    p_discount,
    p_shipping,
    p_total,
    p_paid_amount,
    p_notes,
    p_history
  )
  RETURNING id, created_at INTO v_order_id, v_order_created_at;

  SELECT role INTO v_creator_role
  FROM public.users
  WHERE id = p_created_by;

  SELECT COALESCE(unit_amount, 0)::NUMERIC(12,2)
    INTO v_unit_amount
    FROM public.payroll_settings
    LIMIT 1;

  IF v_creator_role IN ('Employee', 'Employee1') AND COALESCE(v_unit_amount, 0) > 0 THEN
    INSERT INTO public.wallet_entries (
      employee_id,
      entry_type,
      amount_delta,
      unit_amount_snapshot,
      source_order_id,
      source_order_number,
      created_at,
      created_by
    ) VALUES (
      p_created_by,
      'order_credit',
      v_unit_amount,
      v_unit_amount,
      v_order_id,
      v_order_number,
      COALESCE(v_order_created_at, NOW()),
      p_created_by
    )
    ON CONFLICT DO NOTHING;
  END IF;

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
    'carrybee_consignment_id', o.carrybee_consignment_id,
    'steadfast_consignment_id', o.steadfast_consignment_id,
    'paperfly_tracking_number', o.paperfly_tracking_number
  ) INTO v_result
  FROM public.orders o
  LEFT JOIN public.customers c ON o.customer_id = c.id
  LEFT JOIN public.users u ON o.created_by = u.id
  WHERE o.id = v_order_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_order_atomic(
  p_order_id uuid,
  p_deleted_by uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_actor_role text;
  v_credit_amount numeric(12,2);
  v_credit_unit numeric(12,2);
  v_deleted_count integer := 0;
  txn_record record;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  SELECT role INTO v_actor_role
  FROM public.users
  WHERE id = p_deleted_by;

  IF v_actor_role IN ('Employee', 'Employee1') AND v_order.created_by <> p_deleted_by THEN
    RAISE EXCEPTION 'Employees can only delete their own orders.';
  END IF;

  FOR txn_record IN
    SELECT id, type, account_id, amount
    FROM public.transactions
    WHERE
      (reference_id = p_order_id)
      OR (
        type = 'Expense'
        AND category = 'expense_shipping'
        AND description = FORMAT('Shipping costs for Order #%s', v_order.order_number)
      )
  LOOP
    IF txn_record.account_id IS NOT NULL THEN
      IF txn_record.type = 'Income' THEN
        UPDATE public.accounts
        SET current_balance = COALESCE(current_balance, 0) - COALESCE(txn_record.amount, 0)
        WHERE id = txn_record.account_id;
      ELSIF txn_record.type = 'Expense' THEN
        UPDATE public.accounts
        SET current_balance = COALESCE(current_balance, 0) + COALESCE(txn_record.amount, 0)
        WHERE id = txn_record.account_id;
      END IF;
    END IF;
  END LOOP;

  DELETE FROM public.transactions
  WHERE
    (reference_id = p_order_id)
    OR (
      type = 'Expense'
      AND category = 'expense_shipping'
      AND description = FORMAT('Shipping costs for Order #%s', v_order.order_number)
    );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  SELECT amount_delta, unit_amount_snapshot
    INTO v_credit_amount, v_credit_unit
    FROM public.wallet_entries
    WHERE source_order_id = p_order_id
      AND entry_type = 'order_credit'
    ORDER BY created_at ASC
    LIMIT 1;

  IF v_credit_amount IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.wallet_entries
      WHERE source_order_id = p_order_id
        AND entry_type = 'order_reversal'
    )
  THEN
    INSERT INTO public.wallet_entries (
      employee_id,
      entry_type,
      amount_delta,
      unit_amount_snapshot,
      source_order_id,
      source_order_number,
      note,
      created_at,
      created_by
    ) VALUES (
      v_order.created_by,
      'order_reversal',
      -ABS(v_credit_amount),
      v_credit_unit,
      p_order_id,
      v_order.order_number,
      'Wallet credit reversed because the order was deleted.',
      NOW(),
      p_deleted_by
    );
  END IF;

  DELETE FROM public.orders
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'deleted_order_id', p_order_id,
    'deleted_order_number', v_order.order_number,
    'deleted_transactions', v_deleted_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_employee_wallet(
  p_employee_id uuid,
  p_amount numeric,
  p_account_id uuid,
  p_payment_method text,
  p_category_id text,
  p_paid_at date,
  p_paid_by uuid,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee public.users%ROWTYPE;
  v_actor_role text;
  v_account_balance numeric(12,2);
  v_wallet_balance numeric(12,2);
  v_paid_at timestamptz;
  v_payout_id uuid := gen_random_uuid();
  v_transaction_id uuid := gen_random_uuid();
  v_description text;
BEGIN
  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Payout amount must be greater than zero.';
  END IF;

  SELECT * INTO v_employee
  FROM public.users
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found.';
  END IF;

  IF v_employee.role NOT IN ('Employee', 'Employee1') THEN
    RAISE EXCEPTION 'Wallet payouts can only be created for employee accounts.';
  END IF;

  SELECT role INTO v_actor_role
  FROM public.users
  WHERE id = p_paid_by;

  IF v_actor_role <> 'Admin' THEN
    RAISE EXCEPTION 'Only admins can pay employee wallets.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_employee_id::text)::bigint);

  SELECT COALESCE(SUM(amount_delta), 0)::NUMERIC(12,2)
    INTO v_wallet_balance
    FROM public.wallet_entries
    WHERE employee_id = p_employee_id;

  IF p_amount > COALESCE(v_wallet_balance, 0) THEN
    RAISE EXCEPTION 'Payout amount exceeds the current wallet balance.';
  END IF;

  SELECT COALESCE(current_balance, 0)::NUMERIC(12,2)
    INTO v_account_balance
    FROM public.accounts
    WHERE id = p_account_id
    FOR UPDATE;

  IF v_account_balance IS NULL THEN
    RAISE EXCEPTION 'Selected payment account was not found.';
  END IF;

  IF p_amount > v_account_balance THEN
    RAISE EXCEPTION 'Selected account does not have enough balance.';
  END IF;

  v_paid_at := COALESCE((p_paid_at::timestamp)::timestamptz, NOW());
  v_description := FORMAT('Wallet payout to %s', v_employee.name);

  INSERT INTO public.transactions (
    id,
    date,
    type,
    category,
    account_id,
    amount,
    description,
    reference_id,
    payment_method,
    created_by
  ) VALUES (
    v_transaction_id,
    COALESCE(p_paid_at, CURRENT_DATE),
    'Expense',
    p_category_id,
    p_account_id,
    p_amount,
    v_description,
    v_payout_id,
    p_payment_method,
    p_paid_by
  );

  UPDATE public.accounts
  SET current_balance = COALESCE(current_balance, 0) - p_amount
  WHERE id = p_account_id;

  INSERT INTO public.wallet_payouts (
    id,
    employee_id,
    amount,
    account_id,
    payment_method,
    category_id,
    transaction_id,
    paid_at,
    paid_by,
    note
  ) VALUES (
    v_payout_id,
    p_employee_id,
    p_amount,
    p_account_id,
    p_payment_method,
    p_category_id,
    v_transaction_id,
    v_paid_at,
    p_paid_by,
    NULLIF(BTRIM(COALESCE(p_note, '')), '')
  );

  INSERT INTO public.wallet_entries (
    employee_id,
    entry_type,
    amount_delta,
    wallet_payout_id,
    note,
    created_at,
    created_by
  ) VALUES (
    p_employee_id,
    'payout',
    -ABS(p_amount),
    v_payout_id,
    COALESCE(NULLIF(BTRIM(COALESCE(p_note, '')), ''), v_description),
    v_paid_at,
    p_paid_by
  );

  RETURN jsonb_build_object(
    'id', v_payout_id,
    'employee_id', p_employee_id,
    'amount', p_amount,
    'account_id', p_account_id,
    'payment_method', p_payment_method,
    'category_id', p_category_id,
    'transaction_id', v_transaction_id,
    'paid_at', v_paid_at,
    'paid_by', p_paid_by,
    'note', NULLIF(BTRIM(COALESCE(p_note, '')), '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(date, uuid, uuid, text, jsonb, numeric, numeric, numeric, numeric, numeric, text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_order_atomic(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_employee_wallet(uuid, numeric, uuid, text, text, date, uuid, text) TO anon, authenticated, service_role;

WITH current_wallet_rate AS (
  SELECT COALESCE(unit_amount, 0)::NUMERIC(12,2) AS unit_amount
  FROM public.payroll_settings
  LIMIT 1
)
INSERT INTO public.wallet_entries (
  employee_id,
  entry_type,
  amount_delta,
  unit_amount_snapshot,
  source_order_id,
  source_order_number,
  note,
  created_at,
  created_by
)
SELECT
  o.created_by,
  'order_credit',
  cwr.unit_amount,
  cwr.unit_amount,
  o.id,
  o.order_number,
  'Wallet credit backfilled from existing order history.',
  COALESCE(o.created_at, NOW()),
  o.created_by
FROM public.orders o
CROSS JOIN current_wallet_rate cwr
INNER JOIN public.users u
  ON u.id = o.created_by
LEFT JOIN public.wallet_entries existing_credit
  ON existing_credit.source_order_id = o.id
  AND existing_credit.entry_type = 'order_credit'
WHERE u.role IN ('Employee', 'Employee1')
  AND existing_credit.id IS NULL
  AND cwr.unit_amount > 0;

COMMIT;
