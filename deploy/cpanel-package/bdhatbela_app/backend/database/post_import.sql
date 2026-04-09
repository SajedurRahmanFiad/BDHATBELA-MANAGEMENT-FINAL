-- Local-only post-import patches.
-- These run after refreshing MariaDB from production Supabase so the local
-- migrated app keeps the data adjustments it expects without modifying Supabase.

UPDATE users
SET role = 'Developer'
WHERE phone = '01404020000';
