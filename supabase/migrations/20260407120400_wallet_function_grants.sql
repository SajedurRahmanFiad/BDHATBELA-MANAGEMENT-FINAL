GRANT EXECUTE ON FUNCTION public.create_order_atomic(date, uuid, uuid, text, jsonb, numeric, numeric, numeric, numeric, numeric, text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_order_atomic(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_employee_wallet(uuid, numeric, uuid, text, text, date, uuid, text) TO anon, authenticated, service_role;
