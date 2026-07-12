import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase, Deal, KYC, Wallet, DEAL_SAFE_COLUMNS } from "@/lib/supabase";
import {
  PlusCircle,
  ShoppingBag,
  Wallet as WalletIcon,
  TrendingUp,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowUpRight,
  LineChart,
  Gift,
  ShieldCheck,
} from "lucide-react";

export default function Dashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [kyc, setKyc] = useState<KYC | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) {
        setLoading(false);
        return;
      }
      const [dealsRes, walletRes, kycRes] = await Promise.all([
        supabase.from("deals").select(DEAL_SAFE_COLUMNS)
          .or(`merchant_id.eq.${profile.id},customer_id.eq.${profile.id}`)
          .order("created_at", { ascending: false }).limit(6),
        supabase.from("wallets").select("*").eq("user_id", profile.id).maybeSingle(),
        supabase.from("kycs").select("*").eq("user_id", profile.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const firstError = dealsRes.error || walletRes.error || kycRes.error;
      if (firstError) {
        toast({ title: "Couldn't load dashboard", description: firstError.message, variant: "destructive" });
      }
      if (dealsRes.data) setDeals(dealsRes.data as unknown as Deal[]);
      if (walletRes.data) setWallet(walletRes.data as Wallet);
      if (kycRes.data) setKyc(kycRes.data as KYC);
      setLoading(false);
    };
    fetchData();
  }, [profile, toast]);

  const asShopper = deals.filter((d) => d.merchant_id === profile?.id);
  const asCardHolder = deals.filter((d) => d.customer_id === profile?.id);
  const pending = asShopper.filter((d) => d.status === "pending").length;
  const active = deals.filter((d) => ["approved", "accepted", "in_progress"].includes(d.status)).length;

  const statusVariant = (status: string) =>
    ({ approved: "approved", pending: "pending", rejected: "rejected", completed: "success" } as const)[status] ?? "secondary";

  const prefersEarn = profile?.preferred_role === "accept_deals";
  const prefersShop = profile?.preferred_role === "create_deals";
  const balance = wallet?.balance ?? 0;
  const locked = wallet?.locked_amount ?? 0;

  const stats = [
    { label: "Requests posted", value: asShopper.length, sub: pending > 0 ? `${pending} awaiting approval` : "as shopper", icon: PlusCircle },
    { label: "Deals accepted", value: asCardHolder.length, sub: "as card holder", icon: ShoppingBag },
    { label: "Active", value: active, sub: "in progress", icon: TrendingUp },
  ];

  const quickLinks = [
    ...(prefersShop || profile?.preferred_role === "both" ? [{ to: "/create-deal", label: "Post a request", icon: PlusCircle }] : []),
    ...(prefersEarn || profile?.preferred_role === "both" ? [{ to: "/deals", label: "Browse deals", icon: ShoppingBag }] : []),
    { to: "/tracker", label: "Price tracker", icon: LineChart },
    { to: "/refer", label: "Refer & earn", icon: Gift },
  ];

  const primary = prefersEarn
    ? { to: "/deals", label: "Browse deals" }
    : { to: "/create-deal", label: "Post a request" };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Dashboard"
          title={<>Welcome back, <span className="gradient-text">{profile?.full_name?.split(" ")[0] ?? "there"}</span></>}
          description={
            prefersEarn
              ? "Accept open deals and earn reimbursement + commission on your cards."
              : prefersShop
                ? "Post shopping requests and track your card-holder payouts."
                : "Shop with card discounts, or earn by placing orders for others."
          }
          actions={
            <Button asChild className="press">
              <Link to={primary.to}>{primary.label}<ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
          }
        />

        {/* KYC status strip */}
        {!loading && !kyc && (
          <FadeIn className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-warning/25 bg-warning/[0.06]">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15 text-warning"><AlertCircle className="h-5 w-5" /></div>
              <div>
                <p className="text-sm font-semibold">Verify your identity to withdraw</p>
                <p className="text-xs text-muted-foreground">Add your PAN and bank details — takes 2 minutes.</p>
              </div>
            </div>
            <Button asChild size="sm" variant="warning" className="press self-start sm:self-auto">
              <Link to="/kyc">Complete KYC <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </FadeIn>
        )}
        {!loading && kyc?.status === "pending" && (
          <FadeIn className="surface flex items-center gap-3 p-4 border-warning/25 bg-warning/[0.05]">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15 text-warning"><Clock className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-semibold">KYC under review</p>
              <p className="text-xs text-muted-foreground">Usually verified within 24–48 hours.</p>
            </div>
          </FadeIn>
        )}
        {!loading && kyc?.status === "approved" && (
          <FadeIn className="surface flex items-center gap-3 p-3.5 border-success/20 bg-success/[0.05]">
            <ShieldCheck className="h-5 w-5 text-success" />
            <p className="text-sm"><span className="font-semibold text-success">Identity verified.</span> <span className="text-muted-foreground">You can withdraw earnings anytime.</span></p>
          </FadeIn>
        )}

        {/* Wallet panel + stat rail (asymmetric) */}
        <div className="grid gap-4 lg:grid-cols-3">
          <FadeIn index={1} className="lg:col-span-2">
            <div className="surface relative h-full overflow-hidden p-6">
              <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-primary/15 blur-2xl" aria-hidden />
              <div className="relative">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <WalletIcon className="h-4 w-4" /> Wallet balance
                </div>
                {loading ? (
                  <div className="skeleton mt-3 h-11 w-40 rounded-lg" />
                ) : (
                  <p className="num mt-2 text-4xl font-bold sm:text-5xl">₹{balance.toLocaleString()}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {locked > 0 && <span className="num">₹{locked.toLocaleString()} pending withdrawal</span>}
                  <span>{kyc?.status === "approved" ? "Ready to withdraw" : "Withdraw after KYC"}</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild size="sm" className="press"><Link to="/wallet"><ArrowUpRight className="mr-1.5 h-4 w-4" /> Withdraw</Link></Button>
                  <Button asChild size="sm" variant="outline" className="press"><Link to="/wallet">Transactions</Link></Button>
                </div>
              </div>
            </div>
          </FadeIn>

          <FadeIn index={2}>
            <div className="surface h-full divide-y divide-border/50">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/70 text-muted-foreground">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground/70">{s.sub}</p>
                  </div>
                  {loading ? <div className="skeleton h-6 w-8 rounded" /> : <p className="num text-2xl font-bold">{s.value}</p>}
                </div>
              ))}
            </div>
          </FadeIn>
        </div>

        {/* Quick links — compact chips (not big repeated cards) */}
        <FadeIn index={3} className="flex flex-wrap gap-2">
          {quickLinks.map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="press group inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-card/60 px-4 py-2 text-sm font-medium text-foreground/90 transition-colors hover:border-primary/30 hover:bg-primary/[0.06]"
            >
              <q.icon className="h-4 w-4 text-primary" />
              {q.label}
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </FadeIn>

        {/* Recent activity */}
        <FadeIn index={4}>
          <div className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
              <div>
                <h2 className="font-display text-base font-bold">Recent activity</h2>
                <p className="text-xs text-muted-foreground">Your latest deals</p>
              </div>
              {deals.length > 0 && (
                <Button asChild variant="ghost" size="sm"><Link to="/deals">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
              )}
            </div>
            <div className="p-2">
              {loading ? (
                <div className="space-y-1.5 p-2">
                  {[0, 1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
                </div>
              ) : deals.length === 0 ? (
                <EmptyState
                  icon={ShoppingBag}
                  title="No activity yet"
                  description="Post a request or accept a deal — it'll show up here."
                  action={
                    <Button asChild size="sm" className="press">
                      <Link to={primary.to}>{primary.label}</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="divide-y divide-border/40">
                  {deals.map((deal) => (
                    <Link
                      key={deal.id}
                      to={`/deals/${deal.id}`}
                      className="press flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-secondary/40"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <ShoppingBag className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{deal.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {deal.merchant_id === profile?.id ? "You posted this" : "You accepted this"}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={statusVariant(deal.status)} className="capitalize">{deal.status.replace("_", " ")}</Badge>
                        <p className="num mt-1 text-sm font-medium">₹{deal.card_offer_price.toLocaleString()}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </FadeIn>
      </div>
    </DashboardLayout>
  );
}
