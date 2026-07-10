import type { AuthError } from "@supabase/supabase-js";

const isDev = import.meta.env.DEV;

/** Detailed hint for developers (console + dev toasts); generic text in prod. */
function devHint(devText: string, prodText: string): string {
  return isDev ? devText : prodText;
}

export function formatAuthError(error: AuthError | null): string {
  if (!error) return "Something went wrong. Please try again.";

  const message = error.message ?? "";
  const lower = message.toLowerCase();

  if (
    error.code === "validation_failed" ||
    lower.includes("provider is not enabled") ||
    lower.includes("unsupported provider")
  ) {
    if (isDev) console.warn("[auth] Google provider not enabled — Supabase → Authentication → Providers → Google.");
    return devHint(
      "Google sign-in is not enabled. In Supabase → Authentication → Providers → Google: enable it and add your OAuth Client ID and Secret.",
      "Google sign-in is temporarily unavailable. Please try email sign-in or try again later.",
    );
  }

  switch (error.code) {
    case "over_email_send_rate_limit":
      return devHint(
        'Email sign-up is rate-limited. In Supabase → Authentication → Providers → Email, turn OFF "Confirm email", save, wait 2–3 minutes, then retry.',
        "Too many attempts. Please wait a couple of minutes and try again.",
      );
    case "email_not_confirmed":
      return "Please confirm your email first — check your inbox for the verification link.";
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "user_already_registered":
      return "An account with this email already exists. Try signing in.";
    case "signup_disabled":
      return "Sign-ups are currently disabled.";
    case "bad_oauth_state":
      if (isDev) console.warn("[auth] OAuth state mismatch — check Supabase Site URL / Redirect URLs match your app origin.");
      return devHint(
        "Google sign-in redirect mismatch. Ensure the app origin matches Supabase → Authentication → URL Configuration (Site URL + Redirect URLs).",
        "Google sign-in couldn't complete. Please try again in a fresh tab.",
      );
    default:
      if (lower.includes("oauth state")) {
        return "Google sign-in session expired. Please try again in a fresh tab.";
      }
      return message || "Something went wrong. Please try again.";
  }
}
