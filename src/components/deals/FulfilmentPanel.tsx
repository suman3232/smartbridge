import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/hooks/use-toast";
import { supabase, Deal, OrderRow, PaymentStatus } from "@/lib/supabase";
import { ORDER_SCREENSHOT_BUCKET } from "@/lib/storage";
import { Loader2, Truck, IndianRupee, ShieldCheck, KeyRound, PackageCheck, AlertTriangle, Lock } from "lucide-react";

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

interface Props {
  deal: Deal;
  order: OrderRow | null;
  isBuyer: boolean;
  isCardHolder: boolean;
  isAdmin: boolean;
  onChange: () => void;
}

export function FulfilmentPanel({ deal, order, isBuyer, isCardHolder, isAdmin, onChange }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  // Shipping form
  const [courier, setCourier] = useState(order?.courier ?? "");
  const [awb, setAwb] = useState(order?.tracking_id ?? "");
  const [trackUrl, setTrackUrl] = useState(order?.tracking_url ?? "");
  const [edd, setEdd] = useState(deal.estimated_delivery_date ?? "");
  const [shipShot, setShipShot] = useState("");
  const [codeType, setCodeType] = useState<string>(order?.delivery_code_type ?? "none");

  // Payment form
  const [payRef, setPayRef] = useState("");
  const [payProof, setPayProof] = useState("");

  // Delivery code
  const [codeValue, setCodeValue] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);

  const pay = PAYMENT_LABEL[deal.payment_status] ?? PAYMENT_LABEL.not_due;
  const shipped = order?.status === "shipped" || order?.status === "delivered";
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

  const submitShipping = () =>
    run("ship", () => supabase.rpc("update_shipping", {
      p_deal_id: deal.id, p_courier: courier, p_tracking_id: awb.trim(),
      p_tracking_url: trackUrl.trim() || null, p_estimated_delivery_date: edd || null,
      p_shipped_screenshot_url: shipShot.trim() || null,
      p_delivery_code_type: codeType || null,
    }), "Shipping updated");

  const saveCode = () =>
    run("code", () => supabase.rpc("set_delivery_code", {
      p_deal_id: deal.id, p_code_type: order?.delivery_code_type && order.delivery_code_type !== "none" ? order.delivery_code_type : "otp",
      p_code_value: codeValue.trim(),
    }), "Delivery code saved (locked until payment is verified)");

  const submitPayment = () =>
    run("pay", () => supabase.rpc("submit_buyer_payment", {
      p_deal_id: deal.id, p_reference: payRef.trim(), p_proof_url: payProof.trim() || null,
    }), "Payment submitted for verification");

  const confirmReceipt = () =>
    run("confirm", () => supabase.rpc("buyer_confirm_receipt", { p_deal_id: deal.id }), "Delivery confirmed");

  const revealCode = async () => {
    setBusy("reveal");
    const { data, error } = await supabase.rpc("get_delivery_code", { p_deal_id: deal.id });
    setBusy(null);
    if (error) { toast({ title: "Locked", description: error.message, variant: "destructive" }); return; }
    setRevealed(data?.[0]?.code_value ?? null);
  };

  const verifyPayment = (approve: boolean) =>
    run(approve ? "vok" : "vno", () => supabase.rpc("admin_verify_payment", { p_deal_id: deal.id, p_approve: approve, p_notes: null }),
      approve ? "Payment verified" : "Payment rejected");

  return (
    <div className="space-y-4">
      {/* Status strip */}
      <Card>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Payment</p>
            <Badge variant={pay.variant} className="mt-1">{pay.text}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Est. delivery</p>
            <p className="text-sm font-medium">{fmtDate(deal.estimated_delivery_date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payment due</p>
            <p className="text-sm font-medium">{fmtDate(deal.payment_due_date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Courier</p>
            <p className="text-sm font-medium">{order?.courier ? `${order.courier}` : "Not shipped"}</p>
          </div>
          {order?.tracking_id && (
            <div className="col-span-2 sm:col-span-4 text-xs text-muted-foreground">
              Tracking: <span className="text-foreground font-medium">{order.tracking_id}</span>
              {order.tracking_url && <> · <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Track</a></>}
            </div>
          )}
          {deal.dispute_status === "open" && (
            <div className="col-span-2 sm:col-span-4">
              <Badge variant="rejected">Dispute open — settlement paused</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CARD HOLDER: shipping */}
      {isCardHolder && order && deal.status === "in_progress" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Truck className="w-4 h-4" /> {shipped ? "Update shipping" : "Add shipping details"}</CardTitle>
            <CardDescription>Marketplaces change delivery estimates often — keep this current. Changing the date recalculates the buyer's payment deadline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Courier</Label>
                <select value={courier} onChange={(e) => setCourier(e.target.value)} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select courier</option>
                  {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="awb">Tracking ID / AWB</Label>
                <Input id="awb" value={awb} onChange={(e) => setAwb(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="turl">Tracking URL (optional)</Label>
                <Input id="turl" value={trackUrl} onChange={(e) => setTrackUrl(e.target.value)} placeholder="https://…" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="edd">Estimated delivery date</Label>
                <Input id="edd" type="date" value={edd} onChange={(e) => setEdd(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Delivery verification needed?</Label>
              <select value={codeType} onChange={(e) => setCodeType(e.target.value)} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="none">No OTP/PIN needed</option>
                <option value="otp">Delivery OTP</option>
                <option value="pin">Delivery PIN</option>
                <option value="openbox">Open-box code</option>
              </select>
            </div>
            <Button onClick={submitShipping} disabled={busy === "ship" || !courier || !awb.trim() || !edd} className="w-full">
              {busy === "ship" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save shipping details"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* CARD HOLDER: set delivery code */}
      {isCardHolder && order && needsCode && deal.status === "in_progress" && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="w-4 h-4" /> Delivery {order?.delivery_code_type}</CardTitle>
            <CardDescription>Enter the {order?.delivery_code_type} you received. It stays locked until the buyer's payment is verified, then the buyer can view it.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Input value={codeValue} onChange={(e) => setCodeValue(e.target.value)} placeholder={`Enter the ${order?.delivery_code_type}`} className="flex-1" />
            <Button onClick={saveCode} disabled={busy === "code" || !codeValue.trim()}>
              {busy === "code" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lock in code"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* BUYER: payment */}
      {isBuyer && order && deal.payment_status !== "verified" && deal.status === "in_progress" && (
        <Card className="border-warning/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><IndianRupee className="w-4 h-4" /> Pay ₹{deal.expected_buy_price.toLocaleString()}</CardTitle>
            <CardDescription>
              Due by <span className="font-medium text-foreground">{fmtDate(deal.payment_due_date)}</span> (one day before delivery).
              Pay the OfferBridge team, then submit your reference/screenshot for verification.
              {deal.payment_status === "submitted" && " — Your payment is under verification."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="payref">Payment reference / UTR</Label>
              <Input id="payref" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Transaction reference" className="mt-1" />
            </div>
            <div>
              <Label>Payment screenshot (optional)</Label>
              <div className="mt-1">
                <FileUpload bucket={ORDER_SCREENSHOT_BUCKET} accept="image/*" label="Upload payment proof"
                  onUploaded={({ path }) => setPayProof(path)} onCleared={() => setPayProof("")} />
              </div>
            </div>
            <Button onClick={submitPayment} disabled={busy === "pay" || (!payRef.trim() && !payProof.trim())} className="w-full">
              {busy === "pay" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit payment for verification"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* BUYER: delivery code (payment-gated) */}
      {(isBuyer || isCardHolder || isAdmin) && needsCode && deal.has_delivery_code && !deal.buyer_confirmed_at && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="w-4 h-4" /> Delivery {order?.delivery_code_type}</CardTitle>
            <CardDescription>
              {isBuyer && deal.payment_status !== "verified"
                ? "Locked until your payment is verified."
                : "Show this to the delivery agent when the parcel arrives."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {revealed ? (
              <p className="text-2xl font-bold tracking-[0.3em] font-mono">{revealed}</p>
            ) : isBuyer && deal.payment_status !== "verified" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="w-4 h-4" /> Pay to unlock the delivery code.</div>
            ) : (
              <Button variant="outline" onClick={revealCode} disabled={busy === "reveal"}>
                {busy === "reveal" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reveal delivery code"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* BUYER: confirm receipt / dispute */}
      {isBuyer && order && deal.status === "in_progress" && !deal.buyer_confirmed_at && (
        <Card>
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4">
            <p className="text-sm text-muted-foreground">Received the product? Confirm so the card holder can be settled.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                const reason = window.prompt("Describe the issue (e.g. not received, wrong/damaged item):");
                if (reason) void run("dispute", () => supabase.rpc("raise_dispute", { p_deal_id: deal.id, p_reason: reason }), "Issue reported");
              }} disabled={!!busy}>
                <AlertTriangle className="w-4 h-4 mr-2" /> Report issue
              </Button>
              <Button onClick={confirmReceipt} disabled={busy === "confirm"}>
                {busy === "confirm" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><PackageCheck className="w-4 h-4 mr-2" /> Confirm received</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isBuyer && deal.buyer_confirmed_at && deal.status === "in_progress" && (
        <Card className="border-success/20 bg-success/5">
          <CardContent className="p-4 text-sm text-muted-foreground">You confirmed receipt. An admin will settle the card holder's reimbursement + commission.</CardContent>
        </Card>
      )}

      {/* ADMIN: verify payment */}
      {isAdmin && order && deal.payment_status === "submitted" && (
        <Card className="border-warning/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="w-4 h-4" /> Verify buyer payment</CardTitle>
            <CardDescription>
              Reference: {deal.payment_reference || "—"}
              {deal.payment_proof_url && " · proof uploaded"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => verifyPayment(true)} disabled={!!busy} className="flex-1">
              {busy === "vok" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify payment"}
            </Button>
            <Button variant="outline" onClick={() => verifyPayment(false)} disabled={!!busy}>Reject</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
