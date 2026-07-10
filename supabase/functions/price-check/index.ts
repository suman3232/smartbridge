// Supabase Edge Function: price-check
// ---------------------------------------------------------------------------
// Two modes:
//   POST { url }            -> fetch + return a normalized product PREVIEW (no store)
//   POST { mode: "cron" }   -> recheck every tracked product, store new price
//                              points and send target-price notifications.
//
// Price data is fetched SERVER-SIDE (no browser CORS limits). By default it does
// a direct fetch of the product page and parses JSON-LD / OpenGraph meta tags
// (best-effort, no API key). For reliable results (esp. Amazon, which blocks
// bots) set SCRAPER_API_KEY and requests are routed through ScraperAPI.
//
// Deploy:  supabase functions deploy price-check
// Secrets: supabase secrets set SCRAPER_API_KEY=xxxx   (optional but recommended)
// The SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY secrets are injected automatically.
// ---------------------------------------------------------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

type Platform = "amazon" | "flipkart" | "myntra" | "ajio" | "meesho" | "other";

function detectPlatform(rawUrl: string): { platform: Platform; externalId: string | null } {
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

async function fetchHtml(url: string): Promise<string> {
  const key = Deno.env.get("SCRAPER_API_KEY");
  const target = key
    ? `https://api.scraperapi.com/?api_key=${key}&country_code=in&url=${encodeURIComponent(url)}`
    : url;
  const res = await fetch(target, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      "Accept-Language": "en-IN,en;q=0.9",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Upstream ${res.status}`);
  return await res.text();
}

type Normalized = {
  product_name: string | null;
  image_url: string | null;
  current_price: number | null;
  original_price: number | null;
  currency: string;
  availability: string | null;
  seller: string | null;
};

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseProduct(html: string): Normalized {
  const out: Normalized = {
    product_name: null, image_url: null, current_price: null,
    original_price: null, currency: "INR", availability: null, seller: null,
  };

  // 1) JSON-LD Product blocks
  const ldMatches = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of ldMatches) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : parsed["@graph"] ?? [parsed];
      for (const node of nodes) {
        const type = node?.["@type"];
        const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
        if (!isProduct) continue;
        out.product_name ||= node.name ?? null;
        out.image_url ||= Array.isArray(node.image) ? node.image[0] : node.image ?? null;
        const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
        if (offers) {
          out.current_price ||= num(offers.price ?? offers.lowPrice);
          out.currency = offers.priceCurrency ?? out.currency;
          if (offers.availability) out.availability ||= String(offers.availability).split("/").pop() ?? null;
          out.seller ||= offers.seller?.name ?? null;
        }
      }
    } catch { /* ignore malformed JSON-LD */ }
  }

  // 2) OpenGraph / meta fallbacks
  const meta = (prop: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
    return html.match(re)?.[1] ?? null;
  };
  out.product_name ||= meta("og:title");
  out.image_url ||= meta("og:image");
  out.current_price ||= num(meta("product:price:amount") ?? meta("og:price:amount"));

  // 3) Last resort: first "₹NN,NNN" occurrence
  if (out.current_price == null) {
    const m = html.match(/₹\s?([0-9][0-9,]{2,})/);
    out.current_price = m ? num(m[1]) : null;
  }
  return out;
}

async function getProduct(url: string): Promise<Normalized & { platform: string; external_id: string | null }> {
  const { platform, externalId } = detectPlatform(url);
  const html = await fetchHtml(url);
  const parsed = parseProduct(html);
  return { ...parsed, platform, external_id: externalId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let body: { url?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // ---- CRON MODE: recheck all tracked products (service role) ----
  if (body.mode === "cron") {
    // Only the scheduler (which knows CRON_SECRET) may trigger batch writes.
    const secret = Deno.env.get("CRON_SECRET");
    if (secret && req.headers.get("x-cron-secret") !== secret) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: products, error } = await supabase.from("tracked_products").select("*");
    if (error) return json({ error: error.message }, 500);

    let checked = 0, updated = 0, alerts = 0;
    for (const p of products ?? []) {
      checked++;
      try {
        const info = await getProduct(p.url);
        if (info.current_price == null) continue;

        const changed = p.current_price == null || Number(p.current_price) !== info.current_price;
        if (changed) {
          await supabase.from("product_price_history").insert({
            product_id: p.id, price: info.current_price,
            original_price: info.original_price, availability: info.availability, source: "auto",
          });
          await supabase.from("tracked_products").update({
            current_price: info.current_price,
            original_price: info.original_price ?? p.original_price,
            availability: info.availability ?? p.availability,
            last_checked_at: new Date().toISOString(),
          }).eq("id", p.id);
          updated++;
        } else {
          await supabase.from("tracked_products").update({ last_checked_at: new Date().toISOString() }).eq("id", p.id);
        }

        if (
          p.notify_enabled && p.target_price != null &&
          info.current_price <= Number(p.target_price) &&
          (p.last_alerted_price == null || Number(p.last_alerted_price) !== info.current_price)
        ) {
          await supabase.from("tracked_products").update({ last_alerted_price: info.current_price }).eq("id", p.id);
          await supabase.from("notifications").insert({
            user_id: p.user_id, title: "Price drop alert",
            message: `${p.product_name} is now ₹${info.current_price} (target ₹${p.target_price}).`,
            type: "success", link: "/tracker",
          });
          alerts++;
        }
      } catch { /* skip this product on error */ }
    }
    return json({ ok: true, checked, updated, alerts });
  }

  // ---- PREVIEW MODE: fetch a single product for the add form ----
  if (!body.url) return json({ error: "url is required" }, 400);
  try {
    const info = await getProduct(body.url);
    if (!info.product_name && info.current_price == null) {
      return json({ error: "Could not extract product details from this page. Add it manually." }, 422);
    }
    return json({ product: info });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Fetch failed" }, 502);
  }
});
