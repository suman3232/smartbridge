import { supabase } from "@/integrations/supabase/client";

export type Platform = "amazon" | "flipkart" | "myntra" | "ajio" | "meesho" | "other";

export type TrackedProduct = {
  id: string;
  user_id: string;
  url: string;
  platform: string;
  external_id: string | null;
  product_name: string;
  image_url: string | null;
  currency: string;
  current_price: number | null;
  original_price: number | null;
  availability: string | null;
  seller: string | null;
  target_price: number | null;
  notify_enabled: boolean;
  last_alerted_price: number | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PricePoint = {
  id: string;
  product_id: string;
  price: number;
  original_price: number | null;
  availability: string | null;
  source: string;
  checked_at: string;
};

export type ProductStats = {
  points: number;
  current_price: number | null;
  lowest: number | null;
  highest: number | null;
  average: number | null;
  first_price: number | null;
  previous_price: number | null;
  recommendation: "excellent" | "good" | "fair" | "wait" | "building";
  pct_from_low: number;
  recent_change: number;
};

export const PLATFORM_LABELS: Record<string, string> = {
  amazon: "Amazon",
  flipkart: "Flipkart",
  myntra: "Myntra",
  ajio: "AJIO",
  meesho: "Meesho",
  other: "Other",
};

/** Supported platforms whose URLs we can reliably detect. */
export const SUPPORTED_PLATFORMS: Platform[] = ["amazon", "flipkart", "myntra", "ajio", "meesho"];

export function detectPlatform(rawUrl: string): { platform: Platform; externalId: string | null } {
  let host = "";
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return { platform: "other", externalId: null };
  }

  if (host.includes("amazon.")) {
    const m = rawUrl.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
    return { platform: "amazon", externalId: m ? m[1].toUpperCase() : null };
  }
  if (host.includes("flipkart.")) {
    const m = rawUrl.match(/[?&]pid=([A-Z0-9]+)/i) || rawUrl.match(/\/p\/(itm[a-z0-9]+)/i);
    return { platform: "flipkart", externalId: m ? m[1] : null };
  }
  if (host.includes("myntra.")) {
    const m = rawUrl.match(/\/(\d{6,})\/buy/);
    return { platform: "myntra", externalId: m ? m[1] : null };
  }
  if (host.includes("ajio.")) return { platform: "ajio", externalId: null };
  if (host.includes("meesho.")) return { platform: "meesho", externalId: null };
  return { platform: "other", externalId: null };
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export type Recommendation = ProductStats["recommendation"];

export const RECOMMENDATION_DISPLAY: Record<
  Recommendation,
  { label: string; tone: "excellent" | "good" | "fair" | "wait" | "neutral" }
> = {
  excellent: { label: "Excellent price — near historical low", tone: "excellent" },
  good: { label: "Good time to buy", tone: "good" },
  fair: { label: "Fair price — around the usual", tone: "fair" },
  wait: { label: "Consider waiting for a better price", tone: "wait" },
  building: { label: "Building price history — check back after more updates", tone: "neutral" },
};

export type FetchedProduct = {
  product_name: string;
  image_url: string | null;
  current_price: number | null;
  original_price: number | null;
  currency: string;
  availability: string | null;
  seller: string | null;
  external_id: string | null;
  platform: string;
};

/**
 * Try to auto-fetch product data via the `price-check` Edge Function.
 * Returns { data } on success, or { error, notDeployed } so the UI can fall
 * back to manual entry. This never throws.
 */
export async function fetchProductData(
  url: string,
): Promise<{ data?: FetchedProduct; error?: string; notDeployed?: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke("price-check", {
      body: { url },
    });
    if (error) {
      const msg = error.message || "Auto-fetch failed";
      const notDeployed =
        msg.toLowerCase().includes("not found") ||
        msg.toLowerCase().includes("failed to fetch") ||
        msg.toLowerCase().includes("failed to send");
      return { error: msg, notDeployed };
    }
    if (data?.error) return { error: data.error };
    if (data?.product) return { data: data.product as FetchedProduct };
    return { error: "No product data returned" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Auto-fetch unavailable", notDeployed: true };
  }
}
