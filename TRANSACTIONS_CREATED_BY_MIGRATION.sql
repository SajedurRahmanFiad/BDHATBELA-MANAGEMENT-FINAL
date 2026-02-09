-- ========== SUPABASE - TRANSACTIONS TABLE MIGRATION ==========
-- Adds created_by column to track which user created each transaction
-- Run this migration to enable transaction creator tracking
-- 
-- Steps:
-- 1. Go to: https://app.supabase.com → Your Project → SQL Editor
-- 2. Click: New Query
-- 3. Paste this entire file
-- 4. Click: Run (or Ctrl+Enter)
-- 5. Wait for completion - no errors should appear
-- 6. Then refresh your React app to load the updated schema

-- Add created_by column to transactions table if it doesn't exist
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);

-- Create index on created_by for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON public.transactions(created_by);

-- Add comment to document the column
COMMENT ON COLUMN public.transactions.created_by IS 'User ID of the person who created this transaction (references users.id)';

-- Optional: Update created_by with data from created_at timestamp if needed
-- This is for historical records if you want to backfill with current user
-- Uncomment and run separately if needed:
-- UPDATE public.transactions
-- SET created_by = (SELECT id FROM public.users LIMIT 1)
-- WHERE created_by IS NULL;

-- Verify the column was added successfully
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transactions' 
AND column_name = 'created_by';
