import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase, Wallet as WalletType, KYC, WithdrawalRequest } from "@/lib/supabase";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  IndianRupee,
  History,
  Loader2,
  FileCheck,
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
  const { toast } = useToast();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [kyc, setKyc] = useState<KYC | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const fetchData = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    const [walletRes, kycRes, paymentsRes, withdrawalsRes] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", profile.id).maybeSingle(),
      supabase
        .from("kycs")
        .select("*")
        .eq("user_id", profile.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("payments")
        .select("*")
        .or(`from_user_id.eq.${profile.id},to_user_id.eq.${profile.id}`)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const firstError = walletRes.error || paymentsRes.error || withdrawalsRes.error;
    if (firstError) {
      toast({ title: "Couldn't load wallet", description: firstError.message, variant: "destructive" });
    }

    if (walletRes.data) setWallet(walletRes.data as WalletType);
    if (kycRes.data) setKyc(kycRes.data as KYC);
    if (paymentsRes.data) setPayments(paymentsRes.data as Payment[]);
    if (withdrawalsRes.data) setWithdrawals(withdrawalsRes.data as WithdrawalRequest[]);
    setLoading(false);
  };

  const hasPendingWithdrawal = withdrawals.some((w) => w.status === "pending");

  useEffect(() => {
    void fetchData();
  }, [profile]);

  const handleWithdraw = async () => {
    const amount = Math.round((parseFloat(withdrawAmount) || 0) * 100) / 100;
    if (!amount || amount <= 0) {
      toast({ title: "Invalid amount", description: "Enter a valid withdrawal amount.", variant: "destructive" });
      return;
    }
    if (amount > (wallet?.balance ?? 0)) {
      toast({ title: "Amount exceeds balance", description: `You can withdraw up to ₹${(wallet?.balance ?? 0).toLocaleString()}.`, variant: "destructive" });
      return;
    }
    if (hasPendingWithdrawal) {
      toast({ title: "Withdrawal pending", description: "You already have a withdrawal awaiting transfer.", variant: "destructive" });
      return;
    }

    setWithdrawing(true);
    const { error } = await supabase.rpc("request_withdrawal", { p_amount: amount });
    setWithdrawing(false);

    if (error) {
      toast({ title: "Withdrawal failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Withdrawal requested", description: "Admin will transfer to your verified bank account." });
      setWithdrawAmount("");
      void fetchData();
    }
  };

  const getPaymentStatusVariant = (status: string) => {
    switch (status) {
      case "released":
        return "success";
      case "locked":
        return "pending";
      case "refunded":
        return "secondary";
      default:
        return "secondary";
    }
  };

  // A withdrawal has from_user_id === to_user_id === the user, but it is money
  // LEAVING the wallet, so it must read as outgoing.
  const isIncoming = (payment: Payment) =>
    payment.payment_type !== "withdrawal" && payment.to_user_id === profile?.id;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Wallet</h1>
          <p className="text-muted-foreground">Reimbursement + reward from completed deals</p>
        </div>

        <Card className="overflow-hidden max-w-md">
          <CardContent className="p-0">
            <div className="gradient-bg p-6 text-primary-foreground">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm opacity-80">Available balance</p>
                <WalletIcon className="w-6 h-6 opacity-70" />
              </div>
              {loading ? (
                <div className="skeleton h-10 w-36 rounded-lg" style={{ background: "rgba(255,255,255,0.15)" }} />
              ) : (
                <p className="num text-4xl font-bold">₹{(wallet?.balance ?? 0).toLocaleString()}</p>
              )}
              {wallet && wallet.locked_amount > 0 && (
                <p className="num text-xs opacity-80 mt-2">
                  ₹{wallet.locked_amount.toLocaleString()} pending withdrawal
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {kyc ? (
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="text-lg">Withdraw to bank</CardTitle>
              <CardDescription>Transfer earnings to your verified account ({kyc.bank_name})</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="withdraw">Amount (₹)</Label>
                <Input
                  id="withdraw"
                  type="number"
                  min="1"
                  max={wallet?.balance ?? 0}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="mt-1"
                />
              </div>
              <Button onClick={handleWithdraw} disabled={withdrawing || !wallet?.balance || hasPendingWithdrawal} className="w-full">
                {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : hasPendingWithdrawal ? "Withdrawal pending" : "Request withdrawal"}
              </Button>
              {hasPendingWithdrawal && (
                <p className="text-xs text-muted-foreground">A withdrawal is awaiting admin transfer. You can request again once it's processed.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="max-w-md border-warning/30">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <FileCheck className="w-5 h-5 text-warning" />
                <p className="text-sm text-muted-foreground">Complete KYC to withdraw earnings</p>
              </div>
              <Link to="/kyc">
                <Button size="sm" variant="warning">
                  Verify KYC
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {withdrawals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Withdrawal requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {withdrawals.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 text-sm">
                  <span>₹{req.amount.toLocaleString()}</span>
                  <Badge className="capitalize">{req.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-muted-foreground" />
              <CardTitle>Transaction History</CardTitle>
            </div>
            <CardDescription>Reimbursements, rewards, and withdrawals</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-secondary/50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : payments.length === 0 ? (
              <EmptyState
                icon={IndianRupee}
                title="No transactions yet"
                description="Reimbursements, cardholder rewards, and referral rewards will appear here as you complete deals."
                compact
              />
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isIncoming(payment) ? "bg-success/10" : "bg-destructive/10"
                        }`}
                      >
                        {isIncoming(payment) ? (
                          <ArrowDownLeft className="w-5 h-5 text-success" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{payment.payment_type.replace("_", " ")}</p>
                        <p className="text-sm text-muted-foreground">{payment.description || "Payment"}</p>
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
