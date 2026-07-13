// Business-model pricing E2E. Run AFTER applying supabase/setup.sql.
//   node scripts/pricing-e2e.mjs                                # anon security probes
//   E2E_SERVICE_ROLE_KEY=eyJ... node scripts/pricing-e2e.mjs    # + fee/payable/payout/tamper suite
//
// Verifies the server-side pricing authority:
//   fee     = clamp(reward × 20%, ₹20, ₹500)   (from platform_fee_config)
//   payable = actual(∨ posted price-after-offer) + reward + fee
//   payout  = actual(∨ posted price-after-offer) + reward
//   legacy  (service_fee IS NULL) → payable = expected_buy_price, payout = card_offer + reward
// and that a client can NEVER set its own service fee (trigger overrides).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const mk = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const out = [];
const rec = (n, p, d = '') => { out.push({ n, p }); console.log(`${p === null ? 'INFO ' : p ? 'PASS ' : 'FAIL '} ${n}${d ? ' — ' + d : ''}`); };
const sec = (n, s, d = '') => { out.push({ n, p: s }); console.log(`${s ? 'SECURE' : '⚠VULN '} ${n}${d ? ' — ' + d : ''}`); };

console.log(`\n=== OfferBridge pricing E2E — ${env.VITE_SUPABASE_URL} ===\n`);

// Deployment check
{
  const { data, error } = await mk().from('platform_fee_config').select('fee_percent').limit(1);
  if (error && /does not exist|schema cache/i.test(error.message)) {
    console.log('NOT DEPLOYED — apply the latest supabase/setup.sql, then re-run.'); process.exit(1);
  }
  rec('pricing schema deployed (platform_fee_config exists)', !error, error?.message);
  // anon (no session) must not read the fee policy (RLS: authenticated only)
  sec('anon cannot read fee policy (RLS)', (data ?? []).length === 0);
}

{
  const anon = mk();
  const upd = await anon.from('platform_fee_config').update({ fee_percent: 0 }).eq('id', true).select();
  sec('anon cannot change the fee policy', !!upd.error || (upd.data ?? []).length === 0);
  const rev = await anon.from('platform_revenue').select('amount').limit(1);
  sec('anon cannot read platform revenue', ((rev.data ?? []).length === 0));
  const rpc = await anon.rpc('buyer_respond_price_revision', { p_deal_id: '00000000-0000-0000-0000-000000000000', p_accept: true });
  sec('anon blocked: buyer_respond_price_revision', !!rpc.error);
  const q = await anon.rpc('get_deal_payment_quote', { p_deal_id: '00000000-0000-0000-0000-000000000000' });
  sec('anon blocked: get_deal_payment_quote (service-role only)', !!q.error);
  // Column-level REVOKE: selecting service_fee directly must error for clients.
  const sf = await anon.from('deals').select('id, service_fee').limit(1);
  sec('service_fee column not client-selectable (REVOKEd)', !!sf.error);
}

const SRK = process.env.E2E_SERVICE_ROLE_KEY;
if (!SRK) {
  console.log('\nFee/payable/tamper suite SKIPPED — set E2E_SERVICE_ROLE_KEY to run it.');
} else {
  const svc = createClient(env.VITE_SUPABASE_URL, SRK, { auth: { persistSession: false, autoRefreshToken: false } });
  const TAG = `pricing-e2e-${Date.now()}`;
  const made = [];
  try {
    const prof = await svc.from('profiles').select('id').limit(1).maybeSingle();
    if (!prof.data) { rec('service suite', null, 'skipped — no profiles exist yet'); }
    else {
      const uid = prof.data.id;
      const mkDeal = async (over = {}) => {
        const { data, error } = await svc.from('deals').insert({
          merchant_id: uid, product_name: TAG, product_link: 'https://example.com/p',
          original_price: 50000, card_offer_price: 45000, commission_amount: 1000,
          required_card: 'HDFC', status: 'pending', delivery_address: 'x', ...over,
        }).select('id').single();
        if (error) throw new Error(error.message);
        made.push(data.id);
        // service_fee is column-REVOKEd for clients but service role reads it fine
        const row = await svc.from('deals').select('service_fee, expected_buy_price, card_offer_price, commission_amount, actual_purchase_price, price_revision_status').eq('id', data.id).single();
        return { id: data.id, ...row.data };
      };

      // ---- fee boundary tests: clamp(reward×20%, 20, 500), whole rupees ----
      const cases = [
        [0, 20, 'reward 0 → min fee 20'],
        [100, 20, 'reward 100 → 20% = 20 (at min boundary)'],
        [1000, 200, 'reward 1000 → 20% = 200'],
        [2500, 500, 'reward 2500 → 20% = 500 (at max boundary)'],
        [10000, 500, 'reward 10000 → capped at max 500'],
      ];
      for (const [reward, want, label] of cases) {
        const d = await mkDeal({ commission_amount: reward });
        rec(`fee boundary: ${label}`, Number(d.service_fee) === want, `stored=${d.service_fee}`);
      }

      // ---- tamper: client-sent service_fee/expected_buy_price are overridden ----
      const t1 = await mkDeal({ service_fee: 0.01 });
      sec('forged service_fee overridden by the pricing trigger', Number(t1.service_fee) === 200, `stored=${t1.service_fee}`);
      const t2 = await mkDeal({ actual_purchase_price: 1, price_revision_status: 'accepted' });
      sec('forged actual_purchase_price / revision status reset at insert',
        t2.actual_purchase_price === null && t2.price_revision_status === 'none');

      // ---- CRITICAL: a buyer must NOT be able to insert a deal that is already
      // 'paid'/'confirmed' and skip payment. The pricing trigger resets EVERY
      // server-owned lifecycle column to its default. ----
      const { data: forged, error: fErr } = await svc.from('deals').insert({
        merchant_id: uid, product_name: TAG, product_link: 'https://example.com/p',
        original_price: 50000, card_offer_price: 45000, commission_amount: 1000,
        required_card: 'HDFC', delivery_address: 'x',
        status: 'completed', payment_status: 'verified', order_proof_status: 'verified',
        buyer_confirmed_at: new Date().toISOString(), payment_method: 'razorpay', settled_at: new Date().toISOString(),
      }).select('id, status, payment_status, order_proof_status, buyer_confirmed_at, payment_method, settled_at').single();
      if (!fErr && forged) {
        made.push(forged.id);
        sec('forged payment_status=verified reset to not_due at insert (no free goods)',
          forged.payment_status === 'not_due', `stored=${forged.payment_status}`);
        sec('forged order_proof_status/buyer_confirmed_at/settled_at all reset',
          forged.order_proof_status === 'pending' && forged.buyer_confirmed_at === null
          && forged.payment_method === null && forged.settled_at === null && forged.status === 'pending');
      } else {
        rec('critical lifecycle-tamper insert', false, fErr?.message);
      }

      // ---- payable: quote = (posted + reward + fee) × 100 paise while actual unset ----
      const d1 = await mkDeal({ commission_amount: 1000 }); // fee 200
      const q1 = await svc.rpc('get_deal_payment_quote', { p_deal_id: d1.id });
      const quote1 = q1.data?.[0];
      rec('buyer payable = posted 45000 + reward 1000 + fee 200 = 46200 (paise exact)',
        Number(quote1?.amount_paise) === 46200 * 100 && Number(quote1?.payable) === 46200,
        `amount_paise=${quote1?.amount_paise}`);

      // ---- actual price flows into payable + payout ----
      await svc.from('deals').update({ actual_purchase_price: 44000 }).eq('id', d1.id);
      const q2 = await svc.rpc('get_deal_payment_quote', { p_deal_id: d1.id });
      rec('payable recomputes from ACTUAL verified amount (44000+1000+200)',
        Number(q2.data?.[0]?.amount_paise) === 45200 * 100, `amount_paise=${q2.data?.[0]?.amount_paise}`);

      // ---- legacy fallback: service_fee NULL → payable = expected_buy_price ----
      const dl = await mkDeal({});
      await svc.from('deals').update({ service_fee: null, expected_buy_price: 46000 }).eq('id', dl.id);
      const q3 = await svc.rpc('get_deal_payment_quote', { p_deal_id: dl.id });
      rec('LEGACY deal (no fee): payable falls back to expected_buy_price',
        Number(q3.data?.[0]?.amount_paise) === 46000 * 100, `amount_paise=${q3.data?.[0]?.amount_paise}`);

      // ---- gateway amount integrity: wrong paise rejected against the new formula ----
      // Make the deal payable-eligible so the probe genuinely reaches the AMOUNT guard.
      await svc.from('deals').update({ order_proof_status: 'verified' }).eq('id', d1.id);
      const g1 = await svc.rpc('gateway_record_razorpay_order', {
        p_deal_id: d1.id, p_razorpay_order_id: `order_${TAG}`, p_amount_paise: 46200 * 100, // stale pre-actual amount
        p_currency: 'INR', p_created_by: uid,
      });
      sec('gateway rejects a stale/wrong amount after actual-price reconciliation',
        !!g1.error && /mismatch/i.test(g1.error.message), g1.error?.message?.slice(0, 60));
      const g2 = await svc.rpc('gateway_record_razorpay_order', {
        p_deal_id: d1.id, p_razorpay_order_id: `order_${TAG}b`, p_amount_paise: 45200 * 100,
        p_currency: 'USD', p_created_by: uid,
      });
      sec('gateway rejects wrong currency', !!g2.error && /INR/i.test(g2.error.message));
      const g3 = await svc.rpc('gateway_record_razorpay_order', {
        p_deal_id: d1.id, p_razorpay_order_id: `order_${TAG}c`, p_amount_paise: 45200 * 100,
        p_currency: 'INR', p_created_by: uid,
      });
      rec('gateway accepts the CORRECT reconciled amount (45200×100 paise)', !g3.error, g3.error?.message);
    }
  } catch (e) {
    rec('pricing service suite', false, e.message);
  } finally {
    if (made.length) await svc.from('deals').delete().in('id', made);
    rec('cleaned up test deals', true, `${made.length} rows`);
  }
}

const fails = out.filter((o) => o.p === false).length;
console.log(`\n${fails ? `❌ ${fails} check(s) failed` : '✅ all checks passed'} (${out.length} total)\n`);
process.exit(fails ? 1 : 0);
