// Supabase Edge Function: razorpay-create-order
// ---------------------------------------------------------------------------
// The buyer clicks "Pay now" → this creates a Razorpay order SERVER-SIDE for the
// exact, server-derived amount, stores the deal↔order mapping, and returns the
// public key_id + order id for Razorpay Checkout. The secret NEVER leaves here.
//
// Auth: the caller's Supabase JWT (Authorization header) identifies the buyer.
// Amount: re-derived from the deal on the server (browser input is ignored).
//
// Deploy:  supabase functions deploy razorpay-create-order
// Secrets: supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=xxx
// (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY are auto-injected.)
// ---------------------------------------------------------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
  const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!KEY_ID || !KEY_SECRET) return json({ error: "Payment gateway is not configured yet." }, 503);

  let body: { deal_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!body.deal_id) return json({ error: "deal_id is required" }, 400);

  // Identify the caller from their JWT (RLS-scoped anon client).
  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await asUser.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: "Sign in to pay" }, 401);

  // Service-role client for authoritative reads/writes.
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: deal, error: dErr } = await admin
    .from("deals")
    .select("id, merchant_id, product_name, expected_buy_price, order_proof_status, payment_status")
    .eq("id", body.deal_id).maybeSingle();
  if (dErr) return json({ error: dErr.message }, 500);
  if (!deal) return json({ error: "Deal not found" }, 404);
  if (deal.merchant_id !== user.id) return json({ error: "Only the buyer can pay for this order" }, 403);
  if (deal.order_proof_status !== "verified") return json({ error: "Payment opens after the order proof is verified" }, 409);
  if (deal.payment_status === "verified") return json({ error: "This order is already paid" }, 409);

  const amountPaise = Math.round(Number(deal.expected_buy_price) * 100);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) return json({ error: "Invalid amount" }, 400);

  // Create the order on Razorpay (server-side, Basic auth).
  const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + btoa(`${KEY_ID}:${KEY_SECRET}`),
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: `deal_${deal.id}`,
      notes: { deal_id: deal.id, buyer_id: user.id },
      payment_capture: 1,
    }),
  });
  const rzp = await rzpRes.json().catch(() => ({}));
  if (!rzpRes.ok) return json({ error: rzp?.error?.description ?? "Could not start payment" }, 502);

  // Store the mapping (validates amount + gate again, server-authoritative).
  const { error: recErr } = await admin.rpc("gateway_record_razorpay_order", {
    p_deal_id: deal.id, p_razorpay_order_id: rzp.id, p_amount_paise: amountPaise,
    p_currency: "INR", p_created_by: user.id,
  });
  if (recErr) return json({ error: recErr.message }, 409);

  return json({
    key_id: KEY_ID,
    razorpay_order_id: rzp.id,
    amount: amountPaise,
    currency: "INR",
    product_name: deal.product_name,
  });
});
