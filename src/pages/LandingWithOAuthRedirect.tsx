import { Navigate, useLocation } from "react-router-dom";
import Landing from "./Landing";

function hasOAuthCallback(search: string, hash: string): boolean {
  const params = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));

  return (
    params.has("code") ||
    params.has("error") ||
    params.has("error_code") ||
    hashParams.has("access_token") ||
    hashParams.has("error") ||
    hashParams.has("error_code")
  );
}

/** Send Supabase OAuth callbacks on `/` to `/auth` where the session is established. */
export default function LandingWithOAuthRedirect() {
  const location = useLocation();

  if (hasOAuthCallback(location.search, location.hash)) {
    return <Navigate to={`/auth${location.search}${location.hash}`} replace />;
  }

  return <Landing />;
}
