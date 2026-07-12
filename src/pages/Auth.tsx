import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthUI } from "@/components/ui/auth-fuse";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { formatAuthError } from "@/lib/auth-errors";
import { OAUTH_REDIRECT_KEY } from "@/lib/app-url";
import { supabase } from "@/lib/supabase";
import { EmailOtpVerification } from "@/components/auth/EmailOtpVerification";
import { storePendingReferral, getPendingReferral } from "@/lib/referral";
import { storePendingPhone } from "@/lib/pending-phone";
import { isValidPhone } from "@/lib/validation";
import { Gift } from "lucide-react";
import type { AuthError } from "@supabase/supabase-js";

const preferenceOptions = [
  { value: "create_deals", label: "Shop", description: "I need a product at a card discount" },
  { value: "accept_deals", label: "Earn", description: "I have cards and want to place orders for others" },
  { value: "both", label: "Both", description: "Shop sometimes, earn with my cards too" },
];

function signupRedirect(preferredRole: string): string {
  switch (preferredRole) {
    case "accept_deals":
      return "/deals";
    case "create_deals":
      return "/create-deal";
    case "both":
      return "/dashboard";
    default:
      return "/dashboard";
  }
}

export default function Auth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isSignUp = searchParams.get("mode") === "signup";
  const [loading, setLoading] = useState(false);
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [otpDestination, setOtpDestination] = useState("/dashboard");
  const [referralCode, setReferralCode] = useState<string | null>(null);

  const { signIn, signUp, signInWithGoogle, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";
  const { toast } = useToast();

  // Capture a referral code from the link (?ref=CODE) so it survives signup +
  // email verification and is applied after the account is verified.
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      storePendingReferral(ref);
      setReferralCode(ref.trim().toUpperCase());
    } else {
      const stored = getPendingReferral();
      if (stored) setReferralCode(stored);
    }
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const authError =
      params.get("error_description") ??
      hashParams.get("error_description") ??
      params.get("error") ??
      hashParams.get("error");
    const errorCode = params.get("error_code") ?? hashParams.get("error_code");

    if (authError || errorCode) {
      const decoded = decodeURIComponent((authError ?? errorCode ?? "").replace(/\+/g, " "));

      // Confirmation link opened in a DIFFERENT browser than the signup one:
      // the PKCE code exchange fails, but the email itself is already verified
      // server-side — tell the user to simply sign in instead of showing a
      // cryptic "code verifier" error.
      if (/code verifier|flow.?state|both auth code/i.test(decoded)) {
        toast({
          title: "Email verified ✓",
          description: "Your email is confirmed. Sign in with your email and password to continue.",
        });
        window.history.replaceState({}, "", "/auth");
        return;
      }

      toast({
        title: "Sign In Failed",
        description: formatAuthError({
          message: decoded,
          code: errorCode ?? (decoded.toLowerCase().includes("provider") ? "validation_failed" : undefined),
        } as AuthError),
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/auth");
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && user) {
      const stored = sessionStorage.getItem(OAUTH_REDIRECT_KEY);
      if (stored) {
        sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
        navigate(stored, { replace: true });
        return;
      }
      navigate(redirectTo, { replace: true });
    }
  }, [user, authLoading, navigate, redirectTo]);

  const handleSignIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error, session } = await signIn(email, password);

      if (error && error.code === "email_not_confirmed") {
        // Existing unverified account — move straight to OTP verification.
        setOtpDestination(redirectTo);
        setOtpEmail(email);
        return;
      }

      if (error) {
        toast({
          title: "Sign In Failed",
          description: formatAuthError(error),
          variant: "destructive",
        });
        return;
      }

      if (session) {
        navigate(redirectTo, { replace: true });
        return;
      }

      const { data: { session: refreshed } } = await supabase.auth.getSession();
      if (refreshed) {
        navigate(redirectTo, { replace: true });
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async ({
    fullName,
    email,
    phone,
    password,
    preferredRole,
  }: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    preferredRole: string;
  }) => {
    if (!fullName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your full name",
        variant: "destructive",
      });
      return;
    }

    if (!isValidPhone(phone)) {
      toast({
        title: "Enter a valid mobile number",
        description: "Include your country code, e.g. +91 98765 43210.",
        variant: "destructive",
      });
      return;
    }

    // Remember the number so it lands on the profile even if the DB trigger
    // doesn't persist it, and so it survives the email-OTP step.
    storePendingPhone(phone.trim());

    setLoading(true);
    try {
      const { error, session, needsEmailConfirmation } = await signUp(
        email,
        password,
        fullName,
        preferredRole,
        phone.trim(),
      );

      if (error) {
        toast({
          title: "Sign Up Failed",
          description: formatAuthError(error),
          variant: "destructive",
        });
        return;
      }

      const destination = redirectTo === "/dashboard" ? signupRedirect(preferredRole) : redirectTo;

      if (needsEmailConfirmation) {
        // Show the 6-digit OTP verification step. The stored referral code is
        // applied automatically once the email is verified.
        toast({
          title: "Check your inbox",
          description: `We sent a verification email to ${email} — enter its 6-digit code, or click its link.`,
        });
        setOtpDestination(destination);
        setOtpEmail(email);
        return;
      }

      if (session) {
        toast({
          title: "Account Created!",
          description: preferredRole === "accept_deals"
            ? "Browse open deals and start earning."
            : "Welcome — you're ready to go.",
        });
        navigate(destination, { replace: true });
        return;
      }

      const { data: { session: refreshed } } = await supabase.auth.getSession();
      if (refreshed) {
        navigate(destination, { replace: true });
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await signInWithGoogle(redirectTo);
      if (error) {
        toast({
          title: "Google Sign In Failed",
          description: formatAuthError(error),
          variant: "destructive",
        });
        setLoading(false);
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleModeChange = (signInMode: boolean) => {
    if (signInMode) {
      setSearchParams({});
    } else {
      setSearchParams({ mode: "signup" });
    }
  };

  // Don't flash the auth form while the session is resolving or if already
  // signed in (the effect above will redirect).
  if (authLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Email OTP verification step (only when Supabase "Confirm email" is enabled).
  if (otpEmail) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-background px-4">
        <header className="absolute left-0 top-0 z-50 px-4 py-3 md:px-8">
          <Link to="/" className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Link>
        </header>
        <EmailOtpVerification
          email={otpEmail}
          onVerified={() => navigate(otpDestination, { replace: true })}
          onBack={() => setOtpEmail(null)}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden border-0 bg-background outline-none">
      <header className="absolute left-0 top-0 z-50 flex items-center gap-3 px-4 py-3 md:w-1/2 md:px-8">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to home
        </Link>
        {referralCode && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 border border-success/20 px-3 py-1 text-xs font-medium text-success">
            <Gift className="h-3.5 w-3.5" />
            Referred · {referralCode}
          </span>
        )}
      </header>

      <AuthUI
        defaultSignIn={!isSignUp}
        loading={loading}
        preferenceOptions={preferenceOptions}
        onModeChange={handleModeChange}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onGoogleSignIn={handleGoogleSignIn}
      />
    </div>
  );
}
