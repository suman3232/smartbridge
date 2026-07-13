// Reservation + reliability system E2E. Run AFTER applying supabase/setup.sql.
//
//   node scripts/reservation-e2e.mjs                       # security/probe suite (no admin needed)
//   E2E_ADMIN_EMAIL=you@x.com E2E_ADMIN_PASSWORD=... \
//   node scripts/reservation-e2e.mjs                       # + full lifecycle suite (~3 min: uses short timers)
//
// The full suite shrinks the hold window to 60s via admin_update_reservation_config,
// exercises concurrency/expiry/release/cooldowns/cap, then restores the defaults.
// Requires "Confirm email" OFF (test accounts must get sessions on signup).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const URL_ = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const mk = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const RUN = Date.now();
const PW = `ResE2e-${RUN}-Aa1!`;
const results = [];
const rec = (name, pass, detail = '') => { results.push({ name, pass }); console.log(`${pass ? 'PASS  ' : 'FAIL  '}${name}${detail ? '  — ' + detail : ''}`); };
const sec = (name, secure, detail = '') => { results.push({ name, pass: secure }); console.log(`${secure ? 'SECURE' : '⚠VULN '} ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (s) => { console.log(`      … waiting ${s}s`); return new Promise((r) => setTimeout(r, s * 1000)); };

async function account(tag) {
  const c = mk();
  const email = `res-${RUN}-${tag}@smartdealtest.com`;
  let r = await c.auth.signUp({ email, password: PW, options: { data: { full_name: `Res ${tag}`, preferred_role: 'both' } } });
  if (r.error) throw new Error(`${tag}: ${r.error.message}`);
  if (!r.data.session) throw new Error(`${tag}: no session — turn OFF "Confirm email" while running E2E`);
  return { c, id: r.data.user.id, email };
}

console.log(`\n=== OfferBridge reservation-system E2E ===\nProject: ${URL_}\n`);

// ---------- Probe: are the reservation RPCs deployed? ----------
{
  const anon = mk();
  const { error } = await anon.rpc('expire_stale_reservations');
  if (error && (error.code === 'PGRST202' || /schema cache|could not find/i.test(error.message))) {
    console.log('NOT DEPLOYED — the reservation RPCs are missing on this database.');
    console.log('Apply the latest supabase/setup.sql in the SQL editor, then re-run this script.');
    process.exit(1);
  }
  rec('reservation RPCs deployed (expire_stale_reservations callable)', !error, error?.message);
}

// ---------- Accounts ----------
let shopper, holder1, holder2;
try {
  shopper = await account('shopper'); holder1 = await account('h1'); holder2 = await account('h2');
  rec('created shopper + two holder test accounts', true);
} catch (e) { rec('create test accounts', false, e.message); process.exit(1); }

// ---------- Non-admin security ----------
{
  const t = async (fn) => (await fn).error;
  sec('non-admin blocked: admin_list_reservation_events', !!(await t(holder1.c.rpc('admin_list_reservation_events', { p_limit: 5 }))));
  sec('non-admin blocked: admin_list_cardholder_reliability', !!(await t(holder1.c.rpc('admin_list_cardholder_reliability'))));
  sec('non-admin blocked: admin_reset_cardholder', !!(await t(holder1.c.rpc('admin_reset_cardholder', { p_user_id: holder1.id }))));
  sec('non-admin blocked: admin_reopen_reservation', !!(await t(holder1.c.rpc('admin_reopen_reservation', { p_deal_id: crypto.randomUUID() }))));
  sec('non-admin blocked: admin_update_reservation_config', !!(await t(holder1.c.rpc('admin_update_reservation_config', { p_enabled: true, p_hold_seconds: 60, p_release_grace_seconds: 0, p_max_accepts_per_deal: 1, p_strike_window_days: 1, p_cooldown2_seconds: 0, p_cooldown3_seconds: 0, p_cooldown_abuse_seconds: 0 }))));
  sec('internal helper not client-callable: apply_reliability_strike', !!(await t(holder1.c.rpc('apply_reliability_strike', { p_user_id: holder1.id, p_deal_id: crypto.randomUUID(), p_product_name: 'x' }))));
  sec('internal helper not client-callable: maybe_qualify_referral', !!(await t(holder1.c.rpc('maybe_qualify_referral', { p_user_id: holder1.id, p_deal_id: crypto.randomUUID(), p_deal_value: 999999 }))));
  const rel = await holder1.c.rpc('release_deal', { p_deal_id: crypto.randomUUID() });
  sec('release_deal rejects unknown deal', !!rel.error);
  const st = await holder1.c.rpc('get_my_reservation_status');
  rec('get_my_reservation_status returns a row for a signed-in user', !st.error && Array.isArray(st.data) && st.data.length === 1, st.error?.message);
}

// ---------- Admin-driven lifecycle ----------
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL, ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.log('\nAdmin suite SKIPPED — set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to run the full lifecycle (concurrency, expiry, cooldowns).');
} else {
  const admin = mk();
  const a = await admin.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (a.error) { rec('admin sign-in', false, a.error.message); process.exit(1); }
  rec('admin sign-in', true);

  const HOLD = 60, GRACE = 8, CD2 = 90;
  const setCfg = (hold, grace, cd2) => admin.rpc('admin_update_reservation_config', {
    p_enabled: true, p_hold_seconds: hold, p_release_grace_seconds: grace, p_max_accepts_per_deal: 3,
    p_strike_window_days: 30, p_cooldown2_seconds: cd2, p_cooldown3_seconds: 86400, p_cooldown_abuse_seconds: 604800,
  });
  {
    const { error } = await setCfg(HOLD, GRACE, CD2);
    rec(`admin shrank timers for test (hold ${HOLD}s, grace ${GRACE}s, cooldown2 ${CD2}s)`, !error, error?.message);
    if (error) process.exit(1);
  }

  // From here on, ALWAYS restore the production config — even on crash or Ctrl+C —
  // so a failed run can never leave the live site with a 60-second hold window.
  const restoreDefaults = async () => {
    const { error } = await admin.rpc('admin_update_reservation_config', {
      p_enabled: true, p_hold_seconds: 1800, p_release_grace_seconds: 300, p_max_accepts_per_deal: 3,
      p_strike_window_days: 30, p_cooldown2_seconds: 3600, p_cooldown3_seconds: 86400, p_cooldown_abuse_seconds: 604800,
    });
    rec('restored default reservation config (30m/5m/1h/24h/7d)', !error, error?.message);
  };
  process.on('SIGINT', async () => { console.log('\nInterrupted — restoring config…'); await restoreDefaults(); process.exit(130); });

  try {

  const makeDeal = async (n) => {
    const { data, error } = await shopper.c.from('deals').insert({
      merchant_id: shopper.id, product_name: `Res E2E ${n}-${RUN}`, product_link: 'https://example.com/p',
      original_price: 1000, card_offer_price: 800, expected_buy_price: 900, commission_amount: 50,
      required_card: 'HDFC', delivery_address: 'E2E Street 1', advance_amount: 800, remaining_amount: 100, status: 'pending',
    }).select("id").single();
    if (error) throw new Error(error.message);
    const ap = await admin.rpc('approve_deal', { deal_id: data.id });
    if (ap.error) throw new Error(ap.error.message);
    return data.id;
  };

  let d1, d2, d3;
  try { d1 = await makeDeal(1); d2 = await makeDeal(2); d3 = await makeDeal(3); rec('shopper posted + admin approved 3 deals', true); }
  catch (e) { rec('create/approve deals', false, e.message); throw e; }

  // Concurrency: exactly one of two simultaneous accepts wins.
  {
    const [r1, r2] = await Promise.all([
      holder1.c.rpc('accept_deal', { p_deal_id: d1 }),
      holder2.c.rpc('accept_deal', { p_deal_id: d1 }),
    ]);
    const wins = [r1, r2].filter((r) => !r.error).length;
    rec('concurrent accept: exactly one winner', wins === 1, `winners=${wins}`);
    // Normalize: make holder1 the winner for the rest of the flow.
    if (r1.error && !r2.error) { const t = holder1; holder1 = holder2; holder2 = t; }
  }

  // Reserved visibility.
  {
    const { data } = await mk().rpc('list_open_deals');
    const row = (data ?? []).find((d) => d.id === d1);
    rec('browse feed shows the deal as reserved with a deadline', !!row && row.is_reserved === true && !!row.reserved_until, JSON.stringify({ found: !!row, is_reserved: row?.is_reserved }));
    sec('holder identity hidden in public feed', !row || row.customer_id === null);
    const pv = await holder2.c.rpc('get_deal_accept_preview', { p_deal_id: d1 });
    rec('reserved deal not previewable/acceptable by others', !pv.error && (pv.data ?? []).length === 0);
    const again = await holder2.c.rpc('accept_deal', { p_deal_id: d1 });
    rec('second user cannot accept a reserved deal', !!again.error);
  }

  // Proof enforcement.
  {
    const noProof = await holder1.c.rpc('place_deal_order', { p_deal_id: d1 });
    rec('empty proof rejected (screenshot required)', !!noProof.error && /screenshot|tracking id/i.test(noProof.error?.message ?? ''), noProof.error?.message);
    const EDD = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    const wrongUser = await holder2.c.rpc('place_deal_order', { p_deal_id: d1, p_order_screenshot_url: 'x/s.png', p_marketplace_order_id: 'FAKE-1', p_estimated_delivery_date: EDD });
    sec('non-holder cannot submit proof', !!wrongUser.error, wrongUser.error?.message);
  }

  // One active reservation at a time.
  {
    const second = await holder1.c.rpc('accept_deal', { p_deal_id: d2 });
    rec('cannot hold two reservations at once', !!second.error && /current reservation/i.test(second.error?.message ?? ''), second.error?.message);
  }

  // Grace release: penalty-free, deal reopens.
  {
    const rel = await holder1.c.rpc('release_deal', { p_deal_id: d1 });
    rec('voluntary release within grace succeeds', !rel.error && rel.data?.status === 'approved', rel.error?.message);
    const { data: relRow } = await holder1.c.from('cardholder_reliability').select('*').eq('user_id', holder1.id).maybeSingle();
    rec('grace release: no strike, no cooldown', (relRow?.strikes_30d ?? 0) === 0 && !relRow?.acceptance_blocked_until, JSON.stringify(relRow ?? {}));
  }

  // Re-accept cap: 3 reserves of the same deal, 4th blocked.
  {
    const r2 = await holder1.c.rpc('accept_deal', { p_deal_id: d1 });          // reserve #2
    const rel2 = r2.error ? null : await holder1.c.rpc('release_deal', { p_deal_id: d1 });
    const r3 = await holder1.c.rpc('accept_deal', { p_deal_id: d1 });          // reserve #3
    const rel3 = r3.error ? null : await holder1.c.rpc('release_deal', { p_deal_id: d1 });
    const r4 = await holder1.c.rpc('accept_deal', { p_deal_id: d1 });          // reserve #4 → cap
    rec('accept/release cycling capped per deal (4th reserve blocked)',
      !r2.error && !rel2?.error && !r3.error && !rel3?.error && !!r4.error && /maximum number of times/i.test(r4.error?.message ?? ''),
      r4.error?.message);
  }

  // Expiry #1 → strike (warning only), deal reopens.
  {
    const acc = await holder1.c.rpc('accept_deal', { p_deal_id: d2 });
    rec('holder reserves deal 2', !acc.error, acc.error?.message);
    await sleep(HOLD + 4);
    const EDD_L = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    const late = await holder1.c.rpc('place_deal_order', { p_deal_id: d2, p_order_screenshot_url: 'x/s.png', p_marketplace_order_id: 'LATE-1', p_estimated_delivery_date: EDD_L });
    rec('proof AFTER the window is rejected (server clock, not client)', !!late.error && /expired/i.test(late.error?.message ?? ''), late.error?.message);
    // The rejection itself doesn't persist the expiry (a RAISE would roll it back
    // server-side) — the app finalizes it via the sweep, exactly like this:
    await mk().rpc('expire_stale_reservations');
    const { data: d2row } = await holder1.c.rpc('get_deal_for_viewer', { p_deal_id: d2 });
    rec('expired reservation auto-reopened the deal', d2row?.[0]?.status === 'approved' && d2row?.[0]?.customer_id === null, d2row?.[0]?.status);
    const { data: relRow } = await holder1.c.from('cardholder_reliability').select('*').eq('user_id', holder1.id).maybeSingle();
    rec('1st expiry = warning only (strike recorded, no cooldown)', relRow?.strikes_30d === 1 && !relRow?.acceptance_blocked_until, JSON.stringify({ strikes: relRow?.strikes_30d, blocked: relRow?.acceptance_blocked_until }));
  }

  // Expiry #2 → cooldown blocks further accepts; admin reset lifts it.
  {
    const acc = await holder1.c.rpc('accept_deal', { p_deal_id: d2 });
    rec('holder reserves deal 2 again', !acc.error, acc.error?.message);
    await sleep(HOLD + 4);
    await mk().rpc('expire_stale_reservations'); // anonymous sweep — anyone may trigger expiry of stale holds
    const { data: relRow } = await holder1.c.from('cardholder_reliability').select('*').eq('user_id', holder1.id).maybeSingle();
    const blocked = relRow?.acceptance_blocked_until && new Date(relRow.acceptance_blocked_until) > new Date();
    rec('2nd expiry in window ⇒ acceptance cooldown set', relRow?.strikes_30d === 2 && !!blocked, JSON.stringify({ strikes: relRow?.strikes_30d, blocked: relRow?.acceptance_blocked_until }));
    const tryAccept = await holder1.c.rpc('accept_deal', { p_deal_id: d3 });
    rec('cooldown enforced at RPC level (accept blocked)', !!tryAccept.error && /cooldown/i.test(tryAccept.error?.message ?? ''), tryAccept.error?.message);
    const reset = await admin.rpc('admin_reset_cardholder', { p_user_id: holder1.id, p_note: 'E2E reset' });
    rec('admin override lifts the cooldown', !reset.error, reset.error?.message);
    const after = await holder1.c.rpc('accept_deal', { p_deal_id: d3 });
    rec('holder can accept again after admin reset', !after.error, after.error?.message);
    await holder1.c.rpc('release_deal', { p_deal_id: d3 }); // within grace, free
  }

  // Admin force-reopen (no strike for the holder).
  {
    const acc = await holder2.c.rpc('accept_deal', { p_deal_id: d3 });
    rec('second holder reserves deal 3', !acc.error, acc.error?.message);
    const reopen = await admin.rpc('admin_reopen_reservation', { p_deal_id: d3 });
    rec('admin_reopen_reservation reopens without strike', !reopen.error && reopen.data?.status === 'approved', reopen.error?.message);
    const { data: relRow } = await holder2.c.from('cardholder_reliability').select('*').eq('user_id', holder2.id).maybeSingle();
    rec('admin reopen recorded no strike for the holder', (relRow?.strikes_30d ?? 0) === 0, JSON.stringify(relRow ?? {}));
  }

  // Happy path: proof in time stops the timer; completion + wallet still work.
  {
    const acc = await holder2.c.rpc('accept_deal', { p_deal_id: d3 });
    const EDD3 = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    const placed = await holder2.c.rpc('place_deal_order', { p_deal_id: d3, p_tracking_id: `E2E-TRK-${RUN}`, p_order_screenshot_url: 'x/s.png', p_marketplace_order_id: `OID-${RUN}`, p_estimated_delivery_date: EDD3 });
    rec('proof within window accepted (fulfilled)', !acc.error && !placed.error, placed.error?.message);
    const { data: v } = await holder2.c.rpc('get_deal_for_viewer', { p_deal_id: d3 });
    rec('timer cleared and deal moved to in_progress', v?.[0]?.status === 'in_progress' && v?.[0]?.reserved_until === null, JSON.stringify({ status: v?.[0]?.status, ru: v?.[0]?.reserved_until }));
    // New-flow settlement: admin verifies order proof → buyer pays → admin verifies
    // payment → buyer confirms receipt.
    await admin.rpc('admin_verify_order_proof', { p_deal_id: d3, p_action: 'approve' });
    await shopper.c.rpc('submit_buyer_payment', { p_deal_id: d3, p_reference: `UTR-${RUN}` });
    await admin.rpc('admin_verify_payment', { p_deal_id: d3, p_approve: true });
    await shopper.c.rpc('buyer_confirm_receipt', { p_deal_id: d3 });
    const before = (await holder2.c.from('wallets').select('balance').eq('user_id', holder2.id).single()).data?.balance ?? 0;
    const done = await admin.rpc('complete_deal', { p_deal_id: d3 });
    const after = (await holder2.c.from('wallets').select('balance').eq('user_id', holder2.id).single()).data?.balance ?? 0;
    rec('REGRESSION: complete_deal still credits reimbursement + commission', !done.error && Number(after) - Number(before) === 850, `Δ=${Number(after) - Number(before)}`);
  }

  // Audit trail.
  {
    const { data, error } = await admin.rpc('admin_list_reservation_events', { p_limit: 200 });
    const types = new Set((data ?? []).filter((e) => [d1, d2, d3].includes(e.deal_id)).map((e) => e.event_type));
    rec('audit trail captured reserved/released/expired/admin_reopened/fulfilled',
      !error && ['reserved', 'released', 'expired', 'admin_reopened', 'fulfilled'].every((t) => types.has(t)),
      [...types].join(','));
  }

  // Cleanup (config restore happens in finally below).
  await admin.rpc('admin_reset_cardholder', { p_user_id: holder1.id, p_note: 'E2E cleanup' });
  await shopper.c.rpc('cancel_deal', { p_deal_id: d1 }).catch(() => {});
  await shopper.c.rpc('cancel_deal', { p_deal_id: d2 }).catch(() => {});

  } finally {
    await restoreDefaults();
  }
}

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
if (failed.length) { failed.forEach((f) => console.log(`FAILED: ${f.name}`)); process.exit(1); }
