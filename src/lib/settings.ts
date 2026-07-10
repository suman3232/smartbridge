import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// The public support WhatsApp number is a single admin-editable value. Cache it
// at module level so the many places that show the "Chat with support" button
// don't each re-query it.
let cache: string | null | undefined; // undefined = not loaded yet, null = not set
let inflight: Promise<string | null> | null = null;

export async function getSupportWhatsApp(): Promise<string | null> {
  if (cache !== undefined) return cache;
  if (!inflight) {
    inflight = supabase
      .from("app_settings")
      .select("support_whatsapp")
      .eq("id", true)
      .maybeSingle()
      .then(({ data }) => {
        cache = data?.support_whatsapp ?? null;
        return cache;
      })
      .catch(() => {
        cache = null;
        return null;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Drop the cache so the next read re-fetches (e.g. after an admin updates it). */
export function clearSupportWhatsAppCache() {
  cache = undefined;
}

/**
 * React hook returning the support number.
 * `undefined` while loading, `null` if not configured, string when set.
 */
export function useSupportWhatsApp(): string | null | undefined {
  const [value, setValue] = useState<string | null | undefined>(cache);

  useEffect(() => {
    let active = true;
    void getSupportWhatsApp().then((v) => {
      if (active) setValue(v);
    });
    return () => {
      active = false;
    };
  }, []);

  return value;
}
