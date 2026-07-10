import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { buildReferralLink } from "@/lib/referral";
import { Gift, Copy, Check, Users, Clock, CheckCircle2, IndianRupee, Share2, Loader2 } from "lucide-react";

type Summary = {
  code: string | null;
  total: number;
  pending: number;
  rewarded: number;
  earnings: number;
  enabled: boolean;
  referrer_reward: number;
  welcome_bonus: number;
  min_qualifying_amount: number;
};

type ReferralRow = {
  id: string;
  referred_name: string;
  status: string;
  reward_amount: number | null;
  created_at: string;
  qualified_at: string | null;
};

const statusBadge: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-warning/10 text-warning border-warning/20" },
  rewarded: { label: "Rewarded", cls: "bg-success/10 text-success border-success/20" },
  reversed: { label: "Reversed", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  voided: { label: "Voided", cls: "bg-secondary text-muted-foreground border-border" },
};

export default function ReferAndEarn() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [history, setHistory] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const load = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    const [sumRes, histRes] = await Promise.all([
      supabase.rpc("get_my_referral_summary"),
      supabase.rpc("list_my_referrals"),
    ]);
    if (sumRes.error) {
      toast({ title: "Couldn't load referrals", description: sumRes.error.message, variant: "destructive" });
    } else {
      setSummary(sumRes.data as unknown as Summary);
    }
    if (histRes.data) setHistory(histRes.data as ReferralRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const code = summary?.code ?? "";
  const link = code ? buildReferralLink(code) : "";

  const copy = async (value: string, which: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast({ title: "Copy failed", description: value, variant: "destructive" });
    }
  };

  const share = async () => {
    if (navigator.share && link) {
      try {
        await navigator.share({ title: "Join OfferBridge", text: "Join OfferBridge with my referral link:", url: link });
      } catch {
        /* user cancelled */
      }
    } else {
      void copy(link, "link");
    }
  };

  const stats = [
    { label: "Total referrals", value: summary?.total ?? 0, icon: Users, tone: "text-primary bg-primary/10" },
    { label: "Qualified", value: summary?.rewarded ?? 0, icon: CheckCircle2, tone: "text-success bg-success/10" },
    { label: "Pending", value: summary?.pending ?? 0, icon: Clock, tone: "text-warning bg-warning/10" },
    { label: "Total earned", value: `₹${(summary?.earnings ?? 0).toLocaleString()}`, icon: IndianRupee, tone: "text-accent bg-accent/10" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" /> Refer &amp; Earn
          </h1>
          <p className="text-muted-foreground">
            Invite friends. You both earn once they complete their first deal.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {summary && !summary.enabled && (
              <Card className="border-warning/30 bg-warning/5">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  The referral program is currently paused. Your link still works and will reward once it's re-enabled.
                </CardContent>
              </Card>
            )}

            {/* How it works */}
            <Card>
              <CardContent className="p-5">
                <div className="grid sm:grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <p className="text-2xl font-bold text-success">₹{summary?.welcome_bonus ?? 0}</p>
                    <p className="text-muted-foreground">Your friend's welcome bonus</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">₹{summary?.referrer_reward ?? 0}</p>
                    <p className="text-muted-foreground">You earn per referral</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">₹{summary?.min_qualifying_amount ?? 0}</p>
                    <p className="text-muted-foreground">Min. first-deal value to qualify</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground text-center">
                  Rewards are credited after your friend's first successfully completed deal (as shopper or card holder).
                  Cancelled or reversed deals don't qualify.
                </p>
              </CardContent>
            </Card>

            {/* Code + link */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your referral link</CardTitle>
                <CardDescription>Share this — new users are linked to you automatically.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 flex items-center justify-between gap-2 rounded-xl border border-input bg-secondary/40 px-4 py-3">
                    <span className="font-mono text-lg font-semibold tracking-wider">{code || "—"}</span>
                    <Button variant="ghost" size="sm" onClick={() => copy(code, "code")} disabled={!code}>
                      {copied === "code" ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 flex items-center gap-2 rounded-xl border border-input bg-secondary/40 px-4 py-2.5 min-w-0">
                    <span className="truncate text-sm text-muted-foreground">{link || "—"}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => copy(link, "link")} disabled={!link}>
                      {copied === "link" ? <><Check className="w-4 h-4 mr-2 text-success" /> Copied</> : <><Copy className="w-4 h-4 mr-2" /> Copy link</>}
                    </Button>
                    <Button onClick={share} disabled={!link}>
                      <Share2 className="w-4 h-4 mr-2" /> Share
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {stats.map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${s.tone}`}>
                      <s.icon className="w-4 h-4" />
                    </div>
                    <p className="text-xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Referral history</CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>No referrals yet. Share your link to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((r) => {
                      const b = statusBadge[r.status] ?? statusBadge.pending;
                      return (
                        <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
                          <div>
                            <p className="font-medium">{r.referred_name || "New user"}</p>
                            <p className="text-xs text-muted-foreground">
                              Joined {new Date(r.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className={b.cls}>{b.label}</Badge>
                            {r.status === "rewarded" && r.reward_amount != null && (
                              <p className="text-sm font-semibold text-success mt-1">+₹{r.reward_amount.toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
