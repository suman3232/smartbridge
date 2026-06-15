import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase, KYC, WithdrawalRequest } from "@/lib/supabase";
import { ArrowLeft, FileCheck, Loader2 } from "lucide-react";

export default function KYCPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<KYC | null>(null);
  const [form, setForm] = useState({
    pan_number: "",
    document_url: "",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
  });

  const loadKyc = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("kycs")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setExisting(data as KYC);
    setLoading(false);
  };

  useEffect(() => {
    void loadKyc();
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const canSubmit = !existing || existing.status === "rejected";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSubmitting(true);
    const { error } = await supabase.from("kycs").insert({
      user_id: profile.id,
      pan_number: form.pan_number.trim(),
      document_url: form.document_url.trim(),
      bank_name: form.bank_name.trim(),
      account_number: form.account_number.trim(),
      ifsc_code: form.ifsc_code.trim(),
      status: "pending",
    });

    setSubmitting(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "KYC submitted", description: "Admin will verify your bank details for withdrawals." });
      setForm({ pan_number: "", document_url: "", bank_name: "", account_number: "", ifsc_code: "" });
      void loadKyc();
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">KYC verification</h1>
            <p className="text-muted-foreground text-sm">Required before withdrawing wallet earnings</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : existing && !canSubmit ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5" />
                KYC {existing.status}
              </CardTitle>
              <CardDescription>
                {existing.status === "pending" && "Your bank details are under admin review."}
                {existing.status === "approved" && "You're verified. Request withdrawals from your wallet."}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>PAN: {existing.pan_number}</p>
              <p>Bank: {existing.bank_name}</p>
              <p>Submitted: {new Date(existing.created_at).toLocaleDateString()}</p>
              {existing.admin_notes && <p className="text-foreground">{existing.admin_notes}</p>}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{existing?.status === "rejected" ? "Resubmit KYC" : "Submit KYC"}</CardTitle>
              <CardDescription>
                Card holders need verified bank details to withdraw reimbursement + commission
              </CardDescription>
              {existing?.status === "rejected" && (
                <p className="text-sm text-destructive">{existing.admin_notes || "Previous submission was rejected."}</p>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="pan_number">PAN number</Label>
                  <Input id="pan_number" name="pan_number" value={form.pan_number} onChange={handleChange} required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="document_url">ID document URL</Label>
                  <Input id="document_url" name="document_url" type="url" value={form.document_url} onChange={handleChange} required className="mt-1" placeholder="https://..." />
                </div>
                <div>
                  <Label htmlFor="bank_name">Bank name</Label>
                  <Input id="bank_name" name="bank_name" value={form.bank_name} onChange={handleChange} required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="account_number">Account number</Label>
                  <Input id="account_number" name="account_number" value={form.account_number} onChange={handleChange} required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="ifsc_code">IFSC code</Label>
                  <Input id="ifsc_code" name="ifsc_code" value={form.ifsc_code} onChange={handleChange} required className="mt-1" />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit for review"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
