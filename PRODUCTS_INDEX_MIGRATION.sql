-- ========== PERFORMANCE FIX: ADD MISSING INDEXES ON PRODUCTS TABLE ==========
-- This SQL script adds performance indexes to the products table
-- These indexes are critical for the fetchProducts query which sorts by created_at
-- and optionally filters by category
-- 
-- FIX DETAILS:
-- - Products cache was reduced from 30 min to 5 min to match orders/customers
-- - Products query now selects only needed columns instead of all (*)
-- - Adding indexes below ensures the ORDER BY created_at and category filtering are fast
--
-- Run this SQL in your Supabase SQL Editor

-- Add index on created_at for ORDER BY clause (CRITICAL for performance)
CREATE INDEX IF NOT EXISTS idx_products_created_at_desc ON public.products(created_at DESC);

-- Add index on category for filtering (used in optional category filter)
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

-- Optional but recommended: Composite index for typical query pattern
-- This speeds up queries that filter by category AND sort by created_at
CREATE INDEX IF NOT EXISTS idx_products_category_created_at ON public.products(category, created_at DESC);

-- Verify indexes were created - run this query to see the indexes:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'products' ORDER BY indexname;
