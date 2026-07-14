import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/hooks/use-toast";
import { supabase, OrderRow, PaymentStatus, ViewerDeal } from "@/lib/supabase";
import { ORDER_SCREENSHOT_BUCKET, getSignedUrl } from "@/lib/storage";
import { Loader2, Truck, IndianRupee, ShieldCheck, KeyRound, PackageCheck, AlertTriangle, Lock, ClipboardCheck } from "lucide-react";

const COURIERS = ["Ekart", "Delhivery", "Blue Dart", "Xpressbees", "Ecom Express", "DTDC", "India Post", "Other"];

const PAYMENT_LABEL: Record<PaymentStatus, { text: string; variant: "approved" | "pending" | "rejected" | "success" | "secondary" }> = {
  not_due: { text: "Not yet due", variant: "secondary" },
  due_soon: { text: "Due soon", variant: "pending" },
  due: { text: "Payment due", variant: "pending" },
  overdue: { text: "Overdue", variant: "rejected" },
  submitted: { text: "Under verification", variant: "pending" },
  verified: { text: "Payment verified", variant: "success" },
  refunded: { text: "Refunded", variant: "secondary" },
  disputed: { text: "Disputed", variant: "rejected" },
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

// Load Razorpay Checkout once, on demand.
declare global { interface Window { Razorpay?: new (opts: unknown) => { open: () => void } } }
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

interface Props {
  deal: ViewerDeal;
  order: OrderRow | null;
  isBuyer: boolean;
  isCardHolder: boolean;
  isAdmin: boolean;
  onChange: () => void;
}

export function FulfilmentPanel({ deal, order, isBuyer, isCardHolder, isAdmin, onChange }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const [courier, setCourier] = useState(order?.courier ?? "");
  const [awb, setAwb] = useState(order?.tracking_id ?? "");
  const [trackUrl, setTrackUrl] = useState(order?.tracking_url ?? "");
  const [edd, setEdd] = useState(deal.estimated_delivery_date ?? "");
  const [shipShot, setShipShot] = useState("");
  const [codeType, setCodeType] = useState<string>(order?.delivery_code_type ?? "none");
  const [payRef, setPayRef] = useState("");
  const [payProof, setPayProof] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [codeValue, setCodeValue] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [actualAmt, setActualAmt] = useState<string>(order?.amount_paid ? String(order.amount_paid) : "");
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  // Resubmit form
  const [rOrderId, setROrderId] = useState(order?.marketplace_order_id ?? "");
  const [rEdd, setREdd] = useState(deal.estimated_delivery_date ?? "");
  const [rShot, setRShot] = useState("");

  const pay = PAYMENT_LABEL[deal.payment_status] ?? PAYMENT_LABEL.not_due;
  const proofVerified = deal.order_proof_status === "verified";
  // Buyer total from the server pricing authority (legacy deals fall back).
  const payable = deal.buyer_payable ?? deal.expected_buy_price;
  const revisionPending = deal.price_revision_status === "pending_buyer";
  const revisionDeclined = deal.price_revision_status === "declined";
  const needsCode = (order?.delivery_code_type ?? "none") !== "none";

  const run = async (key: string, fn: () => Promise<{ error: { message: string } | null }>, ok: string) => {
    setBusy(key);
    const { error } = await fn();
    setBusy(null);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return false; }
    toast({ title: ok });
    onChange();
    return true;
  };

  const viewScreenshot = async () => {
    if (!order?.order_screenshot_url) return;
    const url = /^https?:\/\//.test(order.order_screenshot_url)
      ? order.order_screenshot_url : await getSignedUrl(ORDER_SCREENSHOT_BUCKET, order.order_screenshot_url);
    if (url) { setShotUrl(url); window.open(url, "_blank", "noopener,noreferrer"); }
  };

  // Turn a raw server/edge error into a safe, actionable message (never leak
  // stack traces, keys, or DB internals to the buyer).
  const friendlyPayError = (serverMsg: string, status?: number): string => {
    const m = (serverMsg || "").toLowerCase();
    if (status === 401 || m.includes("sign in")) return "Your session expired — please sign in again.";
    if (m.includes("order proof")) return "The order proof hasn't been approved yet. You'll be able to pay once an admin verifies it.";
    if (m.includes("revis")) return "Please accept or decline the revised price before paying.";
    if (m.includes("already paid") || m.includes("already verified")) return "This order is already paid.";
    if (m.includes("only the buyer")) return "Only the buyer can pay for this order.";
    if (m.includes("not configured")) return "The payment gateway isn't configured yet. Please contact support.";
    if (m.includes("amount")) return "The payment amount couldn't be calculated. Please refresh and try again.";
    if (status && status >= 500) return "Payment service is temporarily unavailable. Please try again in a moment.";
    return "Couldn't start payment. Please try again.";
  };

  // ---- Razorpay: create order → checkout → server verify ----
  const payWithRazorpay = async () => {
    setBusy("rzp");
    const { data, error } = await supabase.functions.invoke("razorpay-create-order", { body: { deal_id: deal.id } });
    if (error || !data?.razorpay_order_id) {
      setBusy(null);
      // supabase-js puts the failed Response on error.context; read the server's
      // { error } body so we can show a specific, safe reason.
      let serverMsg = (data as { error?: string })?.error ?? "";
      let status: number | undefined;
      const ctx = (error as { context?: Response })?.context;
      if (ctx && typeof ctx.json === "function") {
        status = ctx.status;
        try { serverMsg = (await ctx.json())?.error ?? serverMsg; } catch { /* non-JSON body */ }
      }
      toast({ title: "Couldn't start payment", description: friendlyPayError(serverMsg, status), variant: "destructive" });
      return;
    }
    const ok = await loadRazorpay();
    if (!ok) { setBusy(null); toast({ title: "Payment unavailable", description: "Could not load Razorpay.", variant: "destructive" }); return; }
    const rzp = new window.Razorpay!({
      key: data.key_id, order_id: data.razorpay_order_id, amount: data.amount, currency: data.currency,
      name: "OfferBridge", description: data.product_name,
      handler: async (resp: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        const v = await supabase.functions.invoke("razorpay-verify-payment", { body: resp });
        setBusy(null);
        if (v.error || (v.data as { error?: string })?.error) {
          toast({ title: "Payment verification pending", description: "We'll confirm once Razorpay notifies us.", variant: "destructive" });
        } else {
          toast({ title: "Payment successful" });
        }
        onChange();
      },
      modal: { ondismiss: () => setBusy(null) },
    });
    rzp.open();
  };

  return (
    <div className="space-y-4">
      {/* Status strip */}
      <Card>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Payment</p>
            <Badge variant={pay.variant} className="mt-1">{pay.text}</Badge>
            {deal.payment_method && <p className="text-[11px] text-muted-foreground mt-1">via {deal.payment_method === "razorpay" ? "Razorpay" : "manual verification"}</p>}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Order proof</p>
            <Badge variant={proofVerified ? "success" : deal.order_proof_status === "pending" ? "pending" : "rejected"} className="mt-1 capitalize">
              {deal.order_proof_status === "correction" ? "needs fix" : deal.order_proof_status}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Est. delivery</p>
            <p className="text-sm font-medium">{fmtDate(deal.estimated_delivery_date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payment due</p>
            <p className="text-sm font-medium">{proofVerified ? fmtDate(deal.payment_due_date) : "after approval"}</p>
          </div>
          {order?.tracking_id && (
            <div className="col-span-2 sm:col-span-4 text-xs text-muted-foreground">
              {order.courier} · {order.tracking_id}
              {order.tracking_url && <> · <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Track</a></>}
            </div>
          )}
          {deal.dispute_status === "open" && <div className="col-span-2 sm:col-span-4"><Badge variant="rejected">Dispute open — settlement paused</Badge></div>}
        </CardContent>
      </Card>

      {/* ADMIN: verify order proof */}
      {isAdmin && order && deal.order_proof_status === "pending" && (
        <Card className="border-warning/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="w-4 h-4" /> Verify order proof</CardTitle>
            <CardDescription>The buyer isn't asked to pay until you approve this.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
              <p><span className="text-muted-foreground">Order ID:</span> {order.marketplace_order_id || "—"}</p>
              <p><span className="text-muted-foreground">Platform:</span> {order.platform || "—"}</p>
              <p><span className="text-muted-foreground">Est. delivery:</span> {fmtDate(deal.estimated_delivery_date)}</p>
              <p><span className="text-muted-foreground">Posted price after offer:</span> ₹{deal.card_offer_price.toLocaleString()}</p>
              <p><span className="text-muted-foreground">Cardholder reward:</span> ₹{deal.commission_amount.toLocaleString()}</p>
              {deal.service_fee != null && <p><span className="text-muted-foreground">Service fee:</span> ₹{deal.service_fee.toLocaleString()}</p>}
            </div>
            {order.order_screenshot_url && (
              <Button variant="outline" size="sm" onClick={viewScreenshot}>{shotUrl ? "Re-open screenshot" : "View order screenshot"}</Button>
            )}
            {deal.service_fee != null && (
              <div>
                <Label htmlFor="actual-amt">Actual purchase amount (₹) — from the order proof</Label>
                <Input id="actual-amt" type="number" min="1" step="0.01" value={actualAmt} onChange={(e) => setActualAmt(e.target.value)} placeholder={String(deal.card_offer_price)} className="mt-1" />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Becomes the reimbursement base and part of the buyer's total. If it exceeds the posted ₹{deal.card_offer_price.toLocaleString()}, the buyer must approve the revised total before being asked to pay.
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="rev-reason">Reason (required to reject / request correction)</Label>
              <Input id="rev-reason" value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} placeholder="e.g. screenshot unclear, order ID mismatch" className="mt-1" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => run("approve", () => supabase.rpc("admin_verify_order_proof", { p_deal_id: deal.id, p_action: "approve", p_actual_amount: deal.service_fee != null ? (parseFloat(actualAmt) || null) : null }), "Order proof approved")} disabled={!!busy || (deal.service_fee != null && !(parseFloat(actualAmt) > 0))}>
                {busy === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Approve"}
              </Button>
              <Button variant="outline" onClick={() => run("correction", () => supabase.rpc("admin_verify_order_proof", { p_deal_id: deal.id, p_action: "correction", p_reason: reviewReason }), "Correction requested")} disabled={!!busy || !reviewReason.trim()}>Request correction</Button>
              <Button variant="destructive" onClick={() => run("reject", () => supabase.rpc("admin_verify_order_proof", { p_deal_id: deal.id, p_action: "reject", p_reason: reviewReason }), "Order proof rejected")} disabled={!!busy || !reviewReason.trim()}>Reject</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Buyer/holder: awaiting verification note */}
      {order && deal.order_proof_status === "pending" && !isAdmin && (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">
          {isBuyer ? "Your order is placed and being verified by OfferBridge. You'll be asked to pay once it's approved."
                   : "Order submitted — waiting for OfferBridge to verify it."}
        </CardContent></Card>
      )}

      {/* CARD HOLDER: resubmit after reject/correction */}
      {isCardHolder && order && (deal.order_proof_status === "rejected" || deal.order_proof_status === "correction") && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="w-4 h-4" /> Order proof {deal.order_proof_status === "rejected" ? "rejected" : "needs correction"}</CardTitle>
            <CardDescription>{deal.order_proof_reason}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label htmlFor="r-oid">Marketplace order ID</Label><Input id="r-oid" value={rOrderId} onChange={(e) => setROrderId(e.target.value)} className="mt-1" /></div>
              <div><Label htmlFor="r-edd">Estimated delivery date</Label><Input id="r-edd" type="date" value={rEdd} onChange={(e) => setREdd(e.target.value)} className="mt-1" /></div>
            </div>
            <div>
              <Label>Order screenshot</Label>
              <div className="mt-1"><FileUpload bucket={ORDER_SCREENSHOT_BUCKET} accept="image/*" label="Upload corrected screenshot" onUploaded={({ path }) => setRShot(path)} onCleared={() => setRShot("")} /></div>
            </div>
            <Button className="w-full" disabled={busy === "resub" || !rOrderId.trim() || !rEdd || !rShot.trim()}
              onClick={() => run("resub", () => supabase.rpc("place_deal_order", { p_deal_id: deal.id, p_order_screenshot_url: rShot.trim(), p_marketplace_order_id: rOrderId.trim(), p_estimated_delivery_date: rEdd, p_delivery_code_type: order?.delivery_code_type ?? "none" }), "Resubmitted for verification")}>
              {busy === "resub" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Resubmit order proof"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* CARD HOLDER: shipping (after proof verified) */}
      {isCardHolder && order && deal.status === "in_progress" && proofVerified && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Truck className="w-4 h-4" /> {order.status === "shipped" ? "Update shipping" : "Add shipping details"}</CardTitle>
            <CardDescription>Changing the delivery date recalculates the buyer's payment deadline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Courier</Label>
                <select value={courier} onChange={(e) => setCourier(e.target.value)} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select courier</option>{COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><Label htmlFor="awb">Tracking ID / AWB</Label><Input id="awb" value={awb} onChange={(e) => setAwb(e.target.value)} className="mt-1" /></div>
              <div><Label htmlFor="turl">Tracking URL (optional)</Label><Input id="turl" value={trackUrl} onChange={(e) => setTrackUrl(e.target.value)} placeholder="https://…" className="mt-1" /></div>
              <div><Label htmlFor="edd2">Estimated delivery date</Label><Input id="edd2" type="date" value={edd} onChange={(e) => setEdd(e.target.value)} className="mt-1" /></div>
            </div>
            <div>
              <Label>Delivery verification needed?</Label>
              <select value={codeType} onChange={(e) => setCodeType(e.target.value)} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="none">No OTP/PIN needed</option><option value="otp">Delivery OTP</option><option value="pin">Delivery PIN</option><option value="openbox">Open-box code</option>
              </select>
            </div>
            <Button onClick={() => run("ship", () => supabase.rpc("update_shipping", { p_deal_id: deal.id, p_courier: courier, p_tracking_id: awb.trim(), p_tracking_url: trackUrl.trim() || null, p_estimated_delivery_date: edd || null, p_shipped_screenshot_url: shipShot.trim() || null, p_delivery_code_type: codeType || null }), "Shipping updated")}
              disabled={busy === "ship" || !courier || !awb.trim() || !edd} className="w-full">
              {busy === "ship" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save shipping details"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* CARD HOLDER: add delivery OTP/PIN — Stage 5, only AFTER the order has
          shipped (out for delivery), only if a code is needed, and only until one
          is set. Never shown during placement or shipping. */}
      {isCardHolder && order && needsCode && order.status === "shipped" && !deal.has_delivery_code && deal.status === "in_progress" && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="w-4 h-4" /> Add delivery {order?.delivery_code_type}</CardTitle>
            <CardDescription>Add this only when the courier shares it (usually on delivery day). It stays locked until the buyer's payment is verified.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Input value={codeValue} onChange={(e) => setCodeValue(e.target.value)} placeholder={`Enter the ${order?.delivery_code_type}`} className="flex-1" />
            <Button onClick={() => run("code", () => supabase.rpc("set_delivery_code", { p_deal_id: deal.id, p_code_type: (order?.delivery_code_type && order.delivery_code_type !== "none" ? order.delivery_code_type : "otp"), p_code_value: codeValue.trim() }), "Delivery code locked in")}
              disabled={busy === "code" || !codeValue.trim()}>{busy === "code" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lock in code"}</Button>
          </CardContent>
        </Card>
      )}

      {/* BUYER: price revision approval (actual price came in higher) */}
      {isBuyer && revisionPending && (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="w-4 h-4" /> Price changed — your approval needed</CardTitle>
            <CardDescription>
              The verified purchase price is ₹{(deal.actual_purchase_price ?? 0).toLocaleString()} (you agreed to ₹{deal.card_offer_price.toLocaleString()}).
              Revised total: <span className="font-semibold text-foreground">₹{payable.toLocaleString()}</span>. You won't be charged unless you accept.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => run("rev-ok", () => supabase.rpc("buyer_respond_price_revision", { p_deal_id: deal.id, p_accept: true }), "Revised total accepted — you can pay now")} disabled={!!busy}>
              {busy === "rev-ok" ? <Loader2 className="w-4 h-4 animate-spin" /> : `Accept ₹${payable.toLocaleString()}`}
            </Button>
            <Button variant="destructive" onClick={() => run("rev-no", () => supabase.rpc("buyer_respond_price_revision", { p_deal_id: deal.id, p_accept: false }), "Declined — an admin will resolve this")} disabled={!!busy}>Decline</Button>
          </CardContent>
        </Card>
      )}
      {revisionDeclined && isBuyer && (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">
          You declined the revised price. An admin will resolve this order — re-verify with a corrected amount, or cancel and refund.
        </CardContent></Card>
      )}
      {revisionDeclined && isAdmin && (
        <Card className="border-warning/40">
          <CardHeader><CardTitle className="text-base">Resolve declined price revision</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="resolve-amt">Corrected actual amount (₹)</Label>
              <Input id="resolve-amt" type="number" min="1" step="0.01" value={actualAmt} onChange={(e) => setActualAmt(e.target.value)} placeholder={String(deal.card_offer_price)} className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">≤ ₹{deal.card_offer_price.toLocaleString()} bills the buyer straight away; higher re-asks the buyer to approve.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => run("resolve-reverify", () => supabase.rpc("admin_resolve_price_revision", { p_deal_id: deal.id, p_action: "reverify", p_new_actual_amount: parseFloat(actualAmt) || null }), "Order re-verified")} disabled={!!busy || !(parseFloat(actualAmt) > 0)}>
                {busy === "resolve-reverify" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Re-verify with corrected amount"}
              </Button>
              <Button variant="destructive" onClick={() => run("resolve-cancel", () => supabase.rpc("admin_resolve_price_revision", { p_deal_id: deal.id, p_action: "cancel", p_notes: reviewReason || null }), "Order cancelled")} disabled={!!busy}>Cancel order</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* BUYER: pay (only after order proof verified + no unresolved revision) */}
      {isBuyer && order && proofVerified && !revisionPending && !revisionDeclined && deal.payment_status !== "verified" && deal.status === "in_progress" && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><IndianRupee className="w-4 h-4" /> Pay ₹{payable.toLocaleString()}</CardTitle>
            <CardDescription>
              Due by <span className="font-medium text-foreground">{fmtDate(deal.payment_due_date)}</span> (one day before delivery).
              {deal.payment_status === "submitted" && " — Your manual payment is under verification."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={payWithRazorpay} disabled={!!busy} className="w-full">
              {busy === "rzp" ? <Loader2 className="w-4 h-4 animate-spin" /> : `Pay ₹${payable.toLocaleString()} now`}
            </Button>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => setManualOpen((v) => !v)}>
              {manualOpen ? "Hide" : "Paid another way? Submit proof for manual verification"}
            </button>
            {manualOpen && (
              <div className="space-y-3 rounded-lg border border-white/[0.06] p-3">
                <div><Label htmlFor="payref">Payment reference / UTR</Label><Input id="payref" value={payRef} onChange={(e) => setPayRef(e.target.value)} className="mt-1" /></div>
                <div><Label>Payment screenshot (optional)</Label><div className="mt-1"><FileUpload bucket={ORDER_SCREENSHOT_BUCKET} accept="image/*" label="Upload payment proof" onUploaded={({ path }) => setPayProof(path)} onCleared={() => setPayProof("")} /></div></div>
                <Button variant="outline" onClick={() => run("pay", () => supabase.rpc("submit_buyer_payment", { p_deal_id: deal.id, p_reference: payRef.trim(), p_proof_url: payProof.trim() || null }), "Submitted for verification")}
                  disabled={busy === "pay" || (!payRef.trim() && !payProof.trim())} className="w-full">
                  {busy === "pay" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit payment proof"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ADMIN: verify a manually-submitted payment */}
      {isAdmin && order && deal.payment_status === "submitted" && (
        <Card className="border-warning/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="w-4 h-4" /> Verify manual payment</CardTitle>
            <CardDescription>Reference: {deal.payment_reference || "—"}{deal.payment_proof_url && " · proof uploaded"}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => run("vok", () => supabase.rpc("admin_verify_payment", { p_deal_id: deal.id, p_approve: true, p_notes: null }), "Payment verified")} disabled={!!busy} className="flex-1">
              {busy === "vok" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify payment"}
            </Button>
            <Button variant="outline" onClick={() => run("vno", () => supabase.rpc("admin_verify_payment", { p_deal_id: deal.id, p_approve: false, p_notes: null }), "Payment rejected")} disabled={!!busy}>Reject</Button>
          </CardContent>
        </Card>
      )}

      {/* Delivery code (payment-gated) */}
      {(isBuyer || isCardHolder || isAdmin) && needsCode && deal.has_delivery_code && !deal.buyer_confirmed_at && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="w-4 h-4" /> Delivery {order?.delivery_code_type}</CardTitle>
            <CardDescription>{isBuyer && deal.payment_status !== "verified" ? "Locked until your payment is verified." : "Show this to the delivery agent when the parcel arrives."}</CardDescription>
          </CardHeader>
          <CardContent>
            {revealed ? <p className="text-2xl font-bold tracking-[0.3em] font-mono">{revealed}</p>
              : isBuyer && deal.payment_status !== "verified" ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="w-4 h-4" /> Pay to unlock the delivery code.</div>
              : <Button variant="outline" disabled={busy === "reveal"} onClick={async () => {
                  setBusy("reveal");
                  const { data, error } = await supabase.rpc("get_delivery_code", { p_deal_id: deal.id });
                  setBusy(null);
                  if (error) toast({ title: "Locked", description: error.message, variant: "destructive" });
                  else setRevealed(data?.[0]?.code_value ?? null);
                }}>{busy === "reveal" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reveal delivery code"}</Button>}
          </CardContent>
        </Card>
      )}

      {/* BUYER: confirm receipt / dispute */}
      {isBuyer && order && deal.status === "in_progress" && !deal.buyer_confirmed_at && proofVerified && (
        <Card>
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4">
            <p className="text-sm text-muted-foreground">Received the product? Confirm so the card holder can be settled.</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={!!busy} onClick={() => {
                const reason = window.prompt("Describe the issue (e.g. not received, wrong/damaged item):");
                if (reason) void run("dispute", () => supabase.rpc("raise_dispute", { p_deal_id: deal.id, p_reason: reason }), "Issue reported");
              }}><AlertTriangle className="w-4 h-4 mr-2" /> Report issue</Button>
              <Button onClick={() => run("confirm", () => supabase.rpc("buyer_confirm_receipt", { p_deal_id: deal.id }), "Delivery confirmed")} disabled={busy === "confirm"}>
                {busy === "confirm" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><PackageCheck className="w-4 h-4 mr-2" /> Confirm received</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isBuyer && deal.buyer_confirmed_at && deal.status === "in_progress" && (
        <Card className="border-success/20 bg-success/5"><CardContent className="p-4 text-sm text-muted-foreground">You confirmed receipt. An admin will settle the card holder's reimbursement + reward.</CardContent></Card>
      )}

      {/* ADMIN: full financial breakdown (fee + revenue are admin/buyer-only data) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><IndianRupee className="w-4 h-4" /> Financial breakdown</CardTitle>
            <CardDescription>Server-authoritative amounts for this deal</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <p><span className="text-muted-foreground">Original price:</span> ₹{deal.original_price.toLocaleString()}</p>
            <p><span className="text-muted-foreground">Posted price after offer:</span> ₹{deal.card_offer_price.toLocaleString()}</p>
            <p><span className="text-muted-foreground">Actual verified amount:</span> {deal.actual_purchase_price != null ? `₹${deal.actual_purchase_price.toLocaleString()}` : "— (set at proof approval)"}</p>
            <p><span className="text-muted-foreground">Cardholder reward:</span> ₹{deal.commission_amount.toLocaleString()}</p>
            <p><span className="text-muted-foreground">OfferBridge service fee:</span> {deal.service_fee != null ? `₹${deal.service_fee.toLocaleString()}` : "— (legacy deal)"}</p>
            <p><span className="text-muted-foreground">Buyer pays (total):</span> ₹{payable.toLocaleString()}</p>
            <p><span className="text-muted-foreground">Buyer saves:</span> ₹{Math.max(0, deal.original_price - payable).toLocaleString()}</p>
            <p><span className="text-muted-foreground">Cardholder payout:</span> ₹{(deal.cardholder_payout ?? deal.card_offer_price + deal.commission_amount).toLocaleString()}</p>
            <p><span className="text-muted-foreground">Payment:</span> {deal.payment_status}{deal.payment_method ? ` (${deal.payment_method})` : ""}</p>
            <p><span className="text-muted-foreground">Payment ref:</span> {deal.payment_reference || "—"}</p>
            <p><span className="text-muted-foreground">Price revision:</span> {deal.price_revision_status}</p>
            <p><span className="text-muted-foreground">Settled:</span> {deal.settled_at ? new Date(deal.settled_at).toLocaleString() : "not yet"}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
