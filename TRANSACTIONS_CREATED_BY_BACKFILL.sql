-- ========== SUPABASE - TRANSACTIONS BACKFILL MIGRATION ==========
-- Backfills created_by column for existing transactions
-- This must be run AFTER TRANSACTIONS_CREATED_BY_MIGRATION.sql
-- 
-- Context:
-- The migration added the created_by column but did not populate historical transactions
-- This script backfills NULL created_by values with the oldest system user
-- (typically the first admin who created the system)
--
-- Steps:
-- 1. Go to: https://app.supabase.com → Your Project → SQL Editor
-- 2. Click: New Query
-- 3. Paste this entire file
-- 4. Click: Run (or Ctrl+Enter)
-- 5. Wait for completion - check the number of updated rows

-- Step 1: Find the oldest/first user in the system (usually the admin)
-- This will be the fallback creator for all historical transactions
WITH first_user AS (
  SELECT id
  FROM public.users
  ORDER BY created_at ASC
  LIMIT 1
)
-- Step 2: Update all NULL created_by values to this first user
UPDATE public.transactions
SET created_by = (SELECT id FROM first_user)
WHERE created_by IS NULL OR created_by = '';

-- Step 3: Verify the backfill was successful
-- This should show 0 if all transactions now have a creator
SELECT COUNT(*) as null_created_by_count
FROM public.transactions
WHERE created_by IS NULL OR created_by = '';

-- Step 4: Show sample of updated transactions (verify they now have creators)
SELECT 
  id,
  amount,
  type,
  created_by,
  created_at,
  (SELECT name FROM public.users WHERE id = transactions.created_by LIMIT 1) as creator_name
FROM public.transactions
WHERE created_by IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
