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
