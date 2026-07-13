import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase, Deal, WithdrawalRequest, DEAL_SAFE_COLUMNS } from "@/lib/supabase";
import { getSignedUrl, KYC_BUCKET } from "@/lib/storage";
import { clearSupportWhatsAppCache } from "@/lib/settings";
import { 
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  CreditCard,
  Loader2,
  Package,
  FileCheck,
  Banknote,
  UserPlus,
  Users,
  AlertCircle,
  Gift,
  MessageCircle,
  Timer,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdminUser = {
  user_id: string;
  email: string;
  full_name: string;
  granted_at: string;
};

type DealContact = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type AdminKyc = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  pan_number: string;
  document_url: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

type AdminReferral = {
  id: string;
  referrer_name: string;
  referrer_email: string;
  referred_name: string;
  referred_email: string;
  code_used: string | null;
  status: string;
  referrer_reward_amount: number | null;
  referred_reward_amount: number | null;
  qualifying_deal_id: string | null;
  admin_notes: string | null;
  created_at: string;
  qualified_at: string | null;
};

type ReferralConfigForm = {
  referrer_reward: string;
  welcome_bonus: string;
  min_qualifying_amount: string;
  max_rewards_per_referrer: string;
  enabled: boolean;
};

type ReservationEvent = {
  id: string;
  deal_id: string | null;
  product_name: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  event_type: string;
  within_grace: boolean | null;
  reserved_at: string | null;
  reserved_until: string | null;
  detail: string | null;
  voided: boolean;
  created_at: string;
};

type CardholderReliability = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  total_expiries: number;
  total_releases: number;
  strikes_30d: number;
  acceptance_blocked_until: string | null;
  last_expiry_at: string | null;
  under_review: boolean;
  admin_note: string | null;
  server_now: string;
};

type OrderSearchRow = {
  deal_id: string;
  product_name: string;
  deal_status: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
  cardholder_name: string | null;
  cardholder_phone: string | null;
  recipient_name: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  legacy_address: string | null;
  marketplace_order_id: string | null;
  courier: string | null;
  tracking_id: string | null;
  estimated_delivery_date: string | null;
  payment_due_date: string | null;
  payment_status: string;
  delivery_code_type: string | null;
  dispute_status: string | null;
  created_at: string;
};

type ReservationConfigForm = {
  enabled: boolean;
  hold_minutes: string;
  grace_minutes: string;
  max_accepts: string;
  window_days: string;
  cd2_minutes: string;
  cd3_hours: string;
  abuse_hours: string;
};

export default function AdminPanel() {
  const { isAdmin, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealContacts, setDealContacts] = useState<Record<string, DealContact>>({});
  const [kycs, setKycs] = useState<AdminKyc[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [referrals, setReferrals] = useState<AdminReferral[]>([]);
  const [refConfig, setRefConfig] = useState<ReferralConfigForm>({
    referrer_reward: "50",
    welcome_bonus: "25",
    min_qualifying_amount: "500",
    max_rewards_per_referrer: "",
    enabled: true,
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [feeCfg, setFeeCfg] = useState({ fee_percent: "20", fee_min: "20", fee_max: "500" });
  const [savingFee, setSavingFee] = useState(false);
  const [supportNumber, setSupportNumber] = useState("");
  const [savingSupport, setSavingSupport] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderResults, setOrderResults] = useState<OrderSearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [resEvents, setResEvents] = useState<ReservationEvent[]>([]);
  const [reliability, setReliability] = useState<CardholderReliability[]>([]);
  const [resConfig, setResConfig] = useState<ReservationConfigForm>({
    enabled: true,
    hold_minutes: "30",
    grace_minutes: "5",
    max_accepts: "3",
    window_days: "30",
    cd2_minutes: "60",
    cd3_hours: "24",
    abuse_hours: "168",
  });
  const [savingResConfig, setSavingResConfig] = useState(false);
  const [grantEmail, setGrantEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; dealId: string | null; notes: string }>({
    open: false,
    dealId: null,
    notes: ""
  });
  const [kycRejectDialog, setKycRejectDialog] = useState<{ open: boolean; kycId: string | null; notes: string }>({
    open: false,
    kycId: null,
    notes: ""
  });
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; dealId: string | null }>({
    open: false,
    dealId: null,
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
    const [dealsRes, kycRes, withdrawalsRes, adminsRes, referralsRes, configRes, settingsRes, resEventsRes, reliabilityRes, resCfgRes, feeCfgRes] = await Promise.all([
      supabase.from("deals").select(DEAL_SAFE_COLUMNS).order("created_at", { ascending: false }),
      supabase.rpc("list_kycs_for_admin"),
      supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false }),
      supabase.rpc("list_admins"),
      supabase.rpc("admin_list_referrals"),
      supabase.from("referral_config").select("*").maybeSingle(),
      supabase.from("app_settings").select("support_whatsapp").eq("id", true).maybeSingle(),
      supabase.rpc("admin_list_reservation_events", { p_limit: 100 }),
      supabase.rpc("admin_list_cardholder_reliability"),
      supabase.from("reservation_config").select("*").maybeSingle(),
      supabase.from("platform_fee_config").select("*").maybeSingle(),
    ]);

    if (settingsRes.data) setSupportNumber(settingsRes.data.support_whatsapp ?? "");

    // Reservation system (errors ignored gracefully until setup.sql is applied).
    if (resEventsRes.data) setResEvents(resEventsRes.data as ReservationEvent[]);
    if (reliabilityRes.data) setReliability(reliabilityRes.data as CardholderReliability[]);
    if (resCfgRes.data) {
      const c = resCfgRes.data;
      setResConfig({
        enabled: c.enabled,
        hold_minutes: String(Math.round(c.hold_seconds / 60)),
        grace_minutes: String(Math.round(c.release_grace_seconds / 60)),
        max_accepts: String(c.max_accepts_per_deal),
        window_days: String(c.strike_window_days),
        cd2_minutes: String(Math.round(c.cooldown2_seconds / 60)),
        cd3_hours: String(Math.round(c.cooldown3_seconds / 3600)),
        abuse_hours: String(Math.round(c.cooldown_abuse_seconds / 3600)),
      });
    }

    if (feeCfgRes.data) {
      const f = feeCfgRes.data;
      setFeeCfg({ fee_percent: String(f.fee_percent), fee_min: String(f.fee_min), fee_max: String(f.fee_max) });
    }
    if (referralsRes.data) setReferrals(referralsRes.data as AdminReferral[]);
    if (configRes.data) {
      const c = configRes.data;
      setRefConfig({
        referrer_reward: String(c.referrer_reward),
        welcome_bonus: String(c.welcome_bonus),
        min_qualifying_amount: String(c.min_qualifying_amount),
        max_rewards_per_referrer: c.max_rewards_per_referrer != null ? String(c.max_rewards_per_referrer) : "",
        enabled: c.enabled,
      });
    }

    if (dealsRes.error) {
      toast({ title: "Error", description: dealsRes.error.message, variant: "destructive" });
    } else if (dealsRes.data) {
      const dealRows = dealsRes.data as unknown as Deal[];
      setDeals(dealRows);

      // Load the poster's + accepter's contact for each deal (admins can read all
      // profiles) so the admin knows who to contact.
      const ids = Array.from(
        new Set(dealRows.flatMap((d) => [d.merchant_id, d.customer_id]).filter(Boolean) as string[]),
      );
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone")
          .in("id", ids);
        if (profs) {
          const map: Record<string, DealContact> = {};
          profs.forEach((p) => {
            map[p.id] = { full_name: p.full_name, email: p.email, phone: p.phone };
          });
          setDealContacts(map);
        }
      }
    }

    if (kycRes.error) {
      // Fallback if list_kycs_for_admin RPC not applied yet — raw table (no name/email).
      const { data: rawKycs } = await supabase
        .from("kycs")
        .select("*")
        .order("created_at", { ascending: false });
      if (rawKycs) {
        setKycs(
          rawKycs.map((k) => ({
            ...k,
            full_name: "",
            email: "",
            status: String(k.status),
            created_at: k.created_at ?? new Date().toISOString(),
          })) as AdminKyc[],
        );
      }
    } else if (kycRes.data) {
      setKycs(kycRes.data as AdminKyc[]);
    }

    if (withdrawalsRes.error && !withdrawalsRes.error.message.includes("does not exist")) {
      toast({ title: "Withdrawals", description: withdrawalsRes.error.message, variant: "destructive" });
    } else if (withdrawalsRes.data) {
      setWithdrawals(withdrawalsRes.data as WithdrawalRequest[]);
    }

    if (adminsRes.error) {
      // list_admins RPC optional until admin migration is applied — load admins via join fallback
      const { data: roleRows } = await supabase.from("user_roles").select("user_id, created_at").eq("role", "admin");
      if (roleRows?.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", roleRows.map((r) => r.user_id));
        if (profiles) {
          setAdmins(
            roleRows.map((r) => {
              const p = profiles.find((profile) => profile.id === r.user_id);
              return {
                user_id: r.user_id,
                email: p?.email ?? "",
                full_name: p?.full_name ?? "",
                granted_at: r.created_at ?? new Date().toISOString(),
              };
            }),
          );
        }
      }
    } else if (adminsRes.data) {
      setAdmins(adminsRes.data as AdminUser[]);
    }
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

  const handleCancel = async () => {
    if (!cancelDialog.dealId) return;

    setActionLoading(cancelDialog.dealId);
    const { error } = await supabase.rpc("cancel_deal", { p_deal_id: cancelDialog.dealId });
    setActionLoading(null);
    setCancelDialog({ open: false, dealId: null });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deal cancelled", description: "The deal is closed and removed from the open list." });
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

  const handleRejectKyc = async () => {
    if (!kycRejectDialog.kycId) return;
    setActionLoading(kycRejectDialog.kycId);
    const { error } = await supabase.rpc("reject_kyc", {
      p_kyc_id: kycRejectDialog.kycId,
      p_notes: kycRejectDialog.notes.trim() || "Please resubmit with correct bank details.",
    });
    setActionLoading(null);
    setKycRejectDialog({ open: false, kycId: null, notes: "" });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "KYC rejected", description: "The applicant has been notified." });
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

  const handleRejectWithdrawal = async (requestId: string) => {
    setActionLoading(requestId);
    const { error } = await supabase.rpc("reject_withdrawal", { p_request_id: requestId });
    setActionLoading(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Withdrawal rejected", description: "Amount returned to the user's wallet." });
      void fetchAll();
    }
  };

  const handleViewKycDoc = async (path: string) => {
    if (!path) {
      toast({ title: "No document", description: "No document was uploaded.", variant: "destructive" });
      return;
    }
    // Open the tab synchronously inside the click handler so it isn't popup-blocked,
    // then point it at the resolved URL once ready.
    const win = window.open("", "_blank", "noopener,noreferrer");
    const url = /^https?:\/\//.test(path) ? path : await getSignedUrl(KYC_BUCKET, path);
    if (url && win) {
      win.location.href = url;
    } else {
      win?.close();
      toast({ title: "Could not open document", description: "The file may be missing.", variant: "destructive" });
    }
  };

  const handleGrantAdmin = async (e: FormEvent) => {
    e.preventDefault();
    const email = grantEmail.trim();
    if (!email) return;

    setActionLoading(`grant-${email}`);
    const { error } = await supabase.rpc("grant_admin_role", { p_email: email });
    setActionLoading(null);

    if (error) {
      toast({ title: "Could not grant admin", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Admin granted",
        description: `${email} must sign out and sign in again to see the Admin Panel.`,
      });
      setGrantEmail("");
      void fetchAll();
    }
  };

  const handleRevokeAdmin = async (userId: string) => {
    setActionLoading(`revoke-${userId}`);
    const { error } = await supabase.rpc("revoke_admin_role", { p_user_id: userId });
    setActionLoading(null);

    if (error) {
      toast({ title: "Could not revoke admin", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Admin removed", description: "User no longer has admin access." });
      void fetchAll();
    }
  };

  const handleSaveSupport = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSupport(true);
    const { error } = await supabase.rpc("admin_update_support_number", { p_number: supportNumber.trim() });
    setSavingSupport(false);
    if (error) {
      const missing = /schema cache|could not find the function/i.test(error.message);
      toast({
        title: missing ? "Backend not updated yet" : "Error",
        description: missing
          ? "Re-run the latest supabase/setup.sql to enable saving here. The support button already works via a built-in number in the meantime."
          : error.message,
        variant: "destructive",
      });
    } else {
      clearSupportWhatsAppCache();
      toast({
        title: "Support number saved",
        description: supportNumber.trim()
          ? "The WhatsApp support button now uses this number."
          : "Support button hidden until a number is set.",
      });
    }
  };

  const handleSaveReferralConfig = async (e: FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    const { error } = await supabase.rpc("admin_update_referral_config", {
      p_referrer_reward: parseFloat(refConfig.referrer_reward) || 0,
      p_welcome_bonus: parseFloat(refConfig.welcome_bonus) || 0,
      p_min_qualifying_amount: parseFloat(refConfig.min_qualifying_amount) || 0,
      p_max_rewards_per_referrer: refConfig.max_rewards_per_referrer ? parseInt(refConfig.max_rewards_per_referrer, 10) : null,
      p_enabled: refConfig.enabled,
    });
    setSavingConfig(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Referral settings saved" });
      void fetchAll();
    }
  };

  const handleSaveFeeConfig = async (e: FormEvent) => {
    e.preventDefault();
    const pct = parseFloat(feeCfg.fee_percent) || 0;
    const fmin = parseFloat(feeCfg.fee_min) || 0;
    const fmax = parseFloat(feeCfg.fee_max) || 0;
    if (pct < 0 || pct > 100) {
      toast({ title: "Check the fee %", description: "Percent must be between 0 and 100.", variant: "destructive" });
      return;
    }
    if (fmin > fmax) {
      toast({ title: "Check the min/max", description: "Minimum fee can't exceed the maximum fee.", variant: "destructive" });
      return;
    }
    setSavingFee(true);
    // RLS: admins only. The change is audit-logged by the platform_fee_config
    // trigger; existing deals keep their locked fee — only NEW deals use this.
    // (DB also enforces fee_min <= fee_max and the percent range.)
    const { error } = await supabase.from("platform_fee_config").update({
      fee_percent: pct, fee_min: fmin, fee_max: fmax,
    }).eq("id", true);
    setSavingFee(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Service-fee policy saved" });
      void fetchAll();
    }
  };

  const handleVoidReferral = async (id: string, isRewarded: boolean) => {
    setActionLoading(`ref-${id}`);
    const { error } = await supabase.rpc("admin_void_referral", {
      p_id: id,
      p_notes: isRewarded ? "Reversed by admin" : "Voided by admin",
    });
    setActionLoading(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isRewarded ? "Referral reversed" : "Referral voided" });
      void fetchAll();
    }
  };

  const handleSaveResConfig = async (e: FormEvent) => {
    e.preventDefault();
    setSavingResConfig(true);
    const { error } = await supabase.rpc("admin_update_reservation_config", {
      p_enabled: resConfig.enabled,
      p_hold_seconds: Math.max(1, parseInt(resConfig.hold_minutes, 10) || 30) * 60,
      p_release_grace_seconds: Math.max(0, parseInt(resConfig.grace_minutes, 10) || 0) * 60,
      p_max_accepts_per_deal: Math.max(1, parseInt(resConfig.max_accepts, 10) || 3),
      p_strike_window_days: Math.max(1, parseInt(resConfig.window_days, 10) || 30),
      p_cooldown2_seconds: Math.max(0, parseInt(resConfig.cd2_minutes, 10) || 0) * 60,
      p_cooldown3_seconds: Math.max(0, parseInt(resConfig.cd3_hours, 10) || 0) * 3600,
      p_cooldown_abuse_seconds: Math.max(0, parseInt(resConfig.abuse_hours, 10) || 0) * 3600,
    });
    setSavingResConfig(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Reservation rules saved" });
      void fetchAll();
    }
  };

  const handleResetCardholder = async (userId: string) => {
    setActionLoading(`rel-${userId}`);
    const { error } = await supabase.rpc("admin_reset_cardholder", {
      p_user_id: userId,
      p_note: "Cooldown lifted by admin",
    });
    setActionLoading(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Reliability reset", description: "Cooldown lifted and strikes cleared." });
      void fetchAll();
    }
  };

  const handleOrderSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!orderQuery.trim()) return;
    setSearching(true);
    const { data, error } = await supabase.rpc("admin_order_search", { p_query: orderQuery.trim() });
    setSearching(false);
    if (error) {
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
    } else {
      setOrderResults((data as OrderSearchRow[]) ?? []);
    }
  };

  const handleReopenReservation = async (dealId: string) => {
    setActionLoading(dealId);
    const { error } = await supabase.rpc("admin_reopen_reservation", { p_deal_id: dealId });
    setActionLoading(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Reservation reopened", description: "The deal is open again — no strike recorded." });
      void fetchAll();
    }
  };

  const pendingReferrals = referrals.filter((r) => r.status === "pending").length;

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

  if (authLoading || (!isAdmin && loading)) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
          <Shield className="w-10 h-10" />
          <p>Admin access required</p>
        </div>
      </DashboardLayout>
    );
  }

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
            <p className="text-xs text-success">Cardholder reward</p>
            <p className="text-sm font-medium text-success">₹{deal.commission_amount.toLocaleString()}</p>
          </div>
        </div>

        {(() => {
          const poster = dealContacts[deal.merchant_id];
          const accepter = deal.customer_id ? dealContacts[deal.customer_id] : null;
          return (
            <div className="mb-3 space-y-2 rounded-lg bg-secondary/30 p-3 text-xs">
              <div>
                <p className="text-muted-foreground">Posted by (shopper)</p>
                <p className="font-medium text-foreground">{poster?.full_name || "—"}</p>
                <p className="text-muted-foreground">
                  {poster?.phone || "No phone on file"}
                  {poster?.email ? ` · ${poster.email}` : ""}
                </p>
              </div>
              {accepter && (
                <div className="border-t border-white/[0.06] pt-2">
                  <p className="text-muted-foreground">Accepted by (card holder)</p>
                  <p className="font-medium text-foreground">{accepter.full_name || "—"}</p>
                  <p className="text-muted-foreground">
                    {accepter.phone || "No phone on file"}
                    {accepter.email ? ` · ${accepter.email}` : ""}
                  </p>
                </div>
              )}
            </div>
          );
        })()}

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

          {deal.status === "approved" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setCancelDialog({ open: true, dealId: deal.id })}
              disabled={actionLoading === deal.id}
              className="flex-1 min-w-[100px]"
            >
              {actionLoading === deal.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel deal
                </>
              )}
            </Button>
          )}

          {deal.status === "accepted" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleReopenReservation(deal.id)}
              disabled={actionLoading === deal.id}
              className="flex-1 min-w-[140px]"
              title="Release the current holder's reservation without recording a strike"
            >
              {actionLoading === deal.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Timer className="w-4 h-4 mr-1" />
                  Reopen (no strike)
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
            <p className="text-muted-foreground">Approve requests, complete payouts, and verify KYC</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <TabsList className="flex w-full overflow-x-auto justify-start">
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
            <TabsTrigger value="referrals" className="gap-2">
              <Gift className="w-4 h-4" />
              Referrals ({pendingReferrals})
            </TabsTrigger>
            <TabsTrigger value="reservations" className="gap-2">
              <Timer className="w-4 h-4" />
              Reservations ({reliability.filter((r) => r.under_review || (r.acceptance_blocked_until && new Date(r.acceptance_blocked_until) > new Date())).length})
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Order lookup
            </TabsTrigger>
            <TabsTrigger value="admins" className="gap-2">
              <Users className="w-4 h-4" />
              Admins ({admins.length})
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
                      <div>
                        <p className="font-medium">{kyc.full_name || `User ${kyc.user_id.slice(0, 8)}…`}</p>
                        {kyc.email && <p className="text-xs text-muted-foreground">{kyc.email}</p>}
                      </div>
                      <p className="text-sm text-muted-foreground">PAN: {kyc.pan_number}</p>
                      <p className="text-sm text-muted-foreground">Bank: {kyc.bank_name} · {kyc.ifsc_code}</p>
                      <p className="text-sm text-muted-foreground">A/C: {kyc.account_number}</p>
                      <Button size="sm" variant="outline" onClick={() => handleViewKycDoc(kyc.document_url)}>
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View document
                      </Button>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleApproveKyc(kyc.id)} disabled={actionLoading === kyc.id}>
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setKycRejectDialog({ open: true, kycId: kyc.id, notes: "" })} disabled={actionLoading === kyc.id}>
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
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleCompleteWithdrawal(req.id)} disabled={actionLoading === req.id}>
                          Mark transferred
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRejectWithdrawal(req.id)} disabled={actionLoading === req.id}>
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="referrals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>OfferBridge service-fee policy</CardTitle>
                <CardDescription>
                  fee = clamp(reward × percent, min, max). Locked onto each deal at creation — changing this affects only NEW requests. All changes are audit-logged.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveFeeConfig} className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="fp">Fee percent (% of reward)</Label>
                      <Input id="fp" type="number" min="0" max="100" step="0.01" value={feeCfg.fee_percent}
                        onChange={(e) => setFeeCfg((c) => ({ ...c, fee_percent: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="fmin">Minimum fee (₹)</Label>
                      <Input id="fmin" type="number" min="0" step="1" value={feeCfg.fee_min}
                        onChange={(e) => setFeeCfg((c) => ({ ...c, fee_min: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="fmax">Maximum fee (₹)</Label>
                      <Input id="fmax" type="number" min="0" step="1" value={feeCfg.fee_max}
                        onChange={(e) => setFeeCfg((c) => ({ ...c, fee_max: e.target.value }))} className="mt-1" />
                    </div>
                  </div>
                  <Button type="submit" disabled={savingFee}>{savingFee ? "Saving…" : "Save fee policy"}</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  Referral program settings
                </CardTitle>
                <CardDescription>
                  Configure rewards and eligibility. Rewards credit only after a referred user's first completed deal that meets the minimum value.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveReferralConfig} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="rr">Referrer reward (₹)</Label>
                      <Input id="rr" type="number" min="0" step="0.01" value={refConfig.referrer_reward}
                        onChange={(e) => setRefConfig((c) => ({ ...c, referrer_reward: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="wb">Welcome bonus (₹)</Label>
                      <Input id="wb" type="number" min="0" step="0.01" value={refConfig.welcome_bonus}
                        onChange={(e) => setRefConfig((c) => ({ ...c, welcome_bonus: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="mqa">Min. qualifying deal value (₹)</Label>
                      <Input id="mqa" type="number" min="0" step="0.01" value={refConfig.min_qualifying_amount}
                        onChange={(e) => setRefConfig((c) => ({ ...c, min_qualifying_amount: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="cap">Max rewards per referrer (blank = unlimited)</Label>
                      <Input id="cap" type="number" min="0" value={refConfig.max_rewards_per_referrer}
                        onChange={(e) => setRefConfig((c) => ({ ...c, max_rewards_per_referrer: e.target.value }))} placeholder="Unlimited" className="mt-1" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={refConfig.enabled} onCheckedChange={(v) => setRefConfig((c) => ({ ...c, enabled: v }))} />
                    <span className="text-sm">{refConfig.enabled ? "Program enabled" : "Program paused"}</span>
                  </div>
                  <Button type="submit" disabled={savingConfig}>
                    {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save settings"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All referrals ({referrals.length})</CardTitle>
                <CardDescription>Investigate and reverse/void suspicious referrals.</CardDescription>
              </CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">No referrals yet.</p>
                ) : (
                  <div className="space-y-2">
                    {referrals.map((r) => (
                      <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-secondary/30">
                        <div className="min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{r.referrer_name}</span>
                            <span className="text-muted-foreground"> ({r.referrer_email})</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            referred <span className="text-foreground">{r.referred_name}</span> ({r.referred_email}) · code {r.code_used}
                          </p>
                          {r.admin_notes && <p className="text-xs text-destructive mt-0.5">{r.admin_notes}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={getStatusVariant(r.status === "rewarded" ? "completed" : r.status === "pending" ? "pending" : "rejected")} className="capitalize">
                            {r.status}
                          </Badge>
                          {r.status === "rewarded" && r.referrer_reward_amount != null && (
                            <span className="text-sm font-medium text-success">₹{r.referrer_reward_amount}</span>
                          )}
                          {(r.status === "pending" || r.status === "rewarded") && (
                            <Button size="sm" variant="outline"
                              onClick={() => handleVoidReferral(r.id, r.status === "rewarded")}
                              disabled={actionLoading === `ref-${r.id}`}>
                              {r.status === "rewarded" ? "Reverse" : "Void"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reservations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="w-5 h-5" />
                  Reservation rules
                </CardTitle>
                <CardDescription>
                  Card holders get a time window to place the order after reserving a deal. Missed windows escalate:
                  warning → cooldown → longer cooldown → admin review. No wallet money is ever deducted.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveResConfig} className="space-y-4">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="rc-hold">Hold window (minutes)</Label>
                      <Input id="rc-hold" type="number" min="1" value={resConfig.hold_minutes}
                        onChange={(e) => setResConfig((c) => ({ ...c, hold_minutes: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="rc-grace">Penalty-free release (minutes)</Label>
                      <Input id="rc-grace" type="number" min="0" value={resConfig.grace_minutes}
                        onChange={(e) => setResConfig((c) => ({ ...c, grace_minutes: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="rc-max">Max reserves per deal/user</Label>
                      <Input id="rc-max" type="number" min="1" value={resConfig.max_accepts}
                        onChange={(e) => setResConfig((c) => ({ ...c, max_accepts: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="rc-window">Strike window (days)</Label>
                      <Input id="rc-window" type="number" min="1" value={resConfig.window_days}
                        onChange={(e) => setResConfig((c) => ({ ...c, window_days: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="rc-cd2">2nd miss cooldown (minutes)</Label>
                      <Input id="rc-cd2" type="number" min="0" value={resConfig.cd2_minutes}
                        onChange={(e) => setResConfig((c) => ({ ...c, cd2_minutes: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="rc-cd3">3rd miss cooldown (hours)</Label>
                      <Input id="rc-cd3" type="number" min="0" value={resConfig.cd3_hours}
                        onChange={(e) => setResConfig((c) => ({ ...c, cd3_hours: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="rc-abuse">4th+ miss cooldown (hours)</Label>
                      <Input id="rc-abuse" type="number" min="0" value={resConfig.abuse_hours}
                        onChange={(e) => setResConfig((c) => ({ ...c, abuse_hours: e.target.value }))} className="mt-1" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={resConfig.enabled} onCheckedChange={(v) => setResConfig((c) => ({ ...c, enabled: v }))} />
                    <span className="text-sm">{resConfig.enabled ? "Strikes & cooldowns enabled" : "Strikes & cooldowns paused (reservations still expire)"}</span>
                  </div>
                  <Button type="submit" disabled={savingResConfig}>
                    {savingResConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save rules"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Card holder reliability ({reliability.length})</CardTitle>
                <CardDescription>Strikes, cooldowns and releases. Reset lifts the cooldown and clears strikes.</CardDescription>
              </CardHeader>
              <CardContent>
                {reliability.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">No reliability records yet — nobody has missed or released a reservation.</p>
                ) : (
                  <div className="space-y-2">
                    {reliability.map((r) => {
                      const blocked = r.acceptance_blocked_until && new Date(r.acceptance_blocked_until) > new Date();
                      return (
                        <div key={r.user_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-secondary/30">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {r.full_name || "—"}
                              <span className="font-normal text-muted-foreground"> ({r.email})</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {r.strikes_30d} strike{r.strikes_30d === 1 ? "" : "s"} in window · {r.total_expiries} expir{r.total_expiries === 1 ? "y" : "ies"} · {r.total_releases} release{r.total_releases === 1 ? "" : "s"} total
                              {r.phone ? ` · ${r.phone}` : ""}
                            </p>
                            {blocked && (
                              <p className="text-xs text-destructive">Blocked until {new Date(r.acceptance_blocked_until!).toLocaleString()}</p>
                            )}
                            {r.admin_note && <p className="text-xs text-muted-foreground">{r.admin_note}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {r.under_review && <Badge variant="rejected">Under review</Badge>}
                            {blocked && <Badge variant="pending">Cooldown</Badge>}
                            {(blocked || r.under_review || r.strikes_30d > 0) && (
                              <Button size="sm" variant="outline"
                                onClick={() => handleResetCardholder(r.user_id)}
                                disabled={actionLoading === `rel-${r.user_id}`}>
                                {actionLoading === `rel-${r.user_id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset"}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reservation history</CardTitle>
                <CardDescription>Audit trail of reserves, fulfilments, releases, expiries and admin overrides (latest 100).</CardDescription>
              </CardHeader>
              <CardContent>
                {resEvents.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">No reservation activity yet.</p>
                ) : (
                  <div className="space-y-2">
                    {resEvents.map((e) => (
                      <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-3 rounded-xl bg-secondary/30">
                        <div className="min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{e.user_name || e.user_email || "Unknown user"}</span>
                            <span className="text-muted-foreground"> · {e.product_name || "deleted deal"}</span>
                          </p>
                          {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {e.voided && <Badge variant="secondary">forgiven</Badge>}
                          <Badge
                            variant={
                              e.event_type === "fulfilled" ? "success"
                              : e.event_type === "expired" ? "rejected"
                              : e.event_type === "released" ? (e.within_grace ? "secondary" : "pending")
                              : e.event_type === "admin_reopened" ? "pending"
                              : "approved"
                            }
                            className="capitalize"
                          >
                            {e.event_type.replace("_", " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="support" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5" /> Delivery coordination lookup</CardTitle>
                <CardDescription>
                  Search by marketplace order ID, tracking/AWB, deal ID, buyer or card holder. Only authorized admins see the
                  buyer's private phone — for coordinating with the courier. The delivery OTP/PIN itself is never shown here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleOrderSearch} className="flex gap-2">
                  <Input value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)} placeholder="Order ID, tracking, name, phone…" />
                  <Button type="submit" disabled={searching}>{searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}</Button>
                </form>
              </CardContent>
            </Card>

            {orderResults.map((r) => (
              <Card key={r.deal_id}>
                <CardContent className="p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{r.product_name}</p>
                    <Badge className="capitalize">{r.deal_status.replace("_", " ")}</Badge>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                    <p><span className="text-muted-foreground">Buyer:</span> {r.buyer_name || "—"}</p>
                    <p><span className="text-muted-foreground">Buyer phone:</span> <span className="font-medium">{r.buyer_phone || "—"}</span></p>
                    <p><span className="text-muted-foreground">Card holder:</span> {r.cardholder_name || "—"}</p>
                    <p><span className="text-muted-foreground">Order ID:</span> {r.marketplace_order_id || "—"}</p>
                    <p><span className="text-muted-foreground">Courier:</span> {r.courier || "—"} {r.tracking_id ? `(${r.tracking_id})` : ""}</p>
                    <p><span className="text-muted-foreground">Est. delivery:</span> {r.estimated_delivery_date || "—"}</p>
                    <p><span className="text-muted-foreground">Payment due:</span> {r.payment_due_date || "—"}</p>
                    <p><span className="text-muted-foreground">Payment:</span> <span className="capitalize">{r.payment_status.replace("_", " ")}</span></p>
                    <p><span className="text-muted-foreground">OTP/PIN needed:</span> {r.delivery_code_type && r.delivery_code_type !== "none" ? r.delivery_code_type : "no"}</p>
                    {r.dispute_status && <p><span className="text-muted-foreground">Dispute:</span> {r.dispute_status}</p>}
                  </div>
                  <p className="text-muted-foreground whitespace-pre-wrap pt-1 border-t">
                    Ship to: {[r.recipient_name, r.address_line, [r.city, r.state, r.pincode].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || r.legacy_address}
                  </p>
                  <Link to={`/deals/${r.deal_id}`} className="inline-block"><Button size="sm" variant="outline">Open deal</Button></Link>
                </CardContent>
              </Card>
            ))}
            {orderQuery && !searching && orderResults.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No matching orders.</p>
            )}
          </TabsContent>

          <TabsContent value="admins" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Support WhatsApp number
                </CardTitle>
                <CardDescription>
                  Shown as the "Chat with support" button on deal cards. Include the country code (e.g. +91 98765 43210). Leave blank to hide the button.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSupport} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="support-number">Number</Label>
                    <Input
                      id="support-number"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={supportNumber}
                      onChange={(e) => setSupportNumber(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="sm:self-end" disabled={savingSupport}>
                    {savingSupport ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save number"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Add admin
                </CardTitle>
                <CardDescription>
                  User must already have signed up. They need to sign out and back in after you grant access.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGrantAdmin} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="admin-email">User email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="user@example.com"
                      value={grantEmail}
                      onChange={(e) => setGrantEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="sm:self-end"
                    disabled={actionLoading === `grant-${grantEmail.trim()}`}
                  >
                    {actionLoading === `grant-${grantEmail.trim()}` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Grant admin"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              {admins.map((admin) => (
                <Card key={admin.user_id}>
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{admin.full_name || "—"}</p>
                      <p className="text-sm text-muted-foreground">{admin.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Since {new Date(admin.granted_at).toLocaleDateString()}
                      </p>
                      {admin.user_id === profile?.id && (
                        <Badge variant="secondary" className="mt-2">You</Badge>
                      )}
                    </div>
                    {admin.user_id !== profile?.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRevokeAdmin(admin.user_id)}
                        disabled={actionLoading === `revoke-${admin.user_id}`}
                      >
                        Remove
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
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

      {/* Cancel Deal Dialog */}
      <AlertDialog open={cancelDialog.open} onOpenChange={(open) => !open && setCancelDialog({ open: false, dealId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this deal?</AlertDialogTitle>
            <AlertDialogDescription>
              This closes the approved deal and removes it from the open list so no card holder can accept it. Only deals that haven't been accepted yet can be cancelled. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep deal</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground">
              Cancel deal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* KYC Reject Dialog */}
      <AlertDialog open={kycRejectDialog.open} onOpenChange={(open) => !open && setKycRejectDialog({ ...kycRejectDialog, open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject KYC</AlertDialogTitle>
            <AlertDialogDescription>
              Tell the applicant what to fix. This message is shown to them so they can resubmit correctly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="e.g. PAN image is blurry / account number doesn't match name…"
              value={kycRejectDialog.notes}
              onChange={(e) => setKycRejectDialog({ ...kycRejectDialog, notes: e.target.value })}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRejectKyc} className="bg-destructive text-destructive-foreground">
              Reject KYC
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
