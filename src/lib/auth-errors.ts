import type { AuthError } from "@supabase/supabase-js";

export function formatAuthError(error: AuthError | null): string {
  if (!error) return "Something went wrong. Please try again.";

  const message = error.message ?? "";

  if (
    error.code === "validation_failed" ||
    message.toLowerCase().includes("provider is not enabled") ||
    message.toLowerCase().includes("unsupported provider")
  ) {
    return "Google sign-in is not enabled. In Supabase Dashboard → Authentication → Providers → Google: enable it and add your OAuth Client ID and Secret.";
  }

  switch (error.code) {
    case "over_email_send_rate_limit":
      return 'Email sign-up is rate-limited. In Supabase → Authentication → Providers → Email, turn OFF "Confirm email", save, wait 2–3 minutes, then retry. If you already signed up, use Sign in.';
    case "email_not_confirmed":
      return "Please confirm your email first. Check your inbox for the verification link, or disable Confirm email in Supabase for local dev.";
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "user_already_registered":
      return "An account with this email already exists. Try signing in.";
    case "signup_disabled":
      return "Sign-ups are disabled on this project.";
    default:
      return message || "Something went wrong. Please try again.";
  }
}
