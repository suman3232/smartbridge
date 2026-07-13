// Supabase Edge Function: razorpay-webhook
// ---------------------------------------------------------------------------
// The AUTHORITATIVE payment confirmation. Razorpay POSTs payment events here; we
// verify the webhook HMAC signature over the RAW body, then confirm the payment
// idempotently in the DB. Never trusts a browser success callback.
//
// Deploy:  supabase functions deploy razorpay-webhook --no-verify-jwt
//          (--no-verify-jwt so Razorpay — which has no Supabase JWT — can reach it;
//           the HMAC signature is the real auth.)
// Secrets: supabase secrets set RAZORPAY_WEBHOOK_SECRET=xxx
// Razorpay dashboard → Webhooks → add URL, secret, events:
//   payment.captured, order.paid, payment.failed
// ---------------------------------------------------------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// Constant-time string compare.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!secret) return new Response("Not configured", { status: 503 });

  const raw = await req.text(); // RAW body — signature is computed over this exact string.
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  const expected = await hmacSha256Hex(secret, raw);
  if (!sig || !timingSafeEqual(sig, expected)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: Record<string, unknown>;
  try { event = JSON.parse(raw); } catch { return new Response("Bad payload", { status: 400 }); }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const type = event.event as string;

  try {
    const payload = event.payload as any;
    if (type === "payment.captured" || type === "order.paid") {
      const pay = payload?.payment?.entity;
      const orderId = pay?.order_id ?? payload?.order?.entity?.id;
      const paymentId = pay?.id ?? null;
      const amount = pay?.amount ?? payload?.order?.entity?.amount;
      const currency = pay?.currency ?? payload?.order?.entity?.currency ?? "INR";
      if (orderId && amount != null) {
        // Idempotent + fully guarded in the DB (amount/currency/order↔deal).
        await admin.rpc("gateway_confirm_razorpay_payment", {
          p_razorpay_order_id: orderId, p_razorpay_payment_id: paymentId,
          p_amount_paise: amount, p_currency: currency,
        });
      }
    } else if (type === "payment.failed") {
      const pay = payload?.payment?.entity;
      if (pay?.order_id) {
        await admin.rpc("gateway_fail_razorpay_order", {
          p_razorpay_order_id: pay.order_id, p_reason: pay?.error_description ?? "payment failed",
        });
      }
    }
  } catch (e) {
    // Log the anomaly (e.g. amount mismatch) and still return 200 — the RPC fails
    // SAFE (never marks the deal paid), so there's nothing for Razorpay to retry.
    console.error("razorpay webhook anomaly:", e instanceof Error ? e.message : e);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
