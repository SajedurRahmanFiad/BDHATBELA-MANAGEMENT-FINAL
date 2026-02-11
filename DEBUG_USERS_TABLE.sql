-- ========== DEBUG AND FIX USERS TABLE ==========
-- Run this in Supabase SQL Editor to diagnose and fix the issue

-- 1. First, check if the user exists
SELECT id, name, phone, role, created_at 
FROM public.users 
WHERE id = 'edda12c5-4ecf-4b44-8a32-050f17423756';

-- 2. Check what policies exist on the users table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'users';

-- 3. If user doesn't exist, insert them as Admin (run this if query #1 returns nothing)
-- INSERT INTO public.users (id, name, phone, role, created_at)
-- VALUES ('edda12c5-4ecf-4b44-8a32-050f17423756', 'Admin User', '01404020000', 'Admin', NOW());

-- 4. Fix RLS policies - COMPLETE RESET
-- Disable RLS
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies
DROP POLICY IF EXISTS users_all ON public.users;
DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_insert ON public.users;
DROP POLICY IF EXISTS users_update ON public.users;
DROP POLICY IF EXISTS users_delete ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Allow all authenticated" ON public.users;
DROP POLICY IF EXISTS "Allow public read" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.users;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.users;

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create simple policy using auth.uid() which doesn't cause recursion
CREATE POLICY users_all ON public.users 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Grant proper permissions
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO anon;

-- 6. Verify the fix
SELECT * FROM pg_policies WHERE tablename = 'users';

-- 7. Test the query that the app is running
-- (This should work now without 500 error)
