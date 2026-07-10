-- ============================================================================
-- Schedule automatic price re-checks (every 6 hours) for the Price Tracker.
-- Run this in Supabase Dashboard -> SQL Editor AFTER you have:
--   1. Deployed the edge function:   supabase functions deploy price-check
--   2. Set its secrets:              supabase secrets set CRON_SECRET=<random>
--                                    supabase secrets set SCRAPER_API_KEY=<optional>
--
-- Replace the two placeholders below:
--   <PROJECT_REF>   -> your project ref (e.g. mdgmgpsdobxjddfpdtxg)
--   <CRON_SECRET>   -> the same value you set as the CRON_SECRET function secret
-- ============================================================================

-- Supabase ships these; enable if not already on.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous schedule with this name (safe to re-run).
SELECT cron.unschedule('price-check-every-6h')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'price-check-every-6h');

SELECT cron.schedule(
  'price-check-every-6h',
  '0 */6 * * *',   -- at minute 0 every 6 hours
  $$
  SELECT net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/price-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := jsonb_build_object('mode', 'cron')
  );
  $$
);

-- Verify:
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'price-check-every-6h';
