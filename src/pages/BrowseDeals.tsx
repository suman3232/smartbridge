import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Deal } from "@/lib/supabase";
import { 
  Search, 
  CreditCard, 
  IndianRupee, 
  ArrowRight,
  ShoppingBag,
  Phone,
  ExternalLink
} from "lucide-react";
import { AcceptDealDialog } from "@/components/deals/AcceptDealDialog";

export default function BrowseDeals() {
  const { profile } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async () => {
    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .eq("status", "approved")
      .is("customer_id", null)
      .order("created_at", { ascending: false });

    if (data) setDeals(data as Deal[]);
    setLoading(false);
  };

  const filteredDeals = deals.filter(deal => 
    deal.product_name.toLowerCase().includes(search.toLowerCase()) ||
    deal.required_card.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "approved": return "approved";
      case "accepted": return "secondary";
      default: return "secondary";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Browse Deals</h1>
            <p className="text-muted-foreground">Find deals matching your cards</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search deals or cards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Deals Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-secondary rounded w-3/4 mb-4" />
                  <div className="h-4 bg-secondary rounded w-1/2 mb-2" />
                  <div className="h-4 bg-secondary rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredDeals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                <ShoppingBag className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No Deals Available</h3>
              <p className="text-muted-foreground text-center">
                {search ? "No deals match your search" : "Check back later for new deals"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDeals.map((deal) => (
              <Card key={deal.id} className="hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{deal.product_name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <CreditCard className="w-3 h-3" />
                        {deal.required_card}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusVariant(deal.status)} className="capitalize">
                      {deal.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Pricing */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-secondary/50">
                      <p className="text-xs text-muted-foreground">Original</p>
                      <p className="font-semibold line-through text-muted-foreground">
                        ₹{deal.original_price.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-success/10">
                      <p className="text-xs text-success">Card Price</p>
                      <p className="font-semibold text-success">
                        ₹{deal.card_offer_price.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Commission */}
                  <div className="p-4 rounded-xl gradient-bg text-primary-foreground">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs opacity-80">Your Commission</p>
                        <p className="text-xl font-bold">₹{deal.commission_amount.toLocaleString()}</p>
                      </div>
                      <IndianRupee className="w-8 h-8 opacity-50" />
                    </div>
                  </div>

                  {/* Admin Contact */}
                  {deal.admin_contact_number && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/30">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Contact: {deal.admin_contact_number}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <a 
                      href={deal.product_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button variant="outline" className="w-full">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Product
                      </Button>
                    </a>
                    <Button 
                      className="flex-1"
                      onClick={() => setSelectedDeal(deal)}
                      disabled={deal.merchant_id === profile?.id}
                    >
                      Accept Deal
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Accept Deal Dialog */}
      <AcceptDealDialog
        deal={selectedDeal}
        open={!!selectedDeal}
        onOpenChange={(open) => !open && setSelectedDeal(null)}
        onSuccess={() => {
          setSelectedDeal(null);
          fetchDeals();
        }}
      />
    </DashboardLayout>
  );
}
