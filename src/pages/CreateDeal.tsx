import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Link as LinkIcon, CreditCard, IndianRupee, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function CreateDeal() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    product_name: "",
    product_link: "",
    original_price: "",
    card_offer_price: "",
    expected_buy_price: "",
    required_card: "",
    commission_amount: "",
  });

  // Calculate amounts automatically
  const originalPrice = parseFloat(formData.original_price) || 0;
  const cardOfferPrice = parseFloat(formData.card_offer_price) || 0;
  const expectedBuyPrice = parseFloat(formData.expected_buy_price) || 0;
  const commissionAmount = parseFloat(formData.commission_amount) || 0;
  
  // Advance = what merchant pays upfront (card offer price)
  const advanceAmount = cardOfferPrice;
  // Remaining = difference between expected buy price and card offer price
  const remainingAmount = Math.max(0, expectedBuyPrice - cardOfferPrice);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile) {
      toast({ title: "Error", description: "Please log in first", variant: "destructive" });
      return;
    }

    if (advanceAmount <= 0) {
      toast({ title: "Error", description: "Card offer price must be greater than 0", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("deals").insert({
      merchant_id: profile.id,
      product_name: formData.product_name,
      product_link: formData.product_link,
      original_price: originalPrice,
      card_offer_price: cardOfferPrice,
      expected_buy_price: expectedBuyPrice,
      required_card: formData.required_card,
      commission_amount: commissionAmount,
      advance_amount: advanceAmount,
      remaining_amount: remainingAmount,
      status: "pending"
    });

    setLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Deal created and pending admin approval" });
      navigate("/dashboard");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Create a Deal</h1>
            <p className="text-muted-foreground">Find someone with the card you need</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Deal Details</CardTitle>
            <CardDescription>
              Enter the product information and pricing details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Product Info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="product_name">Product Name</Label>
                  <Input
                    id="product_name"
                    name="product_name"
                    placeholder="e.g., iPhone 15 Pro Max"
                    value={formData.product_name}
                    onChange={handleChange}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="product_link">Product Link</Label>
                  <div className="relative mt-1">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="product_link"
                      name="product_link"
                      type="url"
                      placeholder="https://..."
                      value={formData.product_link}
                      onChange={handleChange}
                      required
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="required_card">Required Card</Label>
                  <div className="relative mt-1">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="required_card"
                      name="required_card"
                      placeholder="e.g., HDFC Infinia, ICICI Amazon Pay"
                      value={formData.required_card}
                      onChange={handleChange}
                      required
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-4">Pricing Details</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="original_price">Original Price (₹)</Label>
                    <div className="relative mt-1">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="original_price"
                        name="original_price"
                        type="number"
                        placeholder="0"
                        value={formData.original_price}
                        onChange={handleChange}
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="card_offer_price">Card Offer Price (₹)</Label>
                    <div className="relative mt-1">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="card_offer_price"
                        name="card_offer_price"
                        type="number"
                        placeholder="0"
                        value={formData.card_offer_price}
                        onChange={handleChange}
                        required
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Price after card discount</p>
                  </div>

                  <div>
                    <Label htmlFor="expected_buy_price">Expected Buy Price (₹)</Label>
                    <div className="relative mt-1">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="expected_buy_price"
                        name="expected_buy_price"
                        type="number"
                        placeholder="0"
                        value={formData.expected_buy_price}
                        onChange={handleChange}
                        required
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">What you're willing to pay</p>
                  </div>

                  <div>
                    <Label htmlFor="commission_amount">Commission Amount (₹)</Label>
                    <div className="relative mt-1">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="commission_amount"
                        name="commission_amount"
                        type="number"
                        placeholder="0"
                        value={formData.commission_amount}
                        onChange={handleChange}
                        required
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Customer's earning</p>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl bg-secondary/50 space-y-2">
                <h4 className="font-semibold">Payment Summary</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Advance Amount</span>
                  <span className="font-medium">₹{advanceAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Remaining Amount</span>
                  <span className="font-medium">₹{remainingAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Total to be Locked</span>
                  <span className="font-bold">₹{(advanceAmount + remainingAmount).toLocaleString()}</span>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Deal...
                  </>
                ) : (
                  "Create Deal"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
