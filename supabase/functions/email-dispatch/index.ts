// Supabase Edge Function: email-dispatch
// ---------------------------------------------------------------------------
// Drains public.email_outbox and delivers each queued transactional email via
// Resend. This is the ONLY place OfferBridge application email is actually sent.
// It is completely SEPARATE from Supabase's native auth email (signup OTP /
// password reset) — a bug here can never affect auth deliverability.
//
// Safety model (why an email is delivered exactly once):
//   1. claim_email_batch leases rows with FOR UPDATE SKIP LOCKED + a flip to
//      'processing' in one statement — two workers never grab the same row.
//   2. attempts is bumped AT CLAIM, so a crashed worker still burns an attempt.
//   3. The Resend "Idempotency-Key: outbox-<id>" is STABLE across retries, so if
//      a worker dies after Resend accepted but before mark_email_sent, the
//      reclaim re-POST returns the original id instead of sending a second mail.
//   4. mark_email_sent / mark_email_failed are guarded on (status='processing'
//      AND locked_by=worker), so a stale reclaimed worker can't clobber state.
//
// Trigger:  pg_cron (every minute) -> pg_net -> this function (see
//           supabase/cron/schedule-email-dispatch.sql). Overlapping ticks are
//           harmless (SKIP LOCKED). An admin may also invoke it to flush now.
//
// Deploy:   supabase functions deploy email-dispatch --no-verify-jwt
//           (--no-verify-jwt: the caller is pg_cron/Resend-less; auth is the
//            x-cron-secret shared secret, not a Supabase user JWT.)
// Secrets:  supabase secrets set RESEND_API_KEY=re_xxx
//           supabase secrets set CRON_SECRET=<random-32-bytes>
//           supabase secrets set EMAIL_FROM="OfferBridge <no-reply@your-domain>"   (optional)
//           supabase secrets set APP_URL="https://smartbridge-gold.vercel.app"     (optional)
//           SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// ---------------------------------------------------------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Constant-time compare so the cron secret can't be recovered by timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// ---- template rendering (all HTML built here; DB stores only plain text) ----
function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\//g, "&#x2F;");
}

// Only same-origin relative paths become a CTA. Rejects absolute URLs,
// protocol-relative '//evil', and 'javascript:' etc. — no open redirect / href
// injection even if a stored link were ever tampered with.
function safeAbsoluteUrl(appUrl: string, link: string | null): string | null {
  if (!link || typeof link !== "string") return null;
  if (!/^\/(?!\/)[^\s]*$/.test(link)) return null; // must start with a single '/'
  if (link.includes(":")) return null;             // no scheme sneaking in
  return appUrl.replace(/\/$/, "") + link;
}

const ACCENTS: Record<string, string> = {
  info: "#4f46e5", success: "#059669", warning: "#d97706", error: "#dc2626",
};

function renderEmail(opts: { subject: string; body: string; ctaUrl: string | null; category: string | null }) {
  const accent = ACCENTS[opts.category ?? "info"] ?? ACCENTS.info;
  const safeSubject = escapeHtml(opts.subject);
  const paragraphs = String(opts.body ?? "")
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const cta = opts.ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:8px;background:${accent};">
         <a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">View details</a>
       </td></tr></table>`
    : "";

  const preheader = escapeHtml(String(opts.body ?? "").replace(/\s+/g, " ").slice(0, 120));

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeSubject}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="padding:20px 32px;background:${accent};">
          <span style="font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#ffffff;">OfferBridge</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#111827;">${safeSubject}</h1>
          ${paragraphs}
          ${cta}
        </td></tr>
        <tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
            You received this because you have activity on your OfferBridge account.
            This is a transactional notification about your order or wallet — it is separate from account security emails.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  // Plain-text fallback — the raw body plus the link on its own line.
  const text = String(opts.body ?? "") + (opts.ctaUrl ? `\n\n${opts.ctaUrl}` : "") + `\n\n— OfferBridge`;
  return { html, text };
}

function isEmailShaped(e: string | null): boolean {
  return !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Auth: the shared cron secret is REQUIRED (no secret configured => refuse,
  // so the endpoint is never left open). This is the same pattern price-check uses.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return json({ error: "Not configured (CRON_SECRET missing)" }, 503);
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!timingSafeEqual(provided, cronSecret)) return json({ error: "Unauthorized" }, 401);

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return json({ error: "Email provider not configured (RESEND_API_KEY missing)" }, 503);
  const FROM = Deno.env.get("EMAIL_FROM") ?? "OfferBridge <onboarding@resend.dev>";
  const APP_URL = Deno.env.get("APP_URL") ?? "https://smartbridge-gold.vercel.app";

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const worker = crypto.randomUUID();
  const deadline = Date.now() + 25_000; // stay well under the function wall-clock

  let claimed = 0, sent = 0, failed = 0, retried = 0;

  while (Date.now() < deadline) {
    const { data: rows, error } = await admin.rpc("claim_email_batch", { p_worker: worker, p_limit: 10, p_lease_seconds: 600 });
    if (error) return json({ error: error.message, claimed, sent, failed, retried }, 500);
    if (!rows || rows.length === 0) break;

    for (const r of rows as Array<Record<string, any>>) {
      claimed++;

      if (!isEmailShaped(r.to_email)) {
        await admin.rpc("mark_email_failed", { p_id: r.id, p_worker: worker, p_error: "no/invalid recipient", p_permanent: true });
        failed++;
        continue;
      }

      const ctaUrl = safeAbsoluteUrl(APP_URL, r.link ?? null);
      const subject = String(r.subject ?? "").replace(/[\r\n]+/g, " ").slice(0, 200); // header hygiene
      const { html, text } = renderEmail({ subject, body: r.body ?? "", ctaUrl, category: r.category ?? null });

      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10_000);
        let res: Response;
        try {
          res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            signal: ctrl.signal,
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
              "Idempotency-Key": `outbox-${r.id}`, // stable across retries -> provider de-dups
            },
            body: JSON.stringify({ from: FROM, to: [r.to_email], subject, html, text }),
          });
        } finally {
          clearTimeout(t);
        }

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          await admin.rpc("mark_email_sent", { p_id: r.id, p_worker: worker, p_provider_message_id: data?.id ?? null });
          sent++;
        } else {
          // 400/422 = permanent (malformed request / invalid recipient). 401 & 403
          // (bad key / unverified domain) are treated as TRANSIENT so a corrected
          // key or freshly-verified domain auto-recovers within the retry window
          // instead of dead-lettering the whole queue. 429/5xx/else = transient.
          const permanent = res.status === 400 || res.status === 422;
          const retryAfter = res.status === 429 ? Number(res.headers.get("retry-after")) || null : null;
          await admin.rpc("mark_email_failed", {
            p_id: r.id, p_worker: worker, p_error: `resend ${res.status}`, p_permanent: permanent, p_retry_after_seconds: retryAfter,
          });
          permanent ? failed++ : retried++;
        }
      } catch (e) {
        // Network/timeout/abort -> transient. Never log the key, recipient, or body.
        const name = e instanceof Error ? e.name : "error";
        await admin.rpc("mark_email_failed", { p_id: r.id, p_worker: worker, p_error: `net:${name}`, p_permanent: false });
        retried++;
      }
    }
  }

  return json({ ok: true, worker, claimed, sent, failed, retried });
});
