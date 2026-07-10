import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase, OpenDeal } from "@/lib/supabase";
import { Loader2, MapPin } from "lucide-react";

type AcceptPreview = {
  id: string;
  product_name: string;
  required_card: string;
  card_offer_price: number;
  commission_amount: number;
  delivery_address: string;
};

interface AcceptDealDialogProps {
  deal: OpenDeal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AcceptDealDialog({ deal, open, onOpenChange, onSuccess }: AcceptDealDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<AcceptPreview | null>(null);

  useEffect(() => {
    const loadPreview = async () => {
      if (!open || !deal) {
        setPreview(null);
        return;
      }

      setPreviewLoading(true);
      const { data, error } = await supabase.rpc("get_deal_accept_preview", {
        p_deal_id: deal.id,
      });
      setPreviewLoading(false);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setPreview(null);
        return;
      }

      setPreview((data?.[0] as AcceptPreview | undefined) ?? null);
    };

    void loadPreview();
  }, [open, deal?.id]);

  const handleAccept = async () => {
    if (!preview) return;

    setLoading(true);

    // Delivery address is taken from the deal server-side; not sent by the client.
    const { data, error } = await supabase.rpc("accept_deal", {
      p_deal_id: preview.id,
    });

    setLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Deal accepted",
        description: "Place the order on the e-commerce site using your card at the shopper's address.",
      });
      onSuccess();
      if (data?.id) {
        navigate(`/deals/${data.id}`);
      }
    }
  };

  if (!deal) return null;

  const display = preview ?? {
    id: deal.id,
    product_name: deal.product_name,
    required_card: deal.required_card,
    card_offer_price: deal.card_offer_price,
    commission_amount: deal.commission_amount,
    delivery_address: "",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Accept this deal</DialogTitle>
          <DialogDescription>
            You'll place the order on Amazon/Flipkart using your card and ship to the shopper.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 rounded-xl bg-secondary/50 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Product</span>
              <span className="text-sm font-medium">{display.product_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Required card</span>
              <span className="text-sm font-medium">{display.required_card}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">You pay at checkout</span>
              <span className="text-sm font-medium">₹{display.card_offer_price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-sm font-semibold">Your commission</span>
              <span className="text-sm font-bold text-success">₹{display.commission_amount.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              After delivery you'll be reimbursed ₹{display.card_offer_price.toLocaleString()} + commission.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-white/[0.08]">
            <div className="flex items-start gap-2 mb-2">
              <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm font-medium">Ship to this address</p>
            </div>
            {previewLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap pl-6">
                {display.delivery_address || "Address available after you accept"}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={loading || previewLoading || !preview?.delivery_address}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Accepting...
              </>
            ) : (
              "Accept & place order"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
