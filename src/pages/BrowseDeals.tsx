import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase, OpenDeal } from "@/lib/supabase";
import {
  Search,
  CreditCard,
  IndianRupee,
  ArrowRight,
  ShoppingBag,
  Phone,
  ExternalLink,
} from "lucide-react";
import { AcceptDealDialog } from "@/components/deals/AcceptDealDialog";
import { Navbar } from "@/components/layout/Navbar";

function BrowseDealsContent({
  profile,
  user,
  navigate,
  toast,
}: {
  profile: ReturnType<typeof useAuth>["profile"];
  user: ReturnType<typeof useAuth>["user"];
  navigate: ReturnType<typeof useNavigate>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [deals, setDeals] = useState<OpenDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<OpenDeal | null>(null);

  const fetchDeals = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_open_deals");

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data) {
      setDeals(data as OpenDeal[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchDeals();
  }, []);

  const handleAcceptClick = (deal: OpenDeal) => {
    if (!user) {
      navigate("/auth", { state: { from: "/deals" } });
      return;
    }
    if (deal.merchant_id === profile?.id) {
      toast({ title: "Can't accept", description: "You can't accept your own shopping request.", variant: "destructive" });
      return;
    }
    setSelectedDeal(deal);
  };

  const filteredDeals = deals.filter(
    (deal) =>
      deal.product_name.toLowerCase().includes(search.toLowerCase()) ||
      deal.required_card.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Earn with your card</h1>
            <p className="text-muted-foreground">
              Accept shopping requests — get reimbursed + commission after delivery
            </p>
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
              <h3 className="text-lg font-semibold mb-1">No open requests</h3>
              <p className="text-muted-foreground text-center">
                {search ? "No deals match your search" : "Check back when shoppers post new requests"}
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
                    <Badge variant="approved" className="capitalize">
                      open
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-secondary/50">
                      <p className="text-xs text-muted-foreground">You pay at checkout</p>
                      <p className="font-semibold">₹{deal.card_offer_price.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-success/10">
                      <p className="text-xs text-success">Your commission</p>
                      <p className="font-semibold text-success">₹{deal.commission_amount.toLocaleString()}</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Delivery address shared after you accept (Yaper-style privacy).
                  </p>

                  {deal.admin_contact_number && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/30">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Support: {deal.admin_contact_number}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <a
                      href={deal.product_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button variant="outline" className="w-full">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Product
                      </Button>
                    </a>
                    <Button className="flex-1" onClick={() => handleAcceptClick(deal)}>
                      Accept
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!user && (
          <Card className="border-primary/20">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
              <p className="text-sm text-muted-foreground">
                Sign in to accept deals and earn commission on your cards.
              </p>
              <Link to="/auth" state={{ from: "/deals" }}>
                <Button size="sm">Sign in to earn</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      <AcceptDealDialog
        deal={selectedDeal}
        open={!!selectedDeal}
        onOpenChange={(open) => !open && setSelectedDeal(null)}
        onSuccess={() => {
          setSelectedDeal(null);
          void fetchDeals();
        }}
      />
    </>
  );
}

export default function BrowseDeals() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const content = (
    <BrowseDealsContent
      profile={profile}
      user={user}
      navigate={navigate}
      toast={toast}
    />
  );

  if (user) {
    return <DashboardLayout>{content}</DashboardLayout>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {content}
      </main>
    </div>
  );
}
