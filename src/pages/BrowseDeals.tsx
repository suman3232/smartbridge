import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase, OpenDeal, MyReservationStatus } from "@/lib/supabase";
import {
  Search,
  CreditCard,
  IndianRupee,
  ArrowRight,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import { AcceptDealDialog } from "@/components/deals/AcceptDealDialog";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { ReservationCountdown } from "@/components/deals/ReservationCountdown";
import { useSupportWhatsApp } from "@/lib/settings";
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
  const supportNumber = useSupportWhatsApp();
  const [selectedDeal, setSelectedDeal] = useState<OpenDeal | null>(null);
  const [myStatus, setMyStatus] = useState<MyReservationStatus | null>(null);

  const fetchDeals = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase.rpc("list_open_deals");

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data) {
      setDeals(data as OpenDeal[]);
    }
    if (!silent) setLoading(false);
  };

  const fetchMyStatus = async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("get_my_reservation_status");
    // On error keep the previous status rather than silently dropping the
    // cooldown/active-reservation banners.
    if (!error) setMyStatus((data?.[0] as MyReservationStatus) ?? null);
  };

  useEffect(() => {
    void fetchDeals();
    void fetchMyStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compare against the SERVER clock (skew-corrected) so a wrong device clock
  // can neither hide nor prolong the cooldown banner.
  const statusSkew = myStatus?.server_now ? Date.parse(myStatus.server_now) - Date.now() : 0;
  const cooldownUntil = myStatus?.blocked_until ? new Date(myStatus.blocked_until) : null;
  const onCooldown = !!cooldownUntil && cooldownUntil.getTime() > Date.now() + statusSkew;
  const hasActiveReservation = !!myStatus?.active_deal_id;

  // Refresh the status shortly after the cooldown lapses so the banner clears
  // and Accept re-enables without a manual reload.
  useEffect(() => {
    if (!onCooldown || !cooldownUntil) return;
    const ms = Math.min(cooldownUntil.getTime() - (Date.now() + statusSkew) + 1500, 2 ** 31 - 1);
    const t = window.setTimeout(() => void fetchMyStatus(), Math.max(ms, 1000));
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStatus?.blocked_until]);

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
          description="Accept shopping requests — get reimbursed plus your reward after delivery."
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

        {onCooldown && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-destructive">Acceptance paused</p>
              <p className="text-sm text-muted-foreground">
                After missed reservations, you can accept new deals again after {cooldownUntil!.toLocaleString()}.
                {myStatus?.under_review ? " Your account is also under admin review." : ""}
              </p>
            </CardContent>
          </Card>
        )}

        {myStatus?.active_deal_id && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-sm text-muted-foreground">
                You have an active reservation on <span className="font-medium text-foreground">{myStatus.active_product_name}</span> — finish or release it first.
              </p>
              <div className="flex items-center gap-3">
                {myStatus.active_reserved_until && (
                  <ReservationCountdown
                    reservedUntil={myStatus.active_reserved_until}
                    serverNow={myStatus.server_now}
                    onExpire={() => { void fetchDeals(true); void fetchMyStatus(); }}
                  />
                )}
                <Link to={`/deals/${myStatus.active_deal_id}`}>
                  <Button size="sm" variant="outline">Open</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

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
                    <Badge variant={deal.is_reserved ? "secondary" : "approved"} className="capitalize">
                      {deal.is_reserved ? "Reserved" : "open"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Cardholder decision info ONLY — no platform fee, no buyer total. */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-secondary/50">
                      <p className="text-xs text-muted-foreground">You spend</p>
                      <p className="font-semibold">₹{deal.card_offer_price.toLocaleString()}</p>
                      <p className="text-[11px] text-muted-foreground line-through">₹{deal.original_price.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-success/10">
                      <p className="text-xs text-success">Your reward</p>
                      <p className="font-semibold text-success">₹{deal.commission_amount.toLocaleString()}</p>
                      <p className="text-[11px] text-success/80">
                        Payout ₹{(deal.card_offer_price + deal.commission_amount).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {deal.offer_details && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{deal.offer_details}</p>
                  )}

                  {deal.is_reserved ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary/40 p-3">
                      <span className="text-xs text-muted-foreground">Reserved — frees up in</span>
                      {deal.reserved_until && (
                        <ReservationCountdown
                          reservedUntil={deal.reserved_until}
                          serverNow={deal.server_now}
                          onExpire={() => { void fetchDeals(true); }}
                        />
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Delivery address is shared only after you accept, to protect the shopper's privacy.
                      </p>

                      {supportNumber && (
                        <WhatsAppButton
                          phone={supportNumber}
                          message={`Hi, I need help with the OfferBridge deal "${deal.product_name}".`}
                          label="Chat with support"
                          className="w-full"
                        />
                      )}
                    </>
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
                    {deal.is_reserved ? (
                      deal.id === myStatus?.active_deal_id ? (
                        <Link to={`/deals/${deal.id}`} className="flex-1">
                          <Button className="w-full">
                            Your reservation
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </Link>
                      ) : (
                        <Button variant="outline" className="flex-1" disabled>
                          Reserved
                        </Button>
                      )
                    ) : (
                      <Button
                        className="flex-1"
                        onClick={() => handleAcceptClick(deal)}
                        disabled={onCooldown || hasActiveReservation}
                        title={hasActiveReservation ? "Finish or release your current reservation first" : undefined}
                      >
                        Accept
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
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
