-- ========== SUPABASE RLS FIX - RESOLVES INFINITE RECURSION ==========
-- Run this in Supabase SQL Editor to fix the recursion error
-- 
-- The issue: Using auth.role() can cause recursion if it queries the users table
-- The fix: Use (auth.uid() IS NOT NULL) instead, which checks JWT without querying

-- First, disable RLS temporarily to break any recursion loops
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on users table
DROP POLICY IF EXISTS users_all ON public.users;
DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_insert ON public.users;
DROP POLICY IF EXISTS users_update ON public.users;
DROP POLICY IF EXISTS users_delete ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Allow all authenticated" ON public.users;
DROP POLICY IF EXISTS "Allow public read" ON public.users;

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create a simple policy using auth.uid() which doesn't query the table
-- This checks if user has a valid JWT (is authenticated) without recursion
CREATE POLICY users_all ON public.users 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Alternative: If you need to restrict users to only see their own profile:
-- CREATE POLICY users_own_data ON public.users 
--   FOR ALL 
--   TO authenticated 
--   USING (id = auth.uid())
--   WITH CHECK (id = auth.uid());

-- Force policy cache refresh
NOTIFY pgrst, 'reload schema';

-- Verify the policy was created
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'users';
