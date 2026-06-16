const DEFAULT_DEV_ORIGIN = "http://localhost:8080";

/** App origin for OAuth redirects — must match Supabase Site URL and dev server port. */
export function getAppOrigin(): string {
  const configured = import.meta.env.VITE_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;

  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  return DEFAULT_DEV_ORIGIN;
}

export function getAuthRedirectUrl(): string {
  return `${getAppOrigin()}/auth`;
}

export const OAUTH_REDIRECT_KEY = "oauth_post_login_path";
