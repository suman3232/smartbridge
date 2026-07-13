// Transactional-email outbox worker E2E. Run AFTER applying supabase/setup.sql.
//   node scripts/email-e2e.mjs                                   # security probes only
//   E2E_SERVICE_ROLE_KEY=eyJ... node scripts/email-e2e.mjs       # + worker logic (claim/mark/backoff/dedup)
//
// The service-role suite exercises the DB delivery guarantees WITHOUT sending a
// real email (no Resend call). Genuine provider delivery is verified separately
// once RESEND_API_KEY + the pg_cron trigger are configured (see the report).
//
// NOTE: the service-role suite claims outbox rows (bumping attempts / leasing
// them briefly), so run it against a NON-PRODUCTION Supabase project — the same
// test project the other E2E scripts target. It cleans up every row it creates.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const mk = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const RUN = Date.now(), PW = `Eml-${RUN}-Aa1!`, out = [];
const rec = (n, p, d = '') => { out.push({ n, p }); console.log(`${p === null ? 'INFO ' : p ? 'PASS ' : 'FAIL '} ${n}${d ? ' — ' + d : ''}`); };
const sec = (n, s, d = '') => { out.push({ n, p: s }); console.log(`${s ? 'SECURE' : '⚠VULN '} ${n}${d ? ' — ' + d : ''}`); };
const rid = crypto.randomUUID();

console.log(`\n=== OfferBridge email-outbox E2E — ${env.VITE_SUPABASE_URL} ===\n`);

// Deployment check: the worker RPC must exist.
{
  const { error } = await mk().rpc('claim_email_batch', { p_worker: 'probe' });
  // A deployed-but-revoked function returns a permission error (42501 / "permission denied"),
  // NOT a "could not find function" (PGRST202). The latter means not deployed.
  if (error && (error.code === 'PGRST202' || /could not find|schema cache/i.test(error.message))) {
    console.log('NOT DEPLOYED — apply the latest supabase/setup.sql, then re-run.'); process.exit(1);
  }
  rec('email worker RPCs deployed', true);
}

// ---- Security probes: no client (anon or authenticated) may drive the sender ----
{
  const anon = mk();
  sec('anon blocked: claim_email_batch (cannot lease/drain the queue)', !!(await anon.rpc('claim_email_batch', { p_worker: 'x' })).error);
  sec('anon blocked: mark_email_sent (cannot forge delivery)', !!(await anon.rpc('mark_email_sent', { p_id: rid, p_worker: 'x', p_provider_message_id: 'y' })).error);
  sec('anon blocked: mark_email_failed (cannot tamper with retries)', !!(await anon.rpc('mark_email_failed', { p_id: rid, p_worker: 'x', p_error: 'y' })).error);
  sec('anon blocked: admin_email_outbox_summary', !!(await anon.rpc('admin_email_outbox_summary')).error);
  const sel = await anon.from('email_outbox').select('id,to_email,subject').limit(1);
  // RLS is admin-only SELECT → an anon read yields zero rows (never other users' emails/subjects).
  sec('anon cannot read email_outbox rows (no recipient/subject leak)', (sel.data ?? []).length === 0);
}

// An authenticated non-admin is equally locked out of the worker + admin surface.
{
  const c = mk();
  const email = `eml-${RUN}-user@smartdealtest.com`;
  const r = await c.auth.signUp({ email, password: PW, options: { data: { full_name: 'Eml User', preferred_role: 'both' } } });
  if (r.error || !r.data.session) {
    rec('authenticated-user probes', null, 'skipped (Confirm email is ON — needs a session)');
  } else {
    sec('authenticated non-admin blocked: claim_email_batch', !!(await c.rpc('claim_email_batch', { p_worker: 'x' })).error);
    sec('authenticated non-admin blocked: mark_email_sent', !!(await c.rpc('mark_email_sent', { p_id: rid, p_worker: 'x', p_provider_message_id: 'y' })).error);
    sec('authenticated non-admin blocked: admin_email_outbox_summary (admins only)', !!(await c.rpc('admin_email_outbox_summary')).error);
    const sel = await c.from('email_outbox').select('id,subject').limit(1);
    sec('authenticated non-admin cannot read other users\' email_outbox', (sel.data ?? []).length === 0);
  }
}

// ---- Optional: service-role worker-logic suite (real claim/mark/backoff/dedup) ----
const SRK = process.env.E2E_SERVICE_ROLE_KEY;
if (!SRK) {
  console.log('\nWorker-logic suite SKIPPED — set E2E_SERVICE_ROLE_KEY to exercise claim/mark/backoff/dedup.');
} else {
  const svc = createClient(env.VITE_SUPABASE_URL, SRK, { auth: { persistSession: false, autoRefreshToken: false } });
  const TAG = `e2e-email:${RUN}`;
  const mkRow = (n, over = {}) => ({ to_email: `sink+${RUN}-${n}@smartdealtest.com`, subject: `E2E ${n}`, body: `body ${n}`, dedup_key: `${TAG}:${n}`, ...over });
  const get = async (id) => (await svc.from('email_outbox').select('*').eq('id', id).single()).data;

  try {
    // (1) claim leases the row: processing + attempts=1 + locked_by set.
    const ins1 = await svc.from('email_outbox').insert(mkRow(1)).select('id').single();
    rec('service: queued a test row', !ins1.error, ins1.error?.message);
    const id1 = ins1.data.id;
    const c1 = await svc.rpc('claim_email_batch', { p_worker: 'wA', p_limit: 50, p_lease_seconds: 600 });
    const claimed1 = (c1.data ?? []).find((r) => r.id === id1);
    rec('service: claim_email_batch leases the row (status=processing, attempts=1)', !!claimed1 && claimed1.status === 'processing' && claimed1.attempts === 1, claimed1 && `attempts=${claimed1.attempts}`);
    rec('service: claim sets locked_by to the worker', !!claimed1 && claimed1.locked_by === 'wA');

    // (2) a second worker cannot re-claim a freshly-leased row (no double-send).
    const c2 = await svc.rpc('claim_email_batch', { p_worker: 'wB', p_limit: 50, p_lease_seconds: 600 });
    const reclaimed = (c2.data ?? []).find((r) => r.id === id1);
    sec('service: leased row is NOT re-claimable by a second worker', !reclaimed);

    // (3) a stale worker cannot finalize a row it no longer holds (fencing).
    await svc.rpc('mark_email_sent', { p_id: id1, p_worker: 'wB', p_provider_message_id: 'stale' });
    let row1 = await get(id1);
    sec('service: mark_email_sent by WRONG worker is a no-op (fencing)', row1.status === 'processing' && row1.provider_message_id === null);

    // (4) the real lease-holder finalizes; re-marking is idempotent.
    await svc.rpc('mark_email_sent', { p_id: id1, p_worker: 'wA', p_provider_message_id: 'msg_e2e_1' });
    row1 = await get(id1);
    rec('service: mark_email_sent by lease-holder → sent + provider id + sent_at', row1.status === 'sent' && row1.provider_message_id === 'msg_e2e_1' && !!row1.sent_at);
    await svc.rpc('mark_email_sent', { p_id: id1, p_worker: 'wA', p_provider_message_id: 'msg_DUP' });
    row1 = await get(id1);
    rec('service: re-marking a sent row is idempotent (id unchanged)', row1.provider_message_id === 'msg_e2e_1');

    // (5) transient failure requeues with backoff into the future; attempts recorded.
    const id2 = (await svc.from('email_outbox').insert(mkRow(2)).select('id').single()).data.id;
    await svc.rpc('claim_email_batch', { p_worker: 'wA', p_limit: 50, p_lease_seconds: 600 });
    await svc.rpc('mark_email_failed', { p_id: id2, p_worker: 'wA', p_error: 'resend 500', p_permanent: false });
    const row2 = await get(id2);
    rec('service: transient fail → requeued (status=queued), error stored', row2.status === 'queued' && /500/.test(row2.last_error || ''));
    rec('service: transient fail applies backoff (next_attempt_at in the future)', new Date(row2.next_attempt_at).getTime() > Date.now() + 1000);
    rec('service: attempt counted (attempts=1, released lock)', row2.attempts === 1 && row2.locked_by === null);

    // (6) permanent failure dead-letters immediately.
    const id3 = (await svc.from('email_outbox').insert(mkRow(3)).select('id').single()).data.id;
    await svc.rpc('claim_email_batch', { p_worker: 'wA', p_limit: 50, p_lease_seconds: 600 });
    await svc.rpc('mark_email_failed', { p_id: id3, p_worker: 'wA', p_error: 'resend 422', p_permanent: true });
    rec('service: permanent fail → terminal (status=failed)', (await get(id3)).status === 'failed');

    // (7) duplicate dedup_key can't create a second row (queuing idempotency).
    const dupKey = `${TAG}:dup`;
    const d1 = await svc.from('email_outbox').insert(mkRow('dupA', { dedup_key: dupKey }));
    const d2 = await svc.from('email_outbox').insert(mkRow('dupB', { dedup_key: dupKey }));
    sec('service: duplicate dedup_key rejected by the UNIQUE constraint (no double email)', !d1.error && !!d2.error);

    // (8) a row stranded in 'processing' at max attempts (a worker crashed on the
    // final send) is dead-lettered by the next claim — never limbo'd forever.
    const strandedIns = await svc.from('email_outbox').insert(mkRow('stranded', {
      status: 'processing', attempts: 6, max_attempts: 6, locked_by: 'dead-worker',
      processing_started_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    })).select('id').single();
    const sid = strandedIns.data.id;
    await svc.rpc('claim_email_batch', { p_worker: 'wA', p_limit: 50, p_lease_seconds: 600 });
    rec('service: stranded max-attempt processing row is dead-lettered (status=failed)', (await get(sid)).status === 'failed');

    // (9) admin summary RPC is admin-gated: a keyed-but-user-less service client has
    // auth.uid()=NULL so is_admin() is false and it is rejected (informational).
    const summ = await svc.rpc('admin_email_outbox_summary');
    rec('service: admin_email_outbox_summary is admin-gated (service client without a user is rejected)', !!summ.error, summ.error?.message?.slice(0, 40));
  } catch (e) {
    rec('service worker-logic suite', false, e.message);
  } finally {
    // Cleanup every row this run created.
    await svc.from('email_outbox').delete().like('dedup_key', `${TAG}%`);
    rec('service: cleaned up test rows', true);
  }
}

const fails = out.filter((o) => o.p === false).length;
console.log(`\n${fails ? `❌ ${fails} check(s) failed` : '✅ all checks passed'} (${out.length} total)\n`);
process.exit(fails ? 1 : 0);
