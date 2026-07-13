-- ===========================================================================
-- Schedule the OfferBridge transactional email sender (email-dispatch)
-- ---------------------------------------------------------------------------
-- Run this ONCE in the Supabase SQL Editor (Dashboard) AFTER you have:
--   1. deployed the function:   supabase functions deploy email-dispatch --no-verify-jwt
--   2. set its secrets:         supabase secrets set RESEND_API_KEY=re_xxx
--                               supabase secrets set CRON_SECRET=<random-32-bytes>
--                               supabase secrets set EMAIL_FROM="OfferBridge <no-reply@your-verified-domain>"
--
-- DO NOT COMMIT this file with a real secret filled in. It ships with
-- placeholders only; you replace <CRON_SECRET> in the Dashboard, where the
-- cron job body lives in the database (cron.job), never in Git.
--
-- Trigger design: pg_cron fires every minute and pg_net POSTs the function,
-- which claims a batch and drains the outbox. Overlapping ticks are harmless
-- (claim_email_batch uses FOR UPDATE SKIP LOCKED). One-minute cadence bounds
-- delivery latency to <= ~60s, which is right for lifecycle email.
-- ===========================================================================

-- One-time: enable the scheduler + async HTTP client.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- OPTION A (simplest — matches the project convention): inline the secret.
-- Replace <CRON_SECRET> with the SAME value you passed to `supabase secrets set
-- CRON_SECRET=...`. The plaintext then lives only in cron.job in your database.
-- ---------------------------------------------------------------------------
select cron.schedule(
  'email-dispatch-every-minute',
  '* * * * *',
  $$
    select net.http_post(
      url     := 'https://mdgmgpsdobxjddfpdtxg.functions.supabase.co/email-dispatch',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-cron-secret', '<CRON_SECRET>'),
      body    := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);

-- ---------------------------------------------------------------------------
-- OPTION B (hardening — keep the secret out of cron.job plaintext too): store it
-- in Supabase Vault and read it by name at run time. Run the create_secret line
-- once (its value is not committed here), then schedule referencing the name.
--
--   select vault.create_secret('<CRON_SECRET>', 'email_cron_secret');
--
--   select cron.schedule('email-dispatch-every-minute', '* * * * *', $$
--     select net.http_post(
--       url     := 'https://mdgmgpsdobxjddfpdtxg.functions.supabase.co/email-dispatch',
--       headers := jsonb_build_object('Content-Type','application/json',
--                    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'email_cron_secret')),
--       body    := '{}'::jsonb,
--       timeout_milliseconds := 30000);
--   $$);
-- ---------------------------------------------------------------------------

-- Verify / inspect:
--   select jobid, schedule, jobname from cron.job where jobname = 'email-dispatch-every-minute';
--   select * from cron.job_run_details order by start_time desc limit 10;

-- To change the secret or cadence, unschedule then re-run the block above:
--   select cron.unschedule('email-dispatch-every-minute');
