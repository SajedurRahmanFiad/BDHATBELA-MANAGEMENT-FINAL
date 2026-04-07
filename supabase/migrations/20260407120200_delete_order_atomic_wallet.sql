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
