import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase, Deal } from "@/lib/supabase";
import { FileUpload } from "@/components/ui/file-upload";
import { ORDER_SCREENSHOT_BUCKET, getSignedUrl } from "@/lib/storage";
import {
  ArrowLeft,
  CreditCard,
  ExternalLink,
  Loader2,
  MapPin,
  Package,
  CheckCircle,
} from "lucide-react";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";

type Order = {
  id: string;
  deal_id: string;
  tracking_id: string | null;
  order_screenshot_url: string | null;
  status: string;
  created_at: string;
};

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [trackingId, setTrackingId] = useState("");
  const [screenshotPath, setScreenshotPath] = useState("");
  const [screenshotSignedUrl, setScreenshotSignedUrl] = useState<string | null>(null);

  const fetchDeal = async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    const [dealRes, orderRes] = await Promise.all([
      supabase.rpc("get_deal_for_viewer", { p_deal_id: id }),
      supabase.from("orders").select("*").eq("deal_id", id).maybeSingle(),
    ]);

    if (dealRes.error) {
      toast({ title: "Couldn't load deal", description: dealRes.error.message, variant: "destructive" });
    }
    if (dealRes.data?.[0]) setDeal(dealRes.data[0] as Deal);
    if (orderRes.data) {
      const ord = orderRes.data as Order;
      setOrder(ord);
      if (ord.order_screenshot_url) {
        // Stored value is a private-bucket path; resolve a short-lived signed URL.
        const signed = /^https?:\/\//.test(ord.order_screenshot_url)
          ? ord.order_screenshot_url
          : await getSignedUrl(ORDER_SCREENSHOT_BUCKET, ord.order_screenshot_url);
        setScreenshotSignedUrl(signed);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDeal();
  }, [id]);

  const isShopper = deal?.merchant_id === profile?.id;
  const isCardHolder = deal?.customer_id === profile?.id;
  const canViewAddress =
    Boolean(deal?.delivery_address) &&
    (isShopper || isCardHolder || isAdmin);

  const handlePlaceOrder = async () => {
    if (!deal) return;
    setActionLoading(true);

    const { error } = await supabase.rpc("place_deal_order", {
      p_deal_id: deal.id,
      p_tracking_id: trackingId.trim() || null,
      p_order_screenshot_url: screenshotPath.trim() || null,
    });

    setActionLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Order recorded",
        description: "Place the order on Amazon/Flipkart using your card at the shopper's address.",
      });
      fetchDeal();
    }
  };

  const handleCompleteDeal = async () => {
    if (!deal) return;
    setActionLoading(true);

    const { error } = await supabase.rpc("complete_deal", { p_deal_id: deal.id });

    setActionLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deal completed", description: "Reimbursement and commission credited to card holder wallet." });
      fetchDeal();
    }
  };

  const handleCancelDeal = async () => {
    if (!deal) return;
    setActionLoading(true);

    const { error } = await supabase.rpc("cancel_deal", { p_deal_id: deal.id });

    setActionLoading(false);

    if (error) {
      toast({ title: "Could not cancel", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deal cancelled", description: "Your request has been withdrawn." });
      fetchDeal();
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!deal) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-4">Deal not found</p>
            <Button onClick={() => navigate("/deals")}>Back to deals</Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to={isShopper ? "/dashboard" : "/deals"}>
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{deal.product_name}</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
              <CreditCard className="w-3.5 h-3.5" />
              {deal.required_card}
            </p>
          </div>
          <Badge className="capitalize">{deal.status.replace("_", " ")}</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Agreed amounts for this deal</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-secondary/50">
              <p className="text-xs text-muted-foreground">Original price</p>
              <p className="text-lg font-semibold line-through text-muted-foreground">₹{deal.original_price.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl bg-primary/10">
              <p className="text-xs text-primary">Card offer price (you pay at checkout)</p>
              <p className="text-lg font-bold text-primary">₹{deal.card_offer_price.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl bg-secondary/50">
              <p className="text-xs text-muted-foreground">Shopper pays (total)</p>
              <p className="text-lg font-semibold">₹{deal.expected_buy_price.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl bg-success/10">
              <p className="text-xs text-success">Card holder earns (commission)</p>
              <p className="text-lg font-bold text-success">₹{deal.commission_amount.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        {canViewAddress && deal.delivery_address && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Delivery address
              </CardTitle>
              <CardDescription>Ship the product to this address when placing the order</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{deal.delivery_address}</p>
            </CardContent>
          </Card>
        )}

        {deal.admin_contact_number && (
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Need help with this deal?</p>
                <p className="text-sm text-muted-foreground">Chat with the OfferBridge support team on WhatsApp.</p>
              </div>
              <WhatsAppButton
                phone={deal.admin_contact_number}
                message={`Hi, I need help with the OfferBridge deal "${deal.product_name}".`}
                label="Chat with support"
                className="shrink-0"
              />
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <a href={deal.product_link} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="outline" className="w-full">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open product link
            </Button>
          </a>
          {isShopper && (deal.status === "pending" || deal.status === "approved") && (
            <Button
              variant="destructive"
              onClick={handleCancelDeal}
              disabled={actionLoading}
              className="shrink-0"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel deal"}
            </Button>
          )}
        </div>

        {isCardHolder && deal.status === "accepted" && !order && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Place order
              </CardTitle>
              <CardDescription>
                Order on Amazon/Flipkart using your card. Use the delivery address above. Then record details here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="tracking">Tracking ID (optional)</Label>
                <Input
                  id="tracking"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  placeholder="AWB / tracking number"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Order screenshot (optional)</Label>
                <div className="mt-1">
                  <FileUpload
                    bucket={ORDER_SCREENSHOT_BUCKET}
                    accept="image/*"
                    label="Upload order confirmation"
                    onUploaded={({ path }) => setScreenshotPath(path)}
                    onCleared={() => setScreenshotPath("")}
                  />
                </div>
              </div>
              <Button onClick={handlePlaceOrder} disabled={actionLoading} className="w-full">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "I've placed the order"}
              </Button>
            </CardContent>
          </Card>
        )}

        {order && (
          <Card>
            <CardHeader>
              <CardTitle>Order details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Status:</span> <span className="capitalize">{order.status.replace("_", " ")}</span></p>
              {order.tracking_id && <p><span className="text-muted-foreground">Tracking:</span> {order.tracking_id}</p>}
              {order.order_screenshot_url && screenshotSignedUrl && (
                <p>
                  <span className="text-muted-foreground">Screenshot:</span>{" "}
                  <a href={screenshotSignedUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    View
                  </a>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {isShopper && deal.status === "in_progress" && (
          <Card className="border-success/20 bg-success/5">
            <CardContent className="p-4 text-sm text-muted-foreground">
              The card holder has placed your order. You'll receive the product at your delivery address once it ships.
            </CardContent>
          </Card>
        )}

        {isAdmin && deal.status === "in_progress" && (
          <Card className="border-warning/30">
            <CardHeader>
              <CardTitle>Admin: complete deal</CardTitle>
              <CardDescription>
                Once you've confirmed the shopper received the product and settled payment, complete the deal to credit reimbursement (₹{deal.card_offer_price.toLocaleString()}) + commission (₹{deal.commission_amount.toLocaleString()}) to the card holder's wallet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleCompleteDeal} disabled={actionLoading} className="w-full">
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark delivered & release payment
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
