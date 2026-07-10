import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { PriceChart } from "@/components/tracker/PriceChart";
import { PriceGauge } from "@/components/tracker/PriceGauge";
import {
  detectPlatform,
  fetchProductData,
  isValidHttpUrl,
  PLATFORM_LABELS,
  RECOMMENDATION_DISPLAY,
  type ProductStats,
  type PricePoint,
  type TrackedProduct,
} from "@/lib/price-tracker";
import {
  LineChart,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Bell,
  BellOff,
  ExternalLink,
} from "lucide-react";

const money = (v: number | null | undefined, currency = "INR") =>
  v == null ? "—" : `${currency === "INR" ? "₹" : ""}${Number(v).toLocaleString()}`;

export default function PriceTracker() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Add form
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [target, setTarget] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [adding, setAdding] = useState(false);

  const detected = useMemo(() => (url ? detectPlatform(url) : null), [url]);

  // Detail dialog
  const [selected, setSelected] = useState<TrackedProduct | null>(null);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [targetEdit, setTargetEdit] = useState("");
  const [busy, setBusy] = useState(false);

  const loadProducts = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("tracked_products")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    setProducts((data as TrackedProduct[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const resetForm = () => {
    setUrl("");
    setName("");
    setPrice("");
    setMrp("");
    setTarget("");
    setImageUrl("");
  };

  const handleAutoFetch = async () => {
    if (!isValidHttpUrl(url)) {
      toast({ title: "Enter a valid product URL", variant: "destructive" });
      return;
    }
    setFetching(true);
    const res = await fetchProductData(url);
    setFetching(false);

    if (res.data) {
      setName(res.data.product_name ?? "");
      if (res.data.current_price != null) setPrice(String(res.data.current_price));
      if (res.data.original_price != null) setMrp(String(res.data.original_price));
      if (res.data.image_url) setImageUrl(res.data.image_url);
      toast({ title: "Fetched product details", description: "Review and add to your tracker." });
    } else if (res.notDeployed) {
      toast({
        title: "Auto-fetch not available yet",
        description: "The price service isn't deployed. Enter the product name and price manually below.",
      });
    } else {
      toast({
        title: "Couldn't auto-fetch",
        description: (res.error ?? "Enter details manually.") + " You can still add it manually.",
        variant: "destructive",
      });
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidHttpUrl(url)) {
      toast({ title: "Enter a valid product URL", variant: "destructive" });
      return;
    }
    if (!name.trim()) {
      toast({ title: "Product name required", description: "Auto-fetch it or type it in.", variant: "destructive" });
      return;
    }
    const currentPrice = price ? parseFloat(price) : null;
    if (price && (Number.isNaN(currentPrice!) || currentPrice! <= 0)) {
      toast({ title: "Enter a valid current price", variant: "destructive" });
      return;
    }

    setAdding(true);
    const { error } = await supabase.rpc("add_tracked_product", {
      p_url: url.trim(),
      p_platform: detected?.platform ?? "other",
      p_product_name: name.trim(),
      p_image_url: imageUrl.trim() || null,
      p_current_price: currentPrice,
      p_original_price: mrp ? parseFloat(mrp) : null,
      p_currency: "INR",
      p_external_id: detected?.externalId ?? null,
      p_target_price: target ? parseFloat(target) : null,
      p_source: "manual",
    });
    setAdding(false);

    if (error) {
      toast({ title: "Could not add product", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Product added to tracker" });
      resetForm();
      void loadProducts();
    }
  };

  const openDetail = async (product: TrackedProduct) => {
    setSelected(product);
    setTargetEdit(product.target_price != null ? String(product.target_price) : "");
    setNewPrice("");
    setDetailLoading(true);
    const [histRes, statsRes] = await Promise.all([
      supabase.from("product_price_history").select("*").eq("product_id", product.id).order("checked_at", { ascending: true }),
      supabase.rpc("get_product_stats", { p_product_id: product.id }),
    ]);
    setHistory((histRes.data as PricePoint[]) ?? []);
    setStats(((statsRes.data as ProductStats[]) ?? [])[0] ?? null);
    setDetailLoading(false);
  };

  const refreshDetail = async (productId: string) => {
    const [histRes, statsRes, prodRes] = await Promise.all([
      supabase.from("product_price_history").select("*").eq("product_id", productId).order("checked_at", { ascending: true }),
      supabase.rpc("get_product_stats", { p_product_id: productId }),
      supabase.from("tracked_products").select("*").eq("id", productId).maybeSingle(),
    ]);
    setHistory((histRes.data as PricePoint[]) ?? []);
    setStats(((statsRes.data as ProductStats[]) ?? [])[0] ?? null);
    if (prodRes.data) setSelected(prodRes.data as TrackedProduct);
    void loadProducts();
  };

  const handleLogPrice = async () => {
    if (!selected) return;
    const p = parseFloat(newPrice);
    if (!p || p <= 0) {
      toast({ title: "Enter a valid price", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("log_product_price", {
      p_product_id: selected.id,
      p_price: p,
      p_source: "manual",
    });
    setBusy(false);
    if (error) {
      toast({ title: "Could not record price", description: error.message, variant: "destructive" });
    } else {
      setNewPrice("");
      toast({ title: "Price recorded" });
      await refreshDetail(selected.id);
    }
  };

  const handleSaveTarget = async () => {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase
      .from("tracked_products")
      .update({ target_price: targetEdit ? parseFloat(targetEdit) : null })
      .eq("id", selected.id);
    setBusy(false);
    if (error) {
      toast({ title: "Could not save target", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Target price saved" });
      await refreshDetail(selected.id);
    }
  };

  const toggleNotify = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("tracked_products")
      .update({ notify_enabled: !selected.notify_enabled })
      .eq("id", selected.id);
    if (!error) await refreshDetail(selected.id);
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("tracked_products").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not remove", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Removed from tracker" });
      setSelected(null);
      void loadProducts();
    }
  };

  const filtered = products.filter((p) => p.product_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LineChart className="w-6 h-6 text-primary" />
            Price Tracker
          </h1>
          <p className="text-muted-foreground">
            Track product prices over time and get data-driven buy recommendations.
          </p>
        </div>

        {/* Add product */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Track a new product</CardTitle>
            <CardDescription>
              Paste an Amazon, Flipkart, Myntra, AJIO or Meesho link. Auto-fetch details, or enter them manually.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <Label htmlFor="url">Product URL</Label>
                <div className="mt-1 flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://www.amazon.in/dp/..."
                      className="pl-10"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={handleAutoFetch} disabled={fetching || !url}>
                    {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    {fetching ? "" : "Auto-fetch"}
                  </Button>
                </div>
                {detected && url && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={detected.platform === "other" ? "secondary" : "approved"} className="capitalize">
                      {PLATFORM_LABELS[detected.platform] ?? detected.platform}
                    </Badge>
                    {detected.platform === "other" && (
                      <span className="text-xs text-muted-foreground">
                        Unrecognized platform — you can still track it manually.
                      </span>
                    )}
                    {detected.externalId && (
                      <span className="text-xs text-muted-foreground">ID: {detected.externalId}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="pname">Product name</Label>
                  <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sony WH-1000XM5" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="pprice">Current price (₹)</Label>
                  <Input id="pprice" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="pmrp">MRP / original (₹, optional)</Label>
                  <Input id="pmrp" type="number" min="0" value={mrp} onChange={(e) => setMrp(e.target.value)} placeholder="0" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="ptarget">Target price (₹, optional)</Label>
                  <Input id="ptarget" type="number" min="0" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Notify me at…" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="pimg">Image URL (optional)</Label>
                  <Input id="pimg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" className="mt-1" />
                </div>
              </div>

              <Button type="submit" disabled={adding} className="w-full sm:w-auto">
                {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Add to tracker
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Tracked products */}
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Your watchlist ({products.length})</h2>
          {products.length > 0 && (
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="pl-10" />
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-24 bg-secondary rounded mb-4" />
                  <div className="h-4 bg-secondary rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                <LineChart className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-semibold">{search ? "No matches" : "No products tracked yet"}</p>
              <p className="text-muted-foreground max-w-sm">
                {search ? "Try another search." : "Paste a product link above to start tracking its price and get buy recommendations."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => {
              const discount =
                p.original_price && p.current_price && p.original_price > p.current_price
                  ? Math.round(((p.original_price - p.current_price) / p.original_price) * 100)
                  : null;
              return (
                <Card key={p.id} className="hover:-translate-y-1 hover:shadow-lg transition-all cursor-pointer" onClick={() => openDetail(p)}>
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-xl bg-secondary/60 overflow-hidden shrink-0 flex items-center justify-center">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="w-full h-full object-contain" loading="lazy" />
                        ) : (
                          <LineChart className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-tight line-clamp-2">{p.product_name}</p>
                        <Badge variant="secondary" className="mt-1 capitalize text-xs">
                          {PLATFORM_LABELS[p.platform] ?? p.platform}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-xl font-bold">{money(p.current_price, p.currency)}</p>
                        {p.original_price && discount ? (
                          <p className="text-xs text-muted-foreground">
                            <span className="line-through">{money(p.original_price, p.currency)}</span>{" "}
                            <span className="text-success font-medium">{discount}% off</span>
                          </p>
                        ) : null}
                      </div>
                      {p.target_price != null && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Bell className="w-3 h-3" /> {money(p.target_price, p.currency)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="sr-only">{selected.product_name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Product header */}
                <div className="flex gap-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary/50 flex items-center justify-center">
                    {selected.image_url ? (
                      <img src={selected.image_url} alt="" className="h-full w-full object-contain" loading="lazy" />
                    ) : (
                      <LineChart className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug">{selected.product_name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">{PLATFORM_LABELS[selected.platform] ?? selected.platform}</Badge>
                      <a href={selected.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" /> Open
                      </a>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="num text-2xl font-bold">{money(stats?.current_price ?? selected.current_price, selected.currency)}</span>
                      {(() => {
                        const cur = stats?.current_price ?? selected.current_price;
                        const mrp = selected.original_price;
                        if (mrp && cur && mrp > cur) {
                          const off = Math.round(((mrp - cur) / mrp) * 100);
                          return (
                            <>
                              <span className="num text-sm text-muted-foreground line-through">{money(mrp, selected.currency)}</span>
                              <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-xs font-semibold text-success">{off}% off</span>
                            </>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>

                {detailLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : (
                  <>
                    {/* Should you buy now? */}
                    <div className="surface p-4">
                      <p className="mb-1 text-sm font-semibold">Should you buy now?</p>
                      {stats && stats.points >= 2 ? (
                        <PriceGauge
                          score={100 - Number(stats.pct_from_low)}
                          tone={RECOMMENDATION_DISPLAY[stats.recommendation].tone}
                          label={RECOMMENDATION_DISPLAY[stats.recommendation].label}
                          subLabel={
                            stats.recent_change !== 0
                              ? `${stats.recent_change > 0 ? "▲" : "▼"} ${Math.abs(stats.recent_change)}% vs last check`
                              : "Based on your recorded price history"
                          }
                        />
                      ) : (
                        <div className="py-4 text-center">
                          <p className="text-sm font-medium text-muted-foreground">Building price history…</p>
                          <p className="mt-1 text-xs text-muted-foreground">Record a few more prices (or enable auto-checks) to unlock a buy recommendation. No fake data is used.</p>
                        </div>
                      )}
                    </div>

                    {/* Price stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-success/20 bg-success/[0.07] p-2.5 text-center">
                        <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-success"><TrendingDown className="h-3 w-3" /> Lowest</p>
                        <p className="num mt-0.5 font-bold text-success">{money(stats?.lowest, selected.currency)}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-secondary/40 p-2.5 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Average</p>
                        <p className="num mt-0.5 font-bold">{money(stats?.average, selected.currency)}</p>
                      </div>
                      <div className="rounded-xl border border-destructive/20 bg-destructive/[0.06] p-2.5 text-center">
                        <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-destructive"><TrendingUp className="h-3 w-3" /> Highest</p>
                        <p className="num mt-0.5 font-bold">{money(stats?.highest, selected.currency)}</p>
                      </div>
                    </div>
                    <p className="text-center text-[11px] text-muted-foreground">
                      Tracking {stats?.points ?? history.length} price point{(stats?.points ?? history.length) === 1 ? "" : "s"} since you added this product.
                    </p>

                    <PriceChart history={history} currency={selected.currency} targetPrice={selected.target_price} />

                    {/* Log a new price */}
                    <div className="rounded-xl border border-border p-3 space-y-2">
                      <Label className="text-xs">Record current price</Label>
                      <div className="flex gap-2">
                        <Input type="number" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="Latest price you see" />
                        <Button onClick={handleLogPrice} disabled={busy} size="sm">
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log"}
                        </Button>
                      </div>
                    </div>

                    {/* Target price + alerts */}
                    <div className="rounded-xl border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Target price alert</Label>
                        <button onClick={toggleNotify} className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          {selected.notify_enabled ? <><Bell className="w-3 h-3" /> On</> : <><BellOff className="w-3 h-3" /> Off</>}
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <Input type="number" min="0" value={targetEdit} onChange={(e) => setTargetEdit(e.target.value)} placeholder="Notify me at ₹…" />
                        <Button onClick={handleSaveTarget} disabled={busy} size="sm" variant="outline">Save</Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        You'll get a notification when a recorded price drops to or below your target.
                      </p>
                    </div>

                    <Button variant="destructive" size="sm" onClick={() => handleRemove(selected.id)} className="w-full">
                      <Trash2 className="w-4 h-4 mr-2" /> Remove from tracker
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
