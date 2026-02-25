-- Migration: Placeholder for order number handling (client-side retry strategy)
-- No schema changes needed; client now handles duplicate-key errors gracefully
BEGIN;
COMMIT;
