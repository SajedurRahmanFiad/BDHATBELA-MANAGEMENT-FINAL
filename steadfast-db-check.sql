-- Diagnostic query to check Steadfast settings in database
-- Run this in Supabase SQL editor

SELECT 
  id,
  steadfast_base_url,
  steadfast_api_key,
  steadfast_secret_key,
  LENGTH(steadfast_base_url) as baseurl_length,
  LENGTH(steadfast_api_key) as apikey_length,
  LENGTH(steadfast_secret_key) as secretkey_length,
  created_at,
  updated_at
FROM courier_settings
LIMIT 5;
