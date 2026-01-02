import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase, Deal } from "@/lib/supabase";
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
  AlertCircle
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
      fetchDeals();
    }
  }, [isAdmin]);

  const fetchDeals = async () => {
    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setDeals(data as Deal[]);
    setLoading(false);
  };

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
      toast({ title: "Deal Rejected", description: "Merchant has been notified" });
      fetchDeals();
    }
  };

  const pendingDeals = deals.filter(d => d.status === "pending");
  const activeDeals = deals.filter(d => ["approved", "accepted", "in_progress"].includes(d.status));
  const completedDeals = deals.filter(d => ["completed", "rejected", "cancelled"].includes(d.status));

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

        <div className="flex gap-2">
          <a href={deal.product_link} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <ExternalLink className="w-4 h-4 mr-1" />
              View
            </Button>
          </a>
          
          {deal.status === "pending" && (
            <>
              <Button 
                size="sm" 
                onClick={() => handleApprove(deal.id)}
                disabled={actionLoading === deal.id}
                className="flex-1"
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
            <p className="text-muted-foreground">Manage deals and approvals</p>
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
        </Tabs>
      </div>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialog.open} onOpenChange={(open) => !open && setRejectDialog({ ...rejectDialog, open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this deal? The merchant will be notified.
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
