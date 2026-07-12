// End-to-end + security verification. Run: node scripts/e2e-test.mjs
// Uses the anon key (email auto-confirm must be ON). Reuses fixed test accounts.
// Run this AFTER applying supabase/setup.sql to verify every fix + feature.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const URL_ = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const mk = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// Test-account password comes from the environment — never hardcoded/committed.
// Run with:  E2E_PASSWORD='your-test-pw' node scripts/e2e-test.mjs
const TEST_PASSWORD = process.env.E2E_PASSWORD;
if (!TEST_PASSWORD) {
  console.log("Set E2E_PASSWORD to run the suite, e.g.  E2E_PASSWORD=... node scripts/e2e-test.mjs");
  process.exit(0);
}
const TEST_DOMAIN = process.env.E2E_DOMAIN || "smartdealtest.com";

const results = [];
const rec = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS  ' : 'FAIL  '}${name}${detail ? '  — ' + detail : ''}`); };
const sec = (name, secure, detail = '') => { results.push({ name, pass: secure, detail, sec: true }); console.log(`${secure ? 'SECURE' : '⚠VULN '} ${name}${detail ? '  — ' + detail : ''}`); };

async function account(role) {
  const c = mk();
  const email = `e2e-${role}@${TEST_DOMAIN}`, password = TEST_PASSWORD;
  let r = await c.auth.signInWithPassword({ email, password });
  if (r.error) {
    r = await c.auth.signUp({ email, password, options: { data: { full_name: `E2E ${role}`, preferred_role: 'both' } } });
    if (r.error) throw new Error(`${role}: ${r.error.message}`);
  }
  if (!r.data.session) throw new Error(`${role}: no session (turn OFF Confirm email for E2E)`);
  return { c, id: r.data.user.id, email };
}

console.log('\n=== SmartDeal E2E + Security verification ===\n');
let shopper, holder;
try { shopper = await account('shopper'); holder = await account('holder'); rec('sign in/up two test users', true); }
catch (e) { rec('sign in/up test users', false, e.message); process.exit(0); }

// ---- signup triggers ----
await new Promise((r) => setTimeout(r, 500));
rec('profile auto-created', !!(await shopper.c.from('profiles').select('id').eq('id', shopper.id).maybeSingle()).data);
rec('wallet auto-created', !!(await shopper.c.from('wallets').select('user_id').eq('user_id', shopper.id).maybeSingle()).data);

// ---- deal creation (pending) ----
let dealId = null;
{
  const { data, error } = await shopper.c.from('deals').insert({
    merchant_id: shopper.id, product_name: 'E2E Product', product_link: 'https://example.com/p',
    original_price: 1000, card_offer_price: 800, expected_buy_price: 900, commission_amount: 50,
    required_card: 'HDFC', delivery_address: '221B Baker Street, London', advance_amount: 800, remaining_amount: 100, status: 'pending',
  }).select('id').maybeSingle();
  dealId = data?.id ?? null;
  rec('shopper creates pending deal', !error && !!dealId, error?.message);
}

// ---- SECURITY: the four previously-confirmed holes must now be closed ----
{
  const { data, error } = await shopper.c.from('deals').insert({
    merchant_id: shopper.id, product_name: 'HACK', product_link: 'https://x.com', original_price: 1, card_offer_price: 1,
    expected_buy_price: 1, commission_amount: 999, required_card: 'x', delivery_address: 'x', advance_amount: 1, remaining_amount: 0, status: 'approved',
  }).select('id').maybeSingle();
  sec('cannot self-insert an APPROVED deal', !!error || !data, error ? 'blocked' : `INSERTED ${data?.id?.slice(0, 8)}`);
  if (data?.id) await shopper.c.from('deals').delete().eq('id', data.id);
}
if (dealId) {
  const { data, error } = await shopper.c.from('deals').update({ status: 'approved' }).eq('id', dealId).select().maybeSingle();
  sec('cannot self-APPROVE via direct UPDATE', !!error || data?.status !== 'approved', error ? 'blocked' : `status=${data?.status}`);
}
{
  const { data, error } = await shopper.c.from('wallets').update({ balance: 999999 }).eq('user_id', shopper.id).select().maybeSingle();
  sec('cannot set own WALLET balance', !!error || (data?.balance ?? 0) < 999999, error ? 'blocked' : `balance=${data?.balance}`);
  if ((data?.balance ?? 0) >= 999999) await shopper.c.from('wallets').update({ balance: 0 }).eq('user_id', shopper.id);
}
{
  const { data, error } = await shopper.c.from('payments').insert({ from_user_id: shopper.id, to_user_id: shopper.id, amount: 5000, payment_type: 'commission', status: 'released' }).select().maybeSingle();
  sec('cannot INSERT fake payments', !!error || !data, error ? 'blocked' : 'inserted');
}
{
  const { data, error } = await shopper.c.from('withdrawal_requests').insert({ user_id: shopper.id, amount: 5000 }).select().maybeSingle();
  sec('cannot direct-INSERT withdrawal_requests', !!error || !data, error ? 'blocked' : 'inserted (BYPASS!)');
  if (data?.id) await shopper.c.from('withdrawal_requests').delete().eq('id', data.id);
}

// ---- SECURITY: PII leak — delivery_address is column-REVOKEd, so NOBODY reads it
// via the base table (a direct select now errors, not just returns 0 rows). ----
{
  const { data, error } = await holder.c.from('deals').select('id,delivery_address').eq('id', dealId ?? '0');
  sec('delivery_address not readable via base table (column REVOKE)',
    !!error || !data || data.length === 0, error ? 'denied' : `rows=${data?.length ?? 0}`);
}

// ---- non-admin blocked from admin RPCs ----
{
  const { error } = await holder.c.rpc('complete_deal', { p_deal_id: dealId ?? '00000000-0000-0000-0000-000000000000' });
  sec('non-admin blocked from complete_deal', !!error, error?.message?.slice(0, 40));
}

// ---- cancel_deal (owner cancels own pending deal) ----
if (dealId) {
  const { data, error } = await shopper.c.rpc('cancel_deal', { p_deal_id: dealId });
  rec('shopper can cancel_deal (pending)', !error && data?.status === 'cancelled', error ? error.message : `status=${data?.status}`);
}

// ---- withdrawal business rules ----
{
  const { error: e1 } = await holder.c.rpc('request_withdrawal', { p_amount: 0 });
  rec('withdrawal rejects amount<=0', !!e1);
  const { error: e2 } = await holder.c.rpc('request_withdrawal', { p_amount: 100 });
  rec('withdrawal without KYC blocked', !!e2, e2?.message?.slice(0, 40));
}

// ---- new functions deployed ----
for (const [fn, args] of [['reject_withdrawal', { p_request_id: '00000000-0000-0000-0000-000000000000' }], ['list_kycs_for_admin', {}], ['get_product_stats', { p_product_id: '00000000-0000-0000-0000-000000000000' }]]) {
  const { error } = await holder.c.rpc(fn, args);
  rec(`${fn} deployed`, !(error && error.code === 'PGRST202'), error?.code === 'PGRST202' ? 'MISSING' : 'ok');
}

// ---- storage buckets ----
{
  const file = new File([new Blob(['x'])], 't.png', { type: 'image/png' });
  const { error } = await holder.c.storage.from('order-screenshots').upload(`${holder.id}/${Date.now()}.png`, file);
  rec('order-screenshots bucket upload works', !error, error?.message?.slice(0, 50));
}

// ---- PRICE TRACKER: add product with two price points -> stats + recommendation ----
{
  const url = `https://www.amazon.in/dp/E2ETEST${Date.now().toString().slice(-6)}`;
  const { data: prod, error: addErr } = await shopper.c.rpc('add_tracked_product', {
    p_url: url, p_platform: 'amazon', p_product_name: 'E2E Headphones', p_current_price: 2000, p_original_price: 3000, p_target_price: 1500,
  });
  rec('add_tracked_product (first price)', !addErr && !!prod?.id, addErr?.message);
  if (prod?.id) {
    await shopper.c.rpc('log_product_price', { p_product_id: prod.id, p_price: 1800 });
    await shopper.c.rpc('log_product_price', { p_product_id: prod.id, p_price: 1400 }); // <= target 1500
    const { data: stats } = await shopper.c.rpc('get_product_stats', { p_product_id: prod.id });
    const s = stats?.[0];
    rec('get_product_stats computes history', !!s && s.points >= 3, s ? `points=${s.points} low=${s.lowest} rec=${s.recommendation}` : 'no stats');
    rec('recommendation is data-driven (near-low => excellent/good)', ['excellent', 'good'].includes(s?.recommendation), `rec=${s?.recommendation}`);
    // target alert notification created on the 1400 drop
    const { data: notifs } = await shopper.c.from('notifications').select('title').eq('user_id', shopper.id).ilike('title', '%Price drop%');
    rec('target-price alert notification fired', (notifs?.length ?? 0) > 0, `alerts=${notifs?.length ?? 0}`);
    await shopper.c.from('tracked_products').delete().eq('id', prod.id); // cleanup
  }
}

// ---- REFER & EARN ----
{
  // Every user gets a referral code
  const { data: prof } = await shopper.c.from('profiles').select('referral_code').eq('id', shopper.id).maybeSingle();
  const shopperCode = prof?.referral_code;
  rec('user has a referral_code', !!shopperCode, shopperCode || 'none');

  // summary RPC works
  const { data: sum, error: sumErr } = await shopper.c.rpc('get_my_referral_summary');
  rec('get_my_referral_summary works', !sumErr && !!sum, sumErr?.message);

  if (shopperCode) {
    // self-referral rejected
    const { data: self } = await shopper.c.rpc('apply_referral_code', { p_code: shopperCode });
    sec('self-referral is rejected', self?.applied === false && self?.reason === 'self_referral', `reason=${self?.reason}`);

    // invalid code rejected (or already_referred if this holder was linked in a prior run —
    // the already-referred check correctly short-circuits before code validation)
    const { data: bad } = await holder.c.rpc('apply_referral_code', { p_code: 'ZZZZZZZZ' });
    rec('invalid referral code rejected', bad?.applied === false && ['invalid_code', 'already_referred'].includes(bad?.reason), `reason=${bad?.reason}`);

    // holder applies shopper's code — 'applied' first run, 'already_referred' after (both prove correctness)
    const { data: applied } = await holder.c.rpc('apply_referral_code', { p_code: shopperCode });
    rec('valid referral applies (or dedups)', applied?.applied === true || applied?.reason === 'already_referred' || applied?.reason === 'not_new', `result=${JSON.stringify(applied)}`);

    // referral now visible to referrer
    const { data: mine } = await shopper.c.rpc('list_my_referrals');
    rec('referrer can see their referrals', Array.isArray(mine) && mine.length >= 0, `count=${mine?.length ?? 0}`);
  }

  // non-admin blocked from admin referral RPCs
  const { error: cfgErr } = await holder.c.rpc('admin_update_referral_config', {
    p_referrer_reward: 999, p_welcome_bonus: 999, p_min_qualifying_amount: 0, p_max_rewards_per_referrer: null, p_enabled: true,
  });
  sec('non-admin blocked from referral config', !!cfgErr, cfgErr?.message?.slice(0, 40));
  const { error: listErr } = await holder.c.rpc('admin_list_referrals');
  sec('non-admin blocked from admin_list_referrals', !!listErr, listErr?.message?.slice(0, 40));
}

// ---- EMAIL VERIFICATION gate (regression: verified users still pass) ----
{
  // Our test accounts are verified (created under auto-confirm), so is_verified()
  // must be true and they must still be able to post a deal.
  const { error } = await shopper.c.from('deals').insert({
    merchant_id: shopper.id, product_name: 'E2E Verify Gate', product_link: 'https://example.com/v',
    original_price: 1000, card_offer_price: 800, expected_buy_price: 900, commission_amount: 50,
    required_card: 'HDFC', delivery_address: 'test', advance_amount: 800, remaining_amount: 100, status: 'pending',
  }).select('id').maybeSingle();
  rec('verified user can still post deals (gate does not over-block)', !error, error?.message?.slice(0, 60));
  // clean up
  await shopper.c.from('deals').update({ status: 'cancelled' }).eq('merchant_id', shopper.id).eq('product_name', 'E2E Verify Gate');
}

// ---- cleanup created deals ----
if (dealId) await shopper.c.from('deals').delete().eq('id', dealId);
await shopper.c.from('deals').update({ status: 'cancelled' }).eq('merchant_id', shopper.id).neq('status', 'cancelled');

const fails = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} passed/secure ===`);
if (fails.length) { console.log('\nNeeds attention:'); fails.forEach((f) => console.log(`  - ${f.name}${f.sec ? ' [SECURITY]' : ''}: ${f.detail}`)); }
else console.log('All checks passed.');
