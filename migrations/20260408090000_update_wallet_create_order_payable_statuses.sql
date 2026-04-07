-- Update wallet credit creation to respect selected payable order statuses

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
