// Supabase Edge Function: razorpay-verify-payment
// ---------------------------------------------------------------------------
// Immediate confirmation path from Razorpay Checkout's success handler. We do NOT
// trust the browser: we (1) verify the checkout signature HMAC(order|payment),
// then (2) fetch the payment from Razorpay server-side to read its REAL status +
// amount, then (3) confirm idempotently in the DB. The webhook is the backstop;
// both converge on the same idempotent RPC.
//
// Deploy:  supabase functions deploy razorpay-verify-payment
// Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (shared with create-order)
// ---------------------------------------------------------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
  const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!KEY_ID || !KEY_SECRET) return json({ error: "Payment gateway not configured" }, 503);

  let body: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json({ error: "Missing payment fields" }, 400);
  }

  // Must be a signed-in buyer.
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  if (!(await asUser.auth.getUser()).data?.user) return json({ error: "Sign in" }, 401);

  // 1) Verify the checkout signature: HMAC_SHA256(order_id + "|" + payment_id).
  const expected = await hmacSha256Hex(KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`);
  if (!timingSafeEqual(expected, razorpay_signature)) return json({ error: "Signature verification failed" }, 400);

  // 2) Fetch the payment from Razorpay to read the REAL status + amount + currency.
  const payRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
    headers: { Authorization: "Basic " + btoa(`${KEY_ID}:${KEY_SECRET}`) },
  });
  const pay = await payRes.json().catch(() => ({}));
  if (!payRes.ok) return json({ error: "Could not verify payment with Razorpay" }, 502);
  if (pay.order_id !== razorpay_order_id) return json({ error: "Order mismatch" }, 400);
  // Require CAPTURED — money actually taken. 'authorized' means the bank only put a
  // hold (auto-captured by payment_capture:1, so it's transient); confirming on it
  // could mark a deal paid for funds that are never captured. If we ever see
  // 'authorized' here, the webhook (payment.captured) will finalise it moments later.
  if (pay.status !== "captured") {
    return json({ error: `Payment not completed (status: ${pay.status})` }, 409);
  }

  // 3) Confirm idempotently in the DB (amount/currency/order↔deal guarded there).
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.rpc("gateway_confirm_razorpay_payment", {
    p_razorpay_order_id: razorpay_order_id, p_razorpay_payment_id: razorpay_payment_id,
    p_amount_paise: pay.amount, p_currency: pay.currency ?? "INR",
  });
  if (error) return json({ error: error.message }, 409);
  return json({ ok: true, result: data });
});
