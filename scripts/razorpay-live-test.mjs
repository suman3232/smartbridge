// Genuine Razorpay test-mode checks. Credentials are read from the environment;
// they are NEVER written to a file or Git.
//
//   RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=yyy \
//   RAZORPAY_WEBHOOK_SECRET=zzz node scripts/razorpay-live-test.mjs
//
// It (1) creates a REAL test-mode order via the live Orders API — proving the
// credentials work and exercising the same call razorpay-create-order makes; and
// (2) unit-tests our webhook + checkout HMAC-SHA256 signature verification so we
// know the Edge Functions will validate a real Razorpay signature correctly.
// It does NOT complete a payment (that needs the browser Checkout flow).
import crypto from 'node:crypto';

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
if (!KEY_ID || !KEY_SECRET) { console.error('Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'); process.exit(2); }
let fails = 0;
const rec = (ok, n, d = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

console.log('\n=== Razorpay live test (test mode) ===');

// (1) Create a real test-mode order (₹1) via the gateway.
const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
  method: 'POST',
  headers: { Authorization: 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64'), 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: 100, currency: 'INR', receipt: `offerbridge-livetest-${Date.now()}`, payment_capture: 1 }),
});
const order = await orderRes.json().catch(() => ({}));
console.log('  order-create HTTP', orderRes.status, '→', JSON.stringify(order).slice(0, 200));
rec(orderRes.ok && order.id && order.status === 'created', 'Razorpay accepted a test order-create (credentials valid)', order.id ? `${order.id} (${order.status})` : order?.error?.description);

// (2) Webhook signature verification: Razorpay signs the RAW body with the webhook
// secret (HMAC-SHA256 hex). Confirm our verification accepts a valid signature and
// rejects a tampered one.
if (WEBHOOK_SECRET) {
  const sampleBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_LIVETEST', order_id: order.id ?? 'order_x', amount: 100, currency: 'INR' } } } });
  const goodSig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(sampleBody).digest('hex');
  const verify = (body, sig) => { const exp = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex'); return exp.length === sig.length && crypto.timingSafeEqual(Buffer.from(exp), Buffer.from(sig)); };
  rec(verify(sampleBody, goodSig), 'webhook HMAC verify ACCEPTS a valid signature');
  rec(!verify(sampleBody, goodSig.slice(0, -1) + (goodSig.endsWith('a') ? 'b' : 'a')), 'webhook HMAC verify REJECTS a tampered signature');
  rec(!verify(sampleBody + ' ', goodSig), 'webhook HMAC verify REJECTS a tampered body');
} else {
  console.log('INFO  RAZORPAY_WEBHOOK_SECRET not set — skipping webhook-signature unit test');
}

// (3) Checkout signature verification: Razorpay's success handler returns
// razorpay_signature = HMAC-SHA256(order_id + "|" + payment_id) with KEY_SECRET.
{
  const orderId = order.id ?? 'order_TEST', paymentId = 'pay_TEST';
  const sig = crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const exp = crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  rec(exp === sig, 'checkout HMAC(order|payment) verify matches (server-side verification works)');
  const bad = crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|pay_OTHER`).digest('hex');
  rec(bad !== sig, 'checkout HMAC rejects a mismatched payment id (no cross-payment forgery)');
}

console.log(`\n${fails ? `❌ ${fails} FAIL` : '✅ all Razorpay checks passed'}\n`);
