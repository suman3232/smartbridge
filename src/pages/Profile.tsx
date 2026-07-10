import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { isValidPhone } from "@/lib/validation";
import { ArrowLeft, Loader2, User } from "lucide-react";

const roleOptions = [
  { value: "create_deals", label: "Shopper — post requests" },
  { value: "accept_deals", label: "Card holder — earn on deals" },
  { value: "both", label: "Both" },
];

export default function Profile() {
  const { profile, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    preferred_role: "both",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        preferred_role: profile.preferred_role ?? "both",
      });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!form.full_name.trim()) {
      toast({ title: "Name required", description: "Enter your full name.", variant: "destructive" });
      return;
    }

    if (!isValidPhone(form.phone)) {
      toast({
        title: "Mobile number required",
        description: "Enter a valid number with country code, e.g. +91 98765 43210.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        preferred_role: form.preferred_role as "create_deals" | "accept_deals" | "both",
      })
      .eq("id", profile.id);
    setSaving(false);

    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
      await refreshProfile();
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
            <h1 className="text-2xl font-bold">Profile & settings</h1>
            <p className="text-muted-foreground text-sm">Manage your account details</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>{profile?.full_name}</CardTitle>
                <CardDescription>{user?.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email ?? ""} disabled className="mt-1" />
                <p className="mt-1 text-xs text-muted-foreground">Email is managed by your login and can't be changed here.</p>
              </div>
              <div>
                <Label htmlFor="phone">Mobile number</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  required
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Required so the admin can contact you about your deals.
                </p>
              </div>
              <div>
                <Label>I want to</Label>
                <Select
                  value={form.preferred_role}
                  onValueChange={(v) => setForm((p) => ({ ...p, preferred_role: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
