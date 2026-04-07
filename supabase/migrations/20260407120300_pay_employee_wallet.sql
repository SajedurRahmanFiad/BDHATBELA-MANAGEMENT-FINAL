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
