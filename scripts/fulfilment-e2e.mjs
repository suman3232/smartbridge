// Order-fulfilment + privacy + payment-gate + settlement E2E. Run AFTER applying
// supabase/setup.sql. Needs "Confirm email" OFF (test accounts need sessions).
//   node scripts/fulfilment-e2e.mjs                         # anon security probes
//   E2E_ADMIN_EMAIL=.. E2E_ADMIN_PASSWORD=.. node scripts/fulfilment-e2e.mjs   # full flow
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const mk = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const RUN = Date.now(), PW = `Ful-${RUN}-Aa1!`, out = [];
const rec = (n, p, d = '') => { out.push({ n, p }); console.log(`${p === null ? 'INFO ' : p ? 'PASS ' : 'FAIL '} ${n}${d ? ' — ' + d : ''}`); };
const sec = (n, s, d = '') => { out.push({ n, p: s }); console.log(`${s ? 'SECURE' : '⚠VULN '} ${n}${d ? ' — ' + d : ''}`); };
const BUYER_PHONE = `+91 90000 ${String(RUN).slice(-5)}`;

async function account(tag, phone) {
  const c = mk();
  const email = `ful-${RUN}-${tag}@smartdealtest.com`;
  const r = await c.auth.signUp({ email, password: PW, options: { data: { full_name: `Ful ${tag}`, preferred_role: 'both', phone } } });
  if (r.error) throw new Error(`${tag}: ${r.error.message}`);
  if (!r.data.session) throw new Error(`${tag}: no session — turn OFF Confirm email for E2E`);
  // ensure phone persisted (client backfill mirror)
  if (phone) await c.from('profiles').update({ phone }).eq('id', r.data.user.id);
  return { c, id: r.data.user.id, email };
}

console.log(`\n=== OfferBridge fulfilment E2E — ${env.VITE_SUPABASE_URL} ===\n`);
{
  const { error } = await mk().rpc('recompute_payment_states');
  if (error && (error.code === 'PGRST202' || /schema cache|could not find/i.test(error.message))) {
    console.log('NOT DEPLOYED — apply the latest supabase/setup.sql, then re-run.'); process.exit(1);
  }
  rec('fulfilment RPCs deployed', !error, error?.message);
}

let buyer, holder;
try { buyer = await account('buyer', BUYER_PHONE); holder = await account('holder', `+91 88888 ${String(RUN).slice(-5)}`); rec('created buyer + card holder', true); }
catch (e) { rec('create accounts', false, e.message); process.exit(1); }

// ---- Unauthorized RPC probes (no admin needed) ----
const rid = crypto.randomUUID();
sec('non-admin blocked: admin_order_search (would expose buyer phones)', !!(await holder.c.rpc('admin_order_search', { p_query: 'x' })).error);
sec('non-admin blocked: admin_verify_payment', !!(await holder.c.rpc('admin_verify_payment', { p_deal_id: rid, p_approve: true })).error);
sec('non-admin blocked: admin_resolve_dispute', !!(await holder.c.rpc('admin_resolve_dispute', { p_deal_id: rid, p_resolution: 'resolved' })).error);
sec('internal helper not client-callable: notify_and_email', !!(await holder.c.rpc('notify_and_email', { p_user_id: holder.id, p_title: 'x', p_message: 'x', p_type: 'info', p_link: '/', p_dedup_key: null, p_email_subject: null, p_email_body: null })).error);
sec('internal helper not client-callable: log_order_event', !!(await holder.c.rpc('log_order_event', { p_deal_id: rid, p_actor: holder.id, p_event_type: 'x' })).error);
sec('delivery_codes table not directly selectable', ((await holder.c.from('delivery_codes').select('code_value').limit(1)).data ?? []).length === 0);

// Anon fail-open probes: unauthenticated calls must be rejected (auth.uid()=NULL
// must not slip past ownership/payment checks — the class of bug the review found).
{
  const anon = mk();
  sec('anon blocked: get_delivery_code (no plaintext OTP disclosure)', !!(await anon.rpc('get_delivery_code', { p_deal_id: rid })).error);
  sec('anon blocked: buyer_confirm_receipt (cannot forge receipt)', !!(await anon.rpc('buyer_confirm_receipt', { p_deal_id: rid })).error);
  sec('anon blocked: set_delivery_code (cannot plant a code)', !!(await anon.rpc('set_delivery_code', { p_deal_id: rid, p_code_type: 'otp', p_code_value: '000000' })).error);
  sec('anon blocked: raise_dispute (cannot DoS settlement)', !!(await anon.rpc('raise_dispute', { p_deal_id: rid, p_reason: 'x' })).error);
  sec('anon blocked: submit_buyer_payment (cannot forge payment)', !!(await anon.rpc('submit_buyer_payment', { p_deal_id: rid, p_reference: 'x' })).error);
  sec('anon blocked: get_order_delivery_details', !!(await anon.rpc('get_order_delivery_details', { p_deal_id: rid })).error);
}

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL, ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.log('\nFull-flow suite SKIPPED — set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to run it.');
} else {
  const admin = mk();
  const a = await admin.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (a.error) { rec('admin sign-in', false, a.error.message); process.exit(1); }
  rec('admin sign-in', true);

  // Ensure a support number is configured (privacy requirement).
  await admin.rpc('admin_update_support_number', { p_number: '+91 99999 88888' });

  // Buyer posts a structured deal (phone is private in profile, NOT in address).
  const { data: dealRow, error: derr } = await buyer.c.from('deals').insert({
    merchant_id: buyer.id, product_name: `Ful E2E ${RUN}`, product_link: 'https://example.com/p',
    original_price: 1000, card_offer_price: 800, expected_buy_price: 900, commission_amount: 50, required_card: 'HDFC',
    recipient_name: 'Test Recipient', address_line: '12 Test Lane', city: 'Pune', state: 'MH', pincode: '411001',
    delivery_address: 'Test Recipient\n12 Test Lane\nPune, MH 411001', advance_amount: 800, remaining_amount: 100, status: 'pending',
  }).select("id").single();
  if (derr) { rec('buyer posts structured deal', false, derr.message); process.exit(1); }
  const D = dealRow.id;
  rec('buyer posts structured deal', true);
  await admin.rpc('approve_deal', { deal_id: D });
  await holder.c.rpc('accept_deal', { p_deal_id: D });
  rec('card holder reserved the deal', true);

  // ---- PRIVACY: buyer phone must be unreachable by the card holder ----
  {
    const dv = await holder.c.rpc('get_deal_for_viewer', { p_deal_id: D });
    const blob = JSON.stringify(dv.data ?? []);
    sec('card holder: get_deal_for_viewer contains NO buyer phone', !blob.includes(BUYER_PHONE.replace(/\D/g, '').slice(-5)) && !/"phone"/.test(blob), 'no phone field / value');
    const dd = await holder.c.rpc('get_order_delivery_details', { p_deal_id: D });
    const ddStr = JSON.stringify(dd.data ?? []);
    sec('card holder: delivery details show support number, NOT buyer phone',
      !!dd.data?.[0]?.offerbridge_contact && !ddStr.includes(BUYER_PHONE.replace(/\D/g, '').slice(-5)),
      `contact=${dd.data?.[0]?.offerbridge_contact}`);
    const prof = await holder.c.from('profiles').select('phone').eq('id', buyer.id).maybeSingle();
    sec('card holder: direct profiles read of buyer returns no row (RLS)', !prof.data);
    // THE critical one: a direct base-table read of the PII columns must be denied
    // (column-level REVOKE), not just masked inside RPCs.
    const raw = await holder.c.from('deals').select('delivery_address, address_line, city, delivery_instructions, payment_reference').eq('id', D);
    sec('card holder: direct deals PII columns are REVOKED (not just RPC-masked)',
      !!raw.error && /permission denied|column/i.test(raw.error.message), raw.error?.message ?? `LEAKED ${JSON.stringify(raw.data)}`);
    const safe = await holder.c.from('deals').select('id, product_name, status, payment_status').eq('id', D).maybeSingle();
    rec('card holder: safe deal columns still readable directly', !safe.error && !!safe.data?.id, safe.error?.message);
  }

  // ---- ORDER PROOF: mandatory fields ----
  {
    const noShot = await holder.c.rpc('place_deal_order', { p_deal_id: D, p_marketplace_order_id: 'X1', p_estimated_delivery_date: '2099-01-01' });
    rec('order rejected without screenshot', !!noShot.error && /screenshot/i.test(noShot.error.message));
    const noId = await holder.c.rpc('place_deal_order', { p_deal_id: D, p_order_screenshot_url: 'shot/x.png', p_estimated_delivery_date: '2099-01-01' });
    rec('order rejected without order ID', !!noId.error && /order id/i.test(noId.error.message));
    const noEdd = await holder.c.rpc('place_deal_order', { p_deal_id: D, p_order_screenshot_url: 'shot/x.png', p_marketplace_order_id: 'X1' });
    rec('order rejected without estimated delivery date', !!noEdd.error && /delivery date/i.test(noEdd.error.message));
  }

  // Place a valid order (delivery tomorrow → payment due today).
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  {
    const ok = await holder.c.rpc('place_deal_order', {
      p_deal_id: D, p_order_screenshot_url: `${holder.id}/shot.png`, p_marketplace_order_id: `OID-${RUN}`,
      p_estimated_delivery_date: tomorrow, p_delivery_code_type: 'otp',
    });
    rec('valid order placed (screenshot + order id + edd)', !ok.error, ok.error?.message);
    const dv = (await buyer.c.rpc('get_deal_for_viewer', { p_deal_id: D })).data?.[0];
    rec('payment due date = delivery − 1 day', dv?.payment_due_date === new Date(Date.now()).toISOString().slice(0, 10), `due=${dv?.payment_due_date}`);
  }

  // Card holder sets the delivery OTP.
  await holder.c.rpc('set_delivery_code', { p_deal_id: D, p_code_type: 'otp', p_code_value: '481516' });

  // ---- PAYMENT GATE on the delivery code ----
  {
    const before = await buyer.c.rpc('get_delivery_code', { p_deal_id: D });
    sec('buyer CANNOT read delivery code before payment verified', !!before.error && /payment/i.test(before.error.message), before.error?.message);
    const holderView = await holder.c.rpc('get_delivery_code', { p_deal_id: D });
    rec('card holder (who set it) can read the code', !holderView.error && holderView.data?.[0]?.code_value === '481516');
  }

  // Buyer pays; admin verifies; now the buyer can read it.
  await buyer.c.rpc('submit_buyer_payment', { p_deal_id: D, p_reference: `UTR-${RUN}` });
  {
    const stillLocked = await buyer.c.rpc('get_delivery_code', { p_deal_id: D });
    sec('buyer STILL locked while payment only submitted (not verified)', !!stillLocked.error);
  }
  await admin.rpc('admin_verify_payment', { p_deal_id: D, p_approve: true });
  {
    const now = await buyer.c.rpc('get_delivery_code', { p_deal_id: D });
    rec('buyer CAN read delivery code AFTER payment verified', !now.error && now.data?.[0]?.code_value === '481516', now.error?.message);
  }

  // ---- SETTLEMENT gates + idempotency ----
  {
    const early = await admin.rpc('complete_deal', { p_deal_id: D });
    rec('settlement blocked before buyer confirms receipt', !!early.error && /confirm/i.test(early.error.message), early.error?.message);
    await buyer.c.rpc('buyer_confirm_receipt', { p_deal_id: D });
    const balBefore = (await holder.c.from('wallets').select('balance').eq('user_id', holder.id).single()).data?.balance ?? 0;
    const [s1, s2] = await Promise.all([admin.rpc('complete_deal', { p_deal_id: D }), admin.rpc('complete_deal', { p_deal_id: D })]);
    const wins = [s1, s2].filter((r) => !r.error).length;
    const balAfter = (await holder.c.from('wallets').select('balance').eq('user_id', holder.id).single()).data?.balance ?? 0;
    rec('concurrent double settle: credited EXACTLY once (850)', Number(balAfter) - Number(balBefore) === 850 && wins >= 1, `Δ=${Number(balAfter) - Number(balBefore)}, winners=${wins}`);
    const codeAfter = await buyer.c.rpc('get_delivery_code', { p_deal_id: D });
    sec('delivery code scrubbed after receipt confirmed', !!codeAfter.error, codeAfter.error?.message);
  }

  // Idempotent reminders: two sweeps don't double-notify.
  {
    const n1 = (await buyer.c.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', buyer.id)).count ?? 0;
    await mk().rpc('recompute_payment_states'); await mk().rpc('recompute_payment_states');
    const n2 = (await buyer.c.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', buyer.id)).count ?? 0;
    rec('idempotent reminders: repeated sweeps add no duplicate notifications', n2 === n1, `before=${n1} after=${n2}`);
  }

  await admin.rpc('admin_update_support_number', { p_number: '9733722957' }); // restore
}

const failed = out.filter((r) => r.p === false);
console.log(`\n=== ${out.filter((r) => r.p === true).length} pass · ${failed.length} fail · ${out.filter((r) => r.p === null).length} info ===`);
if (failed.length) { failed.forEach((f) => console.log('FAILED: ' + f.n)); process.exit(1); }
