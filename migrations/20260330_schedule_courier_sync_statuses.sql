BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
    INTO existing_job_id
    FROM cron.job
   WHERE jobname = 'courier-sync-statuses-every-10-minutes'
   LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'courier-sync-statuses-every-10-minutes',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ozjddzasadgffjjeqntc.supabase.co/functions/v1/courier-sync-statuses',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96amRkemFzYWRnZmZqamVxbnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzOTMwMzEsImV4cCI6MjA4NTk2OTAzMX0._1fbWup_bHYe0PN5QUcptRMuwZRAEFwQOPEPd7Lk3NY'
    ),
    body := jsonb_build_object(
      'mode', 'incremental',
      'limit', 250
    )
  );
  $$
);

COMMIT;
