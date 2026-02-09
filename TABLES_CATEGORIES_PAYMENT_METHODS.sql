-- ========== SUPABASE - CATEGORIES & PAYMENT METHODS TABLES ==========
-- Run this SQL in your Supabase SQL Editor to create the missing tables
-- Fixed for PostgreSQL syntax (not MySQL)

-- Create trigger function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('Income', 'Expense', 'Product', 'Other')),
  color VARCHAR(7) DEFAULT '#3B82F6',
  parent_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL
);

-- Create indexes for categories
CREATE INDEX IF NOT EXISTS idx_categories_type ON public.categories(type);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);

-- Create trigger to auto-update categories timestamp
DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create payment_methods table
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for payment_methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_active ON public.payment_methods(is_active);

-- Create trigger to auto-update payment_methods timestamp
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON public.payment_methods;
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create units table (for product measurements)
CREATE TABLE IF NOT EXISTS public.units (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  short_name VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger to auto-update units timestamp
DROP TRIGGER IF EXISTS update_units_updated_at ON public.units;
CREATE TRIGGER update_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all new tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for categories (all authenticated users can CRUD)
CREATE POLICY categories_all ON public.categories FOR ALL 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Create RLS policies for payment_methods (all authenticated users can CRUD)
CREATE POLICY payment_methods_all ON public.payment_methods FOR ALL 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Create RLS policies for units (all authenticated users can CRUD)
CREATE POLICY units_all ON public.units FOR ALL 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Insert default payment methods
INSERT INTO public.payment_methods (id, name, description) VALUES
  ('cash', 'Cash', 'Cash payment'),
  ('card', 'Card', 'Credit or debit card'),
  ('bank_transfer', 'Bank Transfer', 'Bank transfer or wire'),
  ('cheque', 'Cheque', 'Cheque payment'),
  ('digital_wallet', 'Digital Wallet', 'Digital wallet (Nagad, Bkash, etc.)')
ON CONFLICT DO NOTHING;

-- Insert default units
INSERT INTO public.units (id, short_name, name) VALUES
  ('piece', 'pc', 'Piece'),
  ('kilogram', 'kg', 'Kilogram'),
  ('gram', 'g', 'Gram'),
  ('liter', 'L', 'Liter'),
  ('milliliter', 'ml', 'Milliliter'),
  ('meter', 'm', 'Meter'),
  ('centimeter', 'cm', 'Centimeter'),
  ('box', 'box', 'Box'),
  ('pack', 'pack', 'Pack'),
  ('dozen', 'dz', 'Dozen')
ON CONFLICT DO NOTHING;

-- Insert default categories (Income types)
INSERT INTO public.categories (id, name, type, color) VALUES
  ('income_sales', 'Sales', 'Income', '#10B981'),
  ('income_services', 'Services', 'Income', '#3B82F6'),
  ('income_other', 'Other Income', 'Income', '#8B5CF6')
ON CONFLICT DO NOTHING;

-- Insert default categories (Expense types)
INSERT INTO public.categories (id, name, type, color) VALUES
  ('expense_purchases', 'Purchases', 'Expense', '#EF4444'),
  ('expense_utilities', 'Utilities', 'Expense', '#F59E0B'),
  ('expense_salaries', 'Salaries', 'Expense', '#EC4899'),
  ('expense_rent', 'Rent', 'Expense', '#6366F1'),
  ('expense_shipping', 'Shipping Costs', 'Expense', '#F97316'),
  ('expense_other', 'Other Expense', 'Expense', '#6B7280')
ON CONFLICT DO NOTHING;

-- Insert default categories (Product types)
INSERT INTO public.categories (id, name, type, color) VALUES
  ('product_electronics', 'Electronics', 'Product', '#3B82F6'),
  ('product_clothing', 'Clothing', 'Product', '#EC4899'),
  ('product_food', 'Food & Beverage', 'Product', '#10B981'),
  ('product_other', 'Other Products', 'Product', '#8B5CF6')
ON CONFLICT DO NOTHING;

-- Verify tables were created
SELECT 'Categories' as table_name, COUNT(*) as count FROM public.categories
UNION ALL
SELECT 'Payment Methods', COUNT(*) FROM public.payment_methods
UNION ALL
SELECT 'Units', COUNT(*) FROM public.units;
