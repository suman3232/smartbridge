import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// The public support WhatsApp number is a single admin-editable value. Cache it
// at module level so the many places that show the "Chat with support" button
// don't each re-query it.
let cache: string | null | undefined; // undefined = not loaded yet, null = not set
let inflight: Promise<string | null> | null = null;

// Fallback used when the admin hasn't saved a number in the DB yet (or the
// app_settings table isn't created). Set VITE_SUPPORT_WHATSAPP in your host
// env (e.g. Vercel) to switch on the support button without any DB change.
const ENV_FALLBACK: string | null =
  ((import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) ?? "").trim() || null;

// Built-in default so the support button works even before the admin panel or
// env are configured. A saved DB value or VITE_SUPPORT_WHATSAPP overrides this.
const DEFAULT_SUPPORT_WHATSAPP = "+91 74397 25713";

export async function getSupportWhatsApp(): Promise<string | null> {
  if (cache !== undefined) return cache;
  if (!inflight) {
    inflight = supabase
      .from("app_settings")
      .select("support_whatsapp")
      .eq("id", true)
      .maybeSingle()
      .then(({ data }) => {
        cache = data?.support_whatsapp ?? ENV_FALLBACK ?? DEFAULT_SUPPORT_WHATSAPP;
        return cache;
      })
      .catch(() => {
        cache = ENV_FALLBACK ?? DEFAULT_SUPPORT_WHATSAPP;
        return cache;
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

// ---------------------------------------------------------------------------
// Reservation window (admin-tunable) — used so UI copy matches the real config
// instead of hard-coding "30 minutes" / "5 minutes".
// ---------------------------------------------------------------------------
export type ReservationWindow = { holdMinutes: number; graceMinutes: number };

const DEFAULT_WINDOW: ReservationWindow = { holdMinutes: 30, graceMinutes: 5 };
let windowCache: ReservationWindow | undefined;
let windowInflight: Promise<ReservationWindow> | null = null;

export async function getReservationWindow(): Promise<ReservationWindow> {
  if (windowCache) return windowCache;
  if (!windowInflight) {
    windowInflight = supabase
      .from("reservation_config")
      .select("hold_seconds, release_grace_seconds")
      .eq("id", true)
      .maybeSingle()
      .then(({ data }) => {
        windowCache = data
          ? {
              holdMinutes: Math.max(1, Math.round(data.hold_seconds / 60)),
              graceMinutes: Math.max(0, Math.round(data.release_grace_seconds / 60)),
            }
          : DEFAULT_WINDOW;
        return windowCache;
      })
      .catch(() => {
        windowCache = DEFAULT_WINDOW;
        return windowCache;
      })
      .finally(() => {
        windowInflight = null;
      });
  }
  return windowInflight;
}

/** Hook variant; resolves to the defaults until the config row loads. */
export function useReservationWindow(): ReservationWindow {
  const [value, setValue] = useState<ReservationWindow>(windowCache ?? DEFAULT_WINDOW);

  useEffect(() => {
    let active = true;
    void getReservationWindow().then((v) => {
      if (active) setValue(v);
    });
    return () => {
      active = false;
    };
  }, []);

  return value;
}
