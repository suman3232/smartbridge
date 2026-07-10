import { Navigate, useParams } from "react-router-dom";
import { storePendingReferral, normalizeReferralCode } from "@/lib/referral";

/** Short shareable link `/r/CODE` → stores the code and sends to signup. */
export function ReferralRedirect() {
  const { code } = useParams<{ code: string }>();
  const clean = normalizeReferralCode(code);
  if (clean) storePendingReferral(clean);
  return <Navigate to={`/auth?mode=signup&ref=${encodeURIComponent(clean)}`} replace />;
}
