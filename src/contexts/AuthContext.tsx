import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { getAuthRedirectUrl, OAUTH_REDIRECT_KEY } from "@/lib/app-url";
import { supabase, Profile } from "@/lib/supabase";
import { applyPendingReferral } from "@/lib/referral";
import { getPendingPhone, clearPendingPhone } from "@/lib/pending-phone";


export type AuthResult = {
  error: AuthError | null;
  session: Session | null;
  needsEmailConfirmation: boolean;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isVerified: boolean;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, preferredRole: string, phone?: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: (postLoginPath?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  // Tracks the user id whose profile/role we've already loaded, so the two init
  // paths (onAuthStateChange INITIAL_SESSION + getSession) don't double-fetch.
  const loadedUserId = useRef<string | null>(null);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as Profile);
      return data as Profile;
    }
    return null;
  };

  // If the user entered a mobile number at signup but the profile doesn't have
  // one yet (e.g. an older DB trigger didn't persist it), write it now. Runs
  // once a session exists, so it also covers the post-OTP-verification case.
  const backfillPhone = async (userId: string, current: Profile | null) => {
    const pending = getPendingPhone();
    if (!pending) return;
    if (current?.phone?.trim()) {
      clearPendingPhone();
      return;
    }
    const { error } = await supabase.from("profiles").update({ phone: pending }).eq("id", userId);
    if (!error) {
      clearPendingPhone();
      await fetchProfile(userId);
    }
  };

  const checkAdminRole = async (userId: string) => {
    // Read our own role row directly (RLS: "Users can view their own roles").
    // is_admin() RPC is intentionally not client-callable (enumeration oracle).
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    setIsAdmin(!!roleRow);
  };

  const loadUserData = async (userId: string) => {
    const [prof] = await Promise.all([fetchProfile(userId), checkAdminRole(userId)]);
    await backfillPhone(userId, prof);
  };

  const applySession = async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    try {
      if (nextSession?.user) {
        // Skip if we've already loaded this user's data (dedup double init).
        if (loadedUserId.current !== nextSession.user.id) {
          loadedUserId.current = nextSession.user.id;
          await loadUserData(nextSession.user.id);
          // Attribute any pending referral once the user is verified (email OTP
          // done, or a Google user who is verified by default). Fire-and-forget.
          if (nextSession.user.email_confirmed_at) {
            void applyPendingReferral();
          }
        }
      } else {
        loadedUserId.current = null;
        setProfile(null);
        setIsAdmin(false);
      }
    } finally {
      // Always resolve loading, even if profile/role fetch throws, so the app
      // never gets stuck on the full-screen spinner.
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Defer Supabase calls — avoids missed profile/admin loads after OAuth (Supabase recommendation)
      setTimeout(() => {
        if (mounted) void applySession(nextSession);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      if (mounted) void applySession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, preferredRole: string, phone?: string): Promise<AuthResult> => {
    const redirectUrl = getAuthRedirectUrl();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          preferred_role: preferredRole,
          ...(phone?.trim() ? { phone: phone.trim() } : {}),
        },
      },
    });

    return {
      error,
      session: data.session,
      needsEmailConfirmation: !error && !!data.user && !data.session,
    };
  };

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return {
      error,
      session: data.session,
      needsEmailConfirmation: false,
    };
  };

  const signInWithGoogle = async (postLoginPath = "/dashboard") => {
    sessionStorage.setItem(OAUTH_REDIRECT_KEY, postLoginPath);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthRedirectUrl(),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (!error && data.url) {
      window.location.assign(data.url);
      return { error: null };
    }

    // No redirect URL and no error → synthesize one so the caller can reset its
    // loading state instead of hanging on a disabled button forever.
    if (!error && !data.url) {
      return { error: { message: "Could not start Google sign-in. Please try again." } as AuthError };
    }

    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    // Local state is cleared by the SIGNED_OUT auth event; clear here too as a
    // safety net only when the server sign-out succeeded.
    if (!error) {
      setProfile(null);
      setIsAdmin(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
      await checkAdminRole(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      isAdmin,
      isVerified: !!user?.email_confirmed_at,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
