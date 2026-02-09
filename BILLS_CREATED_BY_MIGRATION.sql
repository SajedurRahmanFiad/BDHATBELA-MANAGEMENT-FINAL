-- ========== SUPABASE - BILLS TABLE MIGRATION ==========
-- Adds created_by column to bills table for tracking creator
-- 
-- Steps:
-- 1. Go to: https://app.supabase.com → Your Project → SQL Editor
-- 2. Click: New Query
-- 3. Paste this entire file
-- 4. Click: Run (or Ctrl+Enter)
-- 5. Wait for completion - no errors should appear

-- Add created_by column to bills table if it doesn't exist
ALTER TABLE public.bills
ADD COLUMN IF NOT EXISTS created_by VARCHAR(36);

-- Create index on created_by for faster lookups
CREATE INDEX IF NOT EXISTS idx_bills_created_by ON public.bills(created_by);

-- Add comment to document the column
COMMENT ON COLUMN public.bills.created_by IS 'User ID of the person who created this bill (references users.id)';

-- Verify the column was added successfully
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'bills' 
AND column_name = 'created_by';
