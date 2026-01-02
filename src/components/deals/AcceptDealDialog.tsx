import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase, Deal } from "@/lib/supabase";
import { Loader2, MapPin } from "lucide-react";

interface AcceptDealDialogProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AcceptDealDialog({ deal, open, onOpenChange, onSuccess }: AcceptDealDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const handleAccept = async () => {
    if (!deal || !deliveryAddress.trim()) {
      toast({ title: "Error", description: "Please enter a delivery address", variant: "destructive" });
      return;
    }

    setLoading(true);

    // Call the accept_deal database function
    const { error } = await supabase.rpc("accept_deal", {
      p_deal_id: deal.id,
      p_delivery_address: deliveryAddress.trim()
    });

    setLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deal Accepted!", description: "You'll receive the admin contact number for coordination" });
      setDeliveryAddress("");
      onSuccess();
    }
  };

  if (!deal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Accept Deal</DialogTitle>
          <DialogDescription>
            You're about to accept the deal for {deal.product_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Deal Summary */}
          <div className="p-4 rounded-xl bg-secondary/50 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Product</span>
              <span className="text-sm font-medium">{deal.product_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Required Card</span>
              <span className="text-sm font-medium">{deal.required_card}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Card Offer Price</span>
              <span className="text-sm font-medium">₹{deal.card_offer_price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-sm font-semibold">Your Commission</span>
              <span className="text-sm font-bold text-success">₹{deal.commission_amount.toLocaleString()}</span>
            </div>
          </div>

          {/* Delivery Address */}
          <div>
            <Label htmlFor="delivery_address">Delivery Address</Label>
            <div className="relative mt-1">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Textarea
                id="delivery_address"
                placeholder="Enter your full delivery address..."
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="pl-10 min-h-[100px]"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              The product will be delivered to this address
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleAccept} disabled={loading} className="flex-1">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Accepting...
              </>
            ) : (
              "Accept Deal"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
