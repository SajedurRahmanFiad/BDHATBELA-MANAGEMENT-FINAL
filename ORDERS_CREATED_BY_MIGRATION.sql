-- ========== SUPABASE - ORDERS TABLE MIGRATION ==========
-- Adds created_by column to orders table for tracking creator
-- 
-- Steps:
-- 1. Go to: https://app.supabase.com → Your Project → SQL Editor
-- 2. Click: New Query
-- 3. Paste this entire file
-- 4. Click: Run (or Ctrl+Enter)
-- 5. Wait for completion - no errors should appear

-- Add created_by column to orders table if it doesn't exist
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);

-- Create index on created_by for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders(created_by);

-- Add comment to document the column
COMMENT ON COLUMN public.orders.created_by IS 'User ID of the person who created this order (references users.id)';

-- Verify the column was added successfully
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'orders' 
AND column_name = 'created_by';
