-- SETTINGS DATABASE TABLES MIGRATION
-- Run this SQL in your Supabase database to enable settings persistence

-- 1. COMPANY SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT 'Your Company',
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  logo TEXT, -- Base64 encoded image or URL
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ORDER SETTINGS TABLE (for order numbering)
CREATE TABLE IF NOT EXISTS public.order_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prefix VARCHAR(20) NOT NULL DEFAULT 'ORD-',
  next_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INVOICE SETTINGS TABLE (for invoice display/printing)
CREATE TABLE IF NOT EXISTS public.invoice_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL DEFAULT 'Invoice',
  logo_width INTEGER DEFAULT 120,
  logo_height INTEGER DEFAULT 120,
  footer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SYSTEM DEFAULTS TABLE (for default account, payment method, categories, etc.)
CREATE TABLE IF NOT EXISTS public.system_defaults (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  default_account_id UUID,
  default_payment_method VARCHAR(255),
  income_category_id VARCHAR(255),
  expense_category_id VARCHAR(255),
  records_per_page INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (default_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (income_category_id) REFERENCES public.categories(id) ON DELETE SET NULL,
  FOREIGN KEY (expense_category_id) REFERENCES public.categories(id) ON DELETE SET NULL
);

-- 5. COURIER SETTINGS TABLE (for Steadfast and CarryBee integration)
CREATE TABLE IF NOT EXISTS public.courier_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Steadfast configuration
  steadfast_enabled BOOLEAN DEFAULT FALSE,
  steadfast_base_url VARCHAR(255),
  steadfast_api_key VARCHAR(500),
  steadfast_secret_key VARCHAR(500),
  
  -- CarryBee configuration
  carryBee_enabled BOOLEAN DEFAULT FALSE,
  carryBee_base_url VARCHAR(255),
  carryBee_client_id VARCHAR(255),
  carryBee_client_secret VARCHAR(500),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BILL SETTINGS (if history column doesn't exist yet)
ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '{}';

-- ORDER SETTINGS (if history column doesn't exist yet)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '{}';

-- ============== ROW LEVEL SECURITY (RLS) POLICIES ==============
-- These policies allow all authenticated users to view and update settings
-- Adjust based on your security requirements

-- Enable RLS for all settings tables
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_settings ENABLE ROW LEVEL SECURITY;

-- COMPANY SETTINGS policies
CREATE POLICY "Allow read company settings" ON public.company_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow update company settings" ON public.company_settings
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow insert company settings" ON public.company_settings
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ORDER SETTINGS policies
CREATE POLICY "Allow read order settings" ON public.order_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow update order settings" ON public.order_settings
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow insert order settings" ON public.order_settings
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- INVOICE SETTINGS policies
CREATE POLICY "Allow read invoice settings" ON public.invoice_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow update invoice settings" ON public.invoice_settings
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow insert invoice settings" ON public.invoice_settings
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- SYSTEM DEFAULTS policies
CREATE POLICY "Allow read system defaults" ON public.system_defaults
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow update system defaults" ON public.system_defaults
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow insert system defaults" ON public.system_defaults
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- COURIER SETTINGS policies
CREATE POLICY "Allow read courier settings" ON public.courier_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow update courier settings" ON public.courier_settings
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow insert courier settings" ON public.courier_settings
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============== INSERT DEFAULT/INITIAL DATA ==============
-- Insert one row for each settings table (these act as singleton configs)

INSERT INTO public.company_settings (name, phone, email, address, logo)
VALUES ('BDHATBELA MANAGEMENT', '+880', 'info@bdhatbela.com', '', '')
ON CONFLICT DO NOTHING;

INSERT INTO public.order_settings (prefix, next_number)
VALUES ('ORD-', 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.invoice_settings (title, logo_width, logo_height, footer)
VALUES ('INVOICE', 120, 120, 'Thank you for your business!')
ON CONFLICT DO NOTHING;

INSERT INTO public.system_defaults (records_per_page)
VALUES (10)
ON CONFLICT DO NOTHING;

INSERT INTO public.courier_settings (steadfast_enabled, carryBee_enabled)
VALUES (false, false)
ON CONFLICT DO NOTHING;
