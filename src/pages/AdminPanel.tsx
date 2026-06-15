import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase, Deal, KYC, WithdrawalRequest } from "@/lib/supabase";
import { 
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  CreditCard,
  IndianRupee,
  Loader2,
  Package,
  FileCheck,
  Banknote,
} from "lucide-react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

export default function AdminPanel() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [deals, setDeals] = useState<Deal[]>([]);
  const [kycs, setKycs] = useState<KYC[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; dealId: string | null; notes: string }>({
    open: false,
    dealId: null,
    notes: ""
  });

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      void fetchAll();
    }
  }, [isAdmin]);

  const fetchAll = async () => {
    setLoading(true);
    const [dealsRes, kycRes, withdrawalsRes] = await Promise.all([
      supabase.from("deals").select("*").order("created_at", { ascending: false }),
      supabase.from("kycs").select("*").order("created_at", { ascending: false }),
      supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false }),
    ]);

    if (dealsRes.error) {
      toast({ title: "Error", description: dealsRes.error.message, variant: "destructive" });
    } else if (dealsRes.data) {
      setDeals(dealsRes.data as Deal[]);
    }

    if (kycRes.data) setKycs(kycRes.data as KYC[]);
    if (withdrawalsRes.data) setWithdrawals(withdrawalsRes.data as WithdrawalRequest[]);
    setLoading(false);
  };

  const fetchDeals = fetchAll;

  const handleApprove = async (dealId: string) => {
    setActionLoading(dealId);
    
    const { error } = await supabase.rpc("approve_deal", { deal_id: dealId });
    
    setActionLoading(null);
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deal Approved", description: "Admin number has been assigned" });
      fetchDeals();
    }
  };

  const handleReject = async () => {
    if (!rejectDialog.dealId) return;
    
    setActionLoading(rejectDialog.dealId);
    
    const { error } = await supabase.rpc("reject_deal", { 
      deal_id: rejectDialog.dealId,
      rejection_notes: rejectDialog.notes || null
    });
    
    setActionLoading(null);
    setRejectDialog({ open: false, dealId: null, notes: "" });
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deal Rejected", description: "Shopper has been notified" });
      fetchDeals();
    }
  };

  const handleComplete = async (dealId: string) => {
    setActionLoading(dealId);

    const { error } = await supabase.rpc("complete_deal", { p_deal_id: dealId });

    setActionLoading(null);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deal completed", description: "Reimbursement + commission credited to card holder wallet" });
      void fetchAll();
    }
  };

  const handleApproveKyc = async (kycId: string) => {
    setActionLoading(kycId);
    const { error } = await supabase.rpc("approve_kyc", { p_kyc_id: kycId });
    setActionLoading(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "KYC approved" });
      void fetchAll();
    }
  };

  const handleRejectKyc = async (kycId: string) => {
    setActionLoading(kycId);
    const { error } = await supabase.rpc("reject_kyc", {
      p_kyc_id: kycId,
      p_notes: "Please resubmit with correct bank details.",
    });
    setActionLoading(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "KYC rejected" });
      void fetchAll();
    }
  };

  const handleCompleteWithdrawal = async (requestId: string) => {
    setActionLoading(requestId);
    const { error } = await supabase.rpc("complete_withdrawal", { p_request_id: requestId });
    setActionLoading(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Withdrawal completed", description: "Marked as transferred to bank" });
      void fetchAll();
    }
  };

  const pendingDeals = deals.filter((d) => d.status === "pending");
  const pendingKycs = kycs.filter((k) => k.status === "pending");
  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending");
  const activeDeals = deals.filter((d) => ["approved", "accepted", "in_progress"].includes(d.status));
  const completedDeals = deals.filter((d) => ["completed", "rejected", "cancelled"].includes(d.status));

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "approved": return "approved";
      case "pending": return "pending";
      case "rejected": return "rejected";
      case "completed": return "success";
      case "accepted": return "secondary";
      case "in_progress": return "secondary";
      default: return "secondary";
    }
  };

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) return null;

  const DealCard = ({ deal }: { deal: Deal }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold">{deal.product_name}</h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <CreditCard className="w-3 h-3" />
              {deal.required_card}
            </div>
          </div>
          <Badge variant={getStatusVariant(deal.status)} className="capitalize">
            {deal.status.replace("_", " ")}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="p-2 rounded-lg bg-secondary/50 text-center">
            <p className="text-xs text-muted-foreground">Original</p>
            <p className="text-sm font-medium">₹{deal.original_price.toLocaleString()}</p>
          </div>
          <div className="p-2 rounded-lg bg-secondary/50 text-center">
            <p className="text-xs text-muted-foreground">Card Price</p>
            <p className="text-sm font-medium">₹{deal.card_offer_price.toLocaleString()}</p>
          </div>
          <div className="p-2 rounded-lg bg-success/10 text-center">
            <p className="text-xs text-success">Commission</p>
            <p className="text-sm font-medium text-success">₹{deal.commission_amount.toLocaleString()}</p>
          </div>
        </div>

        {deal.admin_contact_number && (
          <div className="text-sm text-muted-foreground mb-3">
            Admin Contact: <span className="font-medium">{deal.admin_contact_number}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Link to={`/deals/${deal.id}`} className="flex-1 min-w-[80px]">
            <Button variant="outline" size="sm" className="w-full">
              Details
            </Button>
          </Link>
          <a href={deal.product_link} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[80px]">
            <Button variant="outline" size="sm" className="w-full">
              <ExternalLink className="w-4 h-4 mr-1" />
              Product
            </Button>
          </a>
          
          {deal.status === "pending" && (
            <>
              <Button 
                size="sm" 
                onClick={() => handleApprove(deal.id)}
                disabled={actionLoading === deal.id}
                className="flex-1 min-w-[100px]"
              >
                {actionLoading === deal.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve
                  </>
                )}
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setRejectDialog({ open: true, dealId: deal.id, notes: "" })}
                disabled={actionLoading === deal.id}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </>
          )}

          {deal.status === "in_progress" && (
            <Button
              size="sm"
              onClick={() => handleComplete(deal.id)}
              disabled={actionLoading === deal.id}
              className="flex-1 min-w-[140px]"
            >
              {actionLoading === deal.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Complete & pay
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center shadow-glow">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground">Yaper flow — approve requests, complete payouts, verify KYC</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingDeals.length}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeDeals.length}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedDeals.length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-4 h-4" />
              Pending ({pendingDeals.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-2">
              <Package className="w-4 h-4" />
              Active ({activeDeals.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Completed ({completedDeals.length})
            </TabsTrigger>
            <TabsTrigger value="kyc" className="gap-2">
              <FileCheck className="w-4 h-4" />
              KYC ({pendingKycs.length})
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="gap-2">
              <Banknote className="w-4 h-4" />
              Payouts ({pendingWithdrawals.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingDeals.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="w-12 h-12 text-success mb-4" />
                  <p className="text-lg font-semibold">All Caught Up!</p>
                  <p className="text-muted-foreground">No pending deals to review</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingDeals.map(deal => <DealCard key={deal.id} deal={deal} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            {activeDeals.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-semibold">No Active Deals</p>
                  <p className="text-muted-foreground">Active deals will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeDeals.map(deal => <DealCard key={deal.id} deal={deal} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedDeals.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-semibold">No Completed Deals</p>
                  <p className="text-muted-foreground">Completed deals will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedDeals.map(deal => <DealCard key={deal.id} deal={deal} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="kyc" className="space-y-4">
            {pendingKycs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">No pending KYC submissions</CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {pendingKycs.map((kyc) => (
                  <Card key={kyc.id}>
                    <CardContent className="p-4 space-y-3">
                      <p className="font-medium">User {kyc.user_id.slice(0, 8)}…</p>
                      <p className="text-sm text-muted-foreground">PAN: {kyc.pan_number}</p>
                      <p className="text-sm text-muted-foreground">Bank: {kyc.bank_name} · {kyc.ifsc_code}</p>
                      <p className="text-sm text-muted-foreground">A/C: {kyc.account_number}</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleApproveKyc(kyc.id)} disabled={actionLoading === kyc.id}>
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRejectKyc(kyc.id)} disabled={actionLoading === kyc.id}>
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="withdrawals" className="space-y-4">
            {pendingWithdrawals.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">No pending withdrawal requests</CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {pendingWithdrawals.map((req) => (
                  <Card key={req.id}>
                    <CardContent className="p-4 space-y-3">
                      <p className="text-2xl font-bold">₹{req.amount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">User {req.user_id.slice(0, 8)}…</p>
                      <p className="text-xs text-muted-foreground">
                        Requested {new Date(req.created_at).toLocaleString()}
                      </p>
                      <Button size="sm" onClick={() => handleCompleteWithdrawal(req.id)} disabled={actionLoading === req.id}>
                        Mark transferred to bank
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialog.open} onOpenChange={(open) => !open && setRejectDialog({ ...rejectDialog, open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this deal? The shopper will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection (optional)..."
              value={rejectDialog.notes}
              onChange={(e) => setRejectDialog({ ...rejectDialog, notes: e.target.value })}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground">
              Reject Deal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
