import { supabase } from "@/integrations/supabase/client";

const REFERRAL_KEY = "ob_referral_code";

/** Normalize a raw code (from ?ref= or manual entry). */
export function normalizeReferralCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase().slice(0, 16);
}

export function storePendingReferral(code: string) {
  const c = normalizeReferralCode(code);
  if (c) {
    try {
      localStorage.setItem(REFERRAL_KEY, c);
    } catch {
      /* ignore storage errors */
    }
  }
}

export function getPendingReferral(): string | null {
  try {
    return localStorage.getItem(REFERRAL_KEY);
  } catch {
    return null;
  }
}

export function clearPendingReferral() {
  try {
    localStorage.removeItem(REFERRAL_KEY);
  } catch {
    /* ignore */
  }
}

/** Build a short shareable referral link for a code (e.g. https://app/r/ABCD1234). */
export function buildReferralLink(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/r/${encodeURIComponent(code)}`;
}

/**
 * Apply any pending referral code for the (now verified) current user.
 * Safe to call repeatedly — the RPC is idempotent. Clears the stored code on a
 * definitive outcome so it isn't retried forever.
 */
export async function applyPendingReferral(): Promise<void> {
  const code = getPendingReferral();
  if (!code) return;

  const { data, error } = await supabase.rpc("apply_referral_code", { p_code: code });
  if (error) {
    // Network/transient — keep the code and try again next session.
    return;
  }

  const result = data as { applied?: boolean; reason?: string } | null;
  // Clear on any definitive outcome except "not verified" (retry after verify).
  if (result?.applied || (result?.reason && result.reason !== "not_verified")) {
    clearPendingReferral();
  }
}
