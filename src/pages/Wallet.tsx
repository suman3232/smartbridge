import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Wallet as WalletType } from "@/lib/supabase";
import { 
  Wallet as WalletIcon, 
  Lock,
  ArrowUpRight,
  ArrowDownLeft,
  IndianRupee,
  History
} from "lucide-react";

type Payment = {
  id: string;
  amount: number;
  payment_type: string;
  status: string;
  description: string | null;
  from_user_id: string | null;
  to_user_id: string | null;
  created_at: string;
};

export default function Wallet() {
  const { profile } = useAuth();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    if (!profile) return;

    const [walletRes, paymentsRes] = await Promise.all([
      supabase
        .from("wallets")
        .select("*")
        .eq("user_id", profile.id)
        .maybeSingle(),
      supabase
        .from("payments")
        .select("*")
        .or(`from_user_id.eq.${profile.id},to_user_id.eq.${profile.id}`)
        .order("created_at", { ascending: false })
        .limit(20)
    ]);

    if (walletRes.data) setWallet(walletRes.data as WalletType);
    if (paymentsRes.data) setPayments(paymentsRes.data as Payment[]);
    setLoading(false);
  };

  const getPaymentStatusVariant = (status: string) => {
    switch (status) {
      case "released": return "success";
      case "locked": return "pending";
      case "refunded": return "secondary";
      default: return "secondary";
    }
  };

  const isIncoming = (payment: Payment) => payment.to_user_id === profile?.id;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Wallet</h1>
          <p className="text-muted-foreground">Manage your funds and transactions</p>
        </div>

        {/* Balance Cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="gradient-bg p-6 text-primary-foreground">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm opacity-80">Available Balance</p>
                  <WalletIcon className="w-6 h-6 opacity-70" />
                </div>
                <p className="text-4xl font-bold">₹{wallet?.balance?.toLocaleString() || "0"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">Locked Funds</p>
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-warning" />
                </div>
              </div>
              <p className="text-3xl font-bold">₹{wallet?.locked_amount?.toLocaleString() || "0"}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Funds held in escrow for active deals
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-muted-foreground" />
              <CardTitle>Transaction History</CardTitle>
            </div>
            <CardDescription>Your recent payments and transfers</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-secondary/50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                  <IndianRupee className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No transactions yet</p>
                <p className="text-sm text-muted-foreground">Your payment history will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isIncoming(payment) ? "bg-success/10" : "bg-destructive/10"
                      }`}>
                        {isIncoming(payment) ? (
                          <ArrowDownLeft className="w-5 h-5 text-success" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{payment.payment_type.replace("_", " ")}</p>
                        <p className="text-sm text-muted-foreground">
                          {payment.description || "Payment"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${isIncoming(payment) ? "text-success" : ""}`}>
                        {isIncoming(payment) ? "+" : "-"}₹{payment.amount.toLocaleString()}
                      </p>
                      <Badge variant={getPaymentStatusVariant(payment.status)} className="capitalize mt-1">
                        {payment.status}
                      </Badge>
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
