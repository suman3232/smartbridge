// Genuine Resend delivery test — sends a REAL branded OfferBridge email through
// the Resend API, mirroring what the email-dispatch Edge Function renders/sends.
// The API key is read from the environment; it is NEVER written to a file or Git.
//
//   RESEND_API_KEY=re_xxx node scripts/resend-live-test.mjs [recipient@example.com]
//
// With no verified domain (test sender onboarding@resend.dev) Resend restricts
// real sends to your own account email; the special sink delivered@resend.dev
// always accepts. This script tries the given/sink recipient and reports the
// exact provider response (message id on success, the restriction on failure).
const KEY = process.env.RESEND_API_KEY;
if (!KEY) { console.error('Set RESEND_API_KEY in the environment.'); process.exit(2); }
const FROM = process.env.EMAIL_FROM ?? 'OfferBridge <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL ?? 'https://smartbridge-gold.vercel.app';
const to = process.argv[2] ?? 'delivered@resend.dev';

// Same escaping + template shape the Edge Function uses.
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\//g, '&#x2F;');
const subject = 'OfferBridge — your order is verified, please pay ₹1,499';
const body = 'Good news! An admin verified the order proof for "Sony WH-1000XM5 Headphones".\n\nPlease pay ₹1,499 to proceed. Your delivery OTP is released only after payment is verified.';
const ctaUrl = APP_URL.replace(/\/$/, '') + '/deals/demo';
const paras = body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr><td style="padding:20px 32px;background:#4f46e5;"><span style="font-size:20px;font-weight:800;color:#fff;">OfferBridge</span></td></tr>
      <tr><td style="padding:32px;"><h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${esc(subject)}</h1>${paras}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:8px;background:#4f46e5;">
          <a href="${esc(ctaUrl)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px;">View details</a></td></tr></table></td></tr>
      <tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#9ca3af;">Transactional notification about your OfferBridge order — separate from account security emails.</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
const text = body + '\n\n' + ctaUrl + '\n\n— OfferBridge';

console.log(`\n=== Resend live test → ${to} (from ${FROM}) ===`);
const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `livetest-${Date.now()}` },
  body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
});
const bodyJson = await res.json().catch(() => ({}));
console.log('HTTP', res.status);
console.log(JSON.stringify(bodyJson, null, 2));
if (res.ok && bodyJson.id) {
  console.log(`\n✅ PASS — Resend accepted the email. message id: ${bodyJson.id}`);
  process.exit(0);
} else {
  console.log(`\n❌ Resend did not accept it. If this names an allowed address, re-run with that address as the argument.`);
  process.exit(1);
}
