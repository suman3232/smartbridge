import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthUI } from "@/components/ui/auth-fuse";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { formatAuthError } from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase";
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

  const { signIn, signUp, signInWithGoogle, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const authError = params.get("error_description") ?? hashParams.get("error_description");

    if (authError) {
      const decoded = decodeURIComponent(authError.replace(/\+/g, " "));
      toast({
        title: "Sign In Failed",
        description: formatAuthError({
          message: decoded,
          code: decoded.toLowerCase().includes("provider") ? "validation_failed" : undefined,
        } as AuthError),
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, authLoading, navigate, redirectTo]);

  const handleSignIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error, session } = await signIn(email, password);
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
    password,
    preferredRole,
  }: {
    fullName: string;
    email: string;
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

    setLoading(true);
    try {
      const { error, session, needsEmailConfirmation } = await signUp(
        email,
        password,
        fullName,
        preferredRole,
      );

      if (error) {
        toast({
          title: "Sign Up Failed",
          description: formatAuthError(error),
          variant: "destructive",
        });
        return;
      }

      if (needsEmailConfirmation) {
        toast({
          title: "Confirm your email",
          description:
            "We sent a verification link. Open it, then sign in. For local dev, you can turn off Confirm email in Supabase → Authentication → Providers → Email.",
        });
        setSearchParams({});
        return;
      }

      const destination = redirectTo === "/dashboard" ? signupRedirect(preferredRole) : redirectTo;

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
      const { error } = await signInWithGoogle();
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

  return (
    <div className="relative min-h-screen overflow-x-hidden border-0 bg-background outline-none">
      <header className="absolute left-0 top-0 z-20 px-4 py-3 md:w-1/2 md:px-8">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to home
        </Link>
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
