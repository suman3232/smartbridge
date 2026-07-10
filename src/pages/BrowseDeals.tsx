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
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";

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
        <PageHeader
          eyebrow="Browse deals"
          title="Earn with your card"
          description="Accept shopping requests — get reimbursed plus commission after delivery."
          actions={
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search deals or cards…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          }
        />

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="surface p-5 space-y-4">
                <div className="skeleton h-5 w-3/4 rounded" />
                <div className="skeleton h-4 w-1/2 rounded" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="skeleton h-14 rounded-lg" />
                  <div className="skeleton h-14 rounded-lg" />
                </div>
                <div className="skeleton h-9 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="surface">
            <EmptyState
              icon={ShoppingBag}
              title={search ? "No matching deals" : "No open requests right now"}
              description={search ? "Try a different product or card name." : "New shopping requests appear here as shoppers post them. Check back soon."}
            />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDeals.map((deal, i) => (
              <FadeIn key={deal.id} index={Math.min(i, 8)}>
              <Card className="surface-hover h-full">
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
                    Delivery address is shared only after you accept, to protect the shopper's privacy.
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
              </FadeIn>
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
