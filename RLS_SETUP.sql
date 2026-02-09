-- ========== SUPABASE RLS SETUP - DEVELOPMENT MODE ==========
-- Copy and paste this ENTIRE block into Supabase SQL Editor and run it
-- This enables Row Level Security and creates policies for development
-- 
-- Steps:
-- 1. Go to: https://app.supabase.com → Your Project → SQL Editor
-- 2. Click: New Query
-- 3. Paste this entire file
-- 4. Click: Run (or Ctrl+Enter)
-- 5. Wait for completion - no errors should appear
-- 6. Go back to your app and refresh - customers should appear!

-- Drop existing policies if they exist (to allow re-run of this script)
DROP POLICY IF EXISTS customers_all ON public.customers;
DROP POLICY IF EXISTS orders_all ON public.orders;
DROP POLICY IF EXISTS accounts_all ON public.accounts;
DROP POLICY IF EXISTS transactions_all ON public.transactions;
DROP POLICY IF EXISTS bills_all ON public.bills;
DROP POLICY IF EXISTS users_all ON public.users;
DROP POLICY IF EXISTS vendors_all ON public.vendors;
DROP POLICY IF EXISTS products_all ON public.products;
DROP POLICY IF EXISTS settings_public_read ON public.settings;
DROP POLICY IF EXISTS settings_auth_insert ON public.settings;
DROP POLICY IF EXISTS settings_auth_update ON public.settings;
DROP POLICY IF EXISTS settings_auth_delete ON public.settings;

-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for development (all authenticated users can do anything)

-- Customers: Allow all authenticated users full access
CREATE POLICY customers_all ON public.customers FOR ALL 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Orders: Allow all authenticated users full access
CREATE POLICY orders_all ON public.orders FOR ALL 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Accounts: Allow all authenticated users full access
CREATE POLICY accounts_all ON public.accounts FOR ALL 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Transactions: Allow all authenticated users full access
CREATE POLICY transactions_all ON public.transactions FOR ALL 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Bills: Allow all authenticated users full access
CREATE POLICY bills_all ON public.bills FOR ALL 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Users: Allow all authenticated users full access
CREATE POLICY users_all ON public.users FOR ALL 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Vendors: Allow all authenticated users full access
CREATE POLICY vendors_all ON public.vendors FOR ALL 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Products: Allow all authenticated users full access
CREATE POLICY products_all ON public.products FOR ALL 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Settings: Allow public read, authenticated users write
CREATE POLICY settings_public_read ON public.settings FOR SELECT 
  USING (true);

CREATE POLICY settings_auth_insert ON public.settings FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY settings_auth_update ON public.settings FOR UPDATE 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY settings_auth_delete ON public.settings FOR DELETE 
  USING (auth.role() = 'authenticated');
