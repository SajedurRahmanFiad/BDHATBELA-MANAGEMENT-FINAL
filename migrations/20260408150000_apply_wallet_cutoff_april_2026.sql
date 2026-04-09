BEGIN;

CREATE OR REPLACE VIEW public.employee_wallet_balances AS
SELECT
  u.id AS employee_id,
  u.name AS employee_name,
  u.role AS employee_role,
  COALESCE(SUM(
    CASE
      WHEN we.entry_type IN ('order_credit', 'order_reversal')
        AND o.created_at >= TIMESTAMPTZ '2026-04-01 00:00:00+06:00' THEN we.amount_delta
      WHEN we.entry_type NOT IN ('order_credit', 'order_reversal')
        AND we.created_at >= TIMESTAMPTZ '2026-04-01 00:00:00+06:00' THEN we.amount_delta
      ELSE 0
    END
  ), 0)::NUMERIC(12,2) AS current_balance,
  COALESCE(SUM(
    CASE
      WHEN we.entry_type = 'order_credit'
        AND o.created_at >= TIMESTAMPTZ '2026-04-01 00:00:00+06:00' THEN we.amount_delta
      ELSE 0
    END
  ), 0)::NUMERIC(12,2) AS total_earned,
  ABS(COALESCE(SUM(
    CASE
      WHEN we.entry_type = 'payout'
        AND we.created_at >= TIMESTAMPTZ '2026-04-01 00:00:00+06:00' THEN we.amount_delta
      ELSE 0
    END
  ), 0))::NUMERIC(12,2) AS total_paid,
  COALESCE(active_wallet_orders.credited_orders, 0)::INTEGER AS credited_orders,
  MAX(
    CASE
      WHEN we.entry_type IN ('order_credit', 'order_reversal')
        AND o.created_at >= TIMESTAMPTZ '2026-04-01 00:00:00+06:00' THEN we.created_at
      WHEN we.entry_type NOT IN ('order_credit', 'order_reversal')
        AND we.created_at >= TIMESTAMPTZ '2026-04-01 00:00:00+06:00' THEN we.created_at
      ELSE NULL
    END
  ) AS last_activity_at
FROM public.users u
LEFT JOIN public.wallet_entries we
  ON we.employee_id = u.id
LEFT JOIN public.orders o
  ON o.id = we.source_order_id
LEFT JOIN (
  SELECT
    active_order_credits.employee_id,
    COUNT(*)::INTEGER AS credited_orders
  FROM (
    SELECT
      we.employee_id,
      we.source_order_id
    FROM public.wallet_entries we
    INNER JOIN public.orders o
      ON o.id = we.source_order_id
    WHERE we.entry_type IN ('order_credit', 'order_reversal')
      AND o.created_at >= TIMESTAMPTZ '2026-04-01 00:00:00+06:00'
    GROUP BY we.employee_id, we.source_order_id
    HAVING COALESCE(SUM(we.amount_delta), 0) > 0
  ) active_order_credits
  GROUP BY active_order_credits.employee_id
) active_wallet_orders
  ON active_wallet_orders.employee_id = u.id
WHERE u.role IN ('Employee', 'Employee1')
  AND u.deleted_at IS NULL
GROUP BY u.id, u.name, u.role, active_wallet_orders.credited_orders;

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
  v_payable_statuses text[];
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

  SELECT
    COALESCE(unit_amount, 0)::NUMERIC(12,2),
    COALESCE(counted_statuses, ARRAY[]::text[])
  INTO v_unit_amount, v_payable_statuses
  FROM public.payroll_settings
  LIMIT 1;

  IF v_creator_role IN ('Employee', 'Employee1')
    AND COALESCE(v_unit_amount, 0) > 0
    AND p_status = ANY(COALESCE(v_payable_statuses, ARRAY[]::text[]))
    AND COALESCE(v_order_created_at, NOW()) >= TIMESTAMPTZ '2026-04-01 00:00:00+06:00'
  THEN
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

  SELECT COALESCE(SUM(
    CASE
      WHEN we.entry_type IN ('order_credit', 'order_reversal')
        AND o.created_at >= TIMESTAMPTZ '2026-04-01 00:00:00+06:00' THEN we.amount_delta
      WHEN we.entry_type NOT IN ('order_credit', 'order_reversal')
        AND we.created_at >= TIMESTAMPTZ '2026-04-01 00:00:00+06:00' THEN we.amount_delta
      ELSE 0
    END
  ), 0)::NUMERIC(12,2)
    INTO v_wallet_balance
    FROM public.wallet_entries we
    LEFT JOIN public.orders o
      ON o.id = we.source_order_id
    WHERE we.employee_id = p_employee_id;

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

GRANT SELECT ON public.employee_wallet_balances TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(date, uuid, uuid, text, jsonb, numeric, numeric, numeric, numeric, numeric, text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_employee_wallet(uuid, numeric, uuid, text, text, date, uuid, text) TO anon, authenticated, service_role;

COMMIT;
