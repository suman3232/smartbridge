import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Deal, KYC, Wallet } from "@/lib/supabase";
import {
  PlusCircle,
  ShoppingBag,
  Wallet as WalletIcon,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  FileCheck
} from "lucide-react";

export default function Dashboard() {
  const { profile } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [kyc, setKyc] = useState<KYC | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;

      const [dealsRes, walletRes, kycRes] = await Promise.all([
        supabase
          .from("deals")
          .select("*")
          .or(`merchant_id.eq.${profile.id},customer_id.eq.${profile.id}`)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("wallets")
          .select("*")
          .eq("user_id", profile.id)
          .maybeSingle(),
        supabase
          .from("kycs")
          .select("*")
          .eq("user_id", profile.id)
          .maybeSingle()
      ]);

      if (dealsRes.data) setDeals(dealsRes.data as Deal[]);
      if (walletRes.data) setWallet(walletRes.data as Wallet);
      if (kycRes.data) setKyc(kycRes.data as KYC);
      
      setLoading(false);
    };

    fetchData();
  }, [profile]);

  const myDealsAsManager = deals.filter(d => d.merchant_id === profile?.id);
  const myDealsAsCustomer = deals.filter(d => d.customer_id === profile?.id);
  const pendingDeals = myDealsAsManager.filter(d => d.status === "pending");
  const activeDeals = deals.filter(d => ["approved", "accepted", "in_progress"].includes(d.status));

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "approved": return "approved";
      case "pending": return "pending";
      case "rejected": return "rejected";
      case "completed": return "success";
      default: return "secondary";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back, <span className="gradient-text">{profile?.full_name?.split(" ")[0]}</span>!
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your deals today.
          </p>
        </div>

        {/* KYC Alert */}
        {!kyc && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="font-semibold">Complete Your KYC</p>
                  <p className="text-sm text-muted-foreground">Verify your identity to start creating deals</p>
                </div>
              </div>
              <Link to="/kyc">
                <Button variant="warning" size="sm">
                  Complete KYC
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {kyc && kyc.status === "pending" && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="font-semibold">KYC Under Review</p>
                <p className="text-sm text-muted-foreground">Your documents are being verified. This usually takes 24-48 hours.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:-translate-y-1 transition-transform duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Wallet Balance</p>
                  <p className="text-3xl font-bold mt-1">₹{wallet?.balance?.toLocaleString() || "0"}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center">
                  <WalletIcon className="w-6 h-6 text-success" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Locked: ₹{wallet?.locked_amount?.toLocaleString() || "0"}
              </p>
            </CardContent>
          </Card>

          <Card className="hover:-translate-y-1 transition-transform duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">My Deals Created</p>
                  <p className="text-3xl font-bold mt-1">{myDealsAsManager.length}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <PlusCircle className="w-6 h-6 text-primary" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {pendingDeals.length} pending approval
              </p>
            </CardContent>
          </Card>

          <Card className="hover:-translate-y-1 transition-transform duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Deals Accepted</p>
                  <p className="text-3xl font-bold mt-1">{myDealsAsCustomer.length}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-accent" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Earning commission
              </p>
            </CardContent>
          </Card>

          <Card className="hover:-translate-y-1 transition-transform duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Deals</p>
                  <p className="text-3xl font-bold mt-1">{activeDeals.length}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                In progress
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Link to="/create-deal">
            <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center group-hover:shadow-glow transition-shadow duration-300">
                  <PlusCircle className="w-7 h-7 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Create a Deal</h3>
                  <p className="text-sm text-muted-foreground">Find someone with the card you need</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </Link>

          <Link to="/deals">
            <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center group-hover:bg-accent/30 transition-colors duration-300">
                  <ShoppingBag className="w-7 h-7 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Browse Deals</h3>
                  <p className="text-sm text-muted-foreground">Accept deals and earn commission</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground ml-auto group-hover:text-accent transition-colors" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Deals */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Deals</CardTitle>
                <CardDescription>Your latest deal activity</CardDescription>
              </div>
              <Link to="/deals">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-secondary/50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : deals.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No deals yet</p>
                <p className="text-sm text-muted-foreground">Create or browse deals to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deals.slice(0, 5).map((deal) => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ShoppingBag className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{deal.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {deal.merchant_id === profile?.id ? "Created by you" : "Accepted by you"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={getStatusVariant(deal.status)} className="capitalize">
                        {deal.status.replace("_", " ")}
                      </Badge>
                      <p className="text-sm font-medium mt-1">₹{deal.card_offer_price}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
