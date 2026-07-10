import * as React from "react";
import { useState, useId, useEffect } from "react";
import { Eye, EyeOff, LogIn, Sparkles, CreditCard, Wallet, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  compact?: boolean;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, id: idProp, compact, ...props }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className={cn("grid w-full items-center", compact ? "gap-1" : "gap-2")}>
        {label && <Label htmlFor={id}>{label}</Label>}
        <div className="relative">
          <Input
            id={id}
            type={showPassword ? "text" : "password"}
            className={cn(compact && "h-9", "pe-10", className)}
            ref={ref}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 end-0 flex h-full w-10 items-center justify-center text-muted-foreground/80 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export interface PreferenceOption {
  value: string;
  label: string;
  description: string;
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GoogleSignInButton({
  loading,
  onGoogleSignIn,
}: {
  loading?: boolean;
  onGoogleSignIn: () => void | Promise<void>;
}) {
  return (
    <>
      <div className="relative py-1 text-center text-xs after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
        <span className="relative z-10 bg-background px-2 text-muted-foreground">
          Or continue with
        </span>
      </div>
      <Button variant="outline" type="button" className="h-9" disabled={loading} onClick={onGoogleSignIn}>
        <GoogleIcon />
        Continue with Google
      </Button>
    </>
  );
}

interface SignInFormProps {
  loading?: boolean;
  onSubmit: (email: string, password: string) => void | Promise<void>;
  onGoogleSignIn?: () => void | Promise<void>;
  onToggle: () => void;
}

function SignInForm({ loading, onSubmit, onGoogleSignIn, onToggle }: SignInFormProps) {
  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    await onSubmit(email, password);
  };

  return (
    <form onSubmit={handleSignIn} autoComplete="on" className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          <LogIn className="size-3" />
          Sign in
        </span>
        <h1 className="font-display text-xl font-bold">Welcome back</h1>
      </div>
      <div className="grid gap-2.5">
        <div className="grid gap-1">
          <Label htmlFor="signin-email">Email</Label>
          <Input
            id="signin-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            className="h-9"
            required
            autoComplete="email"
            disabled={loading}
          />
        </div>
        <PasswordInput
          id="signin-password"
          name="password"
          label="Password"
          compact
          required
          autoComplete="current-password"
          placeholder="Password"
          minLength={6}
          disabled={loading}
        />
        <Button type="submit" variant="hero" className="h-9" disabled={loading}>
          {loading ? "Signing in…" : "Sign In"}
        </Button>
        {onGoogleSignIn && <GoogleSignInButton loading={loading} onGoogleSignIn={onGoogleSignIn} />}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Button variant="link" className="h-auto p-0 text-xs" onClick={onToggle} disabled={loading} type="button">
          Sign up
        </Button>
      </p>
    </form>
  );
}

interface SignUpFormProps {
  loading?: boolean;
  preferenceOptions: PreferenceOption[];
  defaultPreferredRole?: string;
  onSubmit: (data: {
    fullName: string;
    email: string;
    password: string;
    preferredRole: string;
  }) => void | Promise<void>;
  onGoogleSignIn?: () => void | Promise<void>;
  onToggle: () => void;
}

function SignUpForm({
  loading,
  preferenceOptions,
  defaultPreferredRole = "both",
  onSubmit,
  onGoogleSignIn,
  onToggle,
}: SignUpFormProps) {
  const [preferredRole, setPreferredRole] = useState(defaultPreferredRole);

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fullName = (form.elements.namedItem("name") as HTMLInputElement).value;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    await onSubmit({ fullName, email, password, preferredRole });
  };

  return (
    <form onSubmit={handleSignUp} autoComplete="on" className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          <Sparkles className="size-3" />
          New account
        </span>
        <h1 className="font-display text-xl font-bold">Join OfferBridge</h1>
      </div>
      <div className="grid gap-2">
        <div className="grid gap-1">
          <Label htmlFor="signup-name">Full Name</Label>
          <Input
            id="signup-name"
            name="name"
            type="text"
            placeholder="John Doe"
            className="h-9"
            required
            autoComplete="name"
            disabled={loading}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            className="h-9"
            required
            autoComplete="email"
            disabled={loading}
          />
        </div>
        <PasswordInput
          id="signup-password"
          name="password"
          label="Password"
          compact
          required
          autoComplete="new-password"
          placeholder="Password"
          minLength={6}
          disabled={loading}
        />
        <div className="grid gap-1">
          <Label className="text-xs">I want to</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {preferenceOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={loading}
                onClick={() => setPreferredRole(option.value)}
                title={option.description}
                className={cn(
                  "rounded-md border px-2 py-2 text-center text-xs font-medium transition-colors",
                  preferredRole === option.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" variant="hero" className="h-9" disabled={loading}>
          {loading ? "Creating account…" : "Sign Up"}
        </Button>
        {onGoogleSignIn && <GoogleSignInButton loading={loading} onGoogleSignIn={onGoogleSignIn} />}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Button variant="link" className="h-auto p-0 text-xs" onClick={onToggle} disabled={loading} type="button">
          Sign in
        </Button>
      </p>
    </form>
  );
}

interface AuthFormContainerProps {
  isSignIn: boolean;
  loading?: boolean;
  preferenceOptions: PreferenceOption[];
  onToggle: () => void;
  onSignIn: (email: string, password: string) => void | Promise<void>;
  onSignUp: (data: {
    fullName: string;
    email: string;
    password: string;
    preferredRole: string;
  }) => void | Promise<void>;
  onGoogleSignIn?: () => void | Promise<void>;
}

function AuthFormContainer({
  isSignIn,
  loading,
  preferenceOptions,
  onToggle,
  onSignIn,
  onSignUp,
  onGoogleSignIn,
}: AuthFormContainerProps) {
  return (
    <div className="mx-auto w-full max-w-[380px]">
      {isSignIn ? (
        <SignInForm
          loading={loading}
          onSubmit={onSignIn}
          onGoogleSignIn={onGoogleSignIn}
          onToggle={onToggle}
        />
      ) : (
        <SignUpForm
          loading={loading}
          preferenceOptions={preferenceOptions}
          onSubmit={onSignUp}
          onGoogleSignIn={onGoogleSignIn}
          onToggle={onToggle}
        />
      )}
    </div>
  );
}

export interface AuthUIProps {
  defaultSignIn?: boolean;
  loading?: boolean;
  preferenceOptions?: PreferenceOption[];
  onModeChange?: (isSignIn: boolean) => void;
  onSignIn: (email: string, password: string) => void | Promise<void>;
  onSignUp: (data: {
    fullName: string;
    email: string;
    password: string;
    preferredRole: string;
  }) => void | Promise<void>;
  onGoogleSignIn?: () => void | Promise<void>;
}

const authSplineCopy = {
  signin: {
    badge: "Sign in",
    title: "Welcome back",
    subtitle: "Access your dashboard, deals, and wallet.",
  },
  signup: {
    badge: "Create account",
    title: "Use your card. Earn on every order.",
    subtitle: "Join shoppers and card holders on OfferBridge.",
  },
} as const;

const authHighlights = [
  { icon: CreditCard, title: "Use your card", desc: "Place orders on cards you own and earn on every deal." },
  { icon: Wallet, title: "Reimbursed + commission", desc: "Get the order cost back plus a cash reward in your wallet." },
  { icon: ShieldCheck, title: "Admin-verified payouts", desc: "KYC-verified withdrawals straight to your bank account." },
];

function AuthSplinePanel({ isSignIn }: { isSignIn: boolean }) {
  const copy = isSignIn ? authSplineCopy.signin : authSplineCopy.signup;

  return (
    <div className="relative h-[min(680px,calc(100vh-4rem))] w-full overflow-hidden rounded-3xl border border-white/[0.06] bg-background">
      {/* Lightweight branded backdrop (replaces the heavy 3D scene) */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,hsl(217_91%_60%/0.18),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_90%,hsl(217_91%_60%/0.10),transparent_50%)]" />
      <div className="pointer-events-none absolute -right-16 top-1/3 h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-float" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 flex h-full flex-col justify-center p-8 lg:p-12">
        <span className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          {isSignIn ? <LogIn className="size-3" /> : <Sparkles className="size-3" />}
          {copy.badge}
        </span>
        <h2 className="font-display text-3xl font-bold tracking-tight text-transparent bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text lg:text-4xl">
          {copy.title}
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground lg:text-base">
          {copy.subtitle}
        </p>

        <div className="mt-10 space-y-4">
          {authHighlights.map((h) => (
            <div key={h.title} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.07]">
                <h.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{h.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{h.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AuthUI({
  defaultSignIn = true,
  loading,
  preferenceOptions = [],
  onModeChange,
  onSignIn,
  onSignUp,
  onGoogleSignIn,
}: AuthUIProps) {
  const [isSignIn, setIsSignIn] = useState(defaultSignIn);

  useEffect(() => {
    setIsSignIn(defaultSignIn);
  }, [defaultSignIn]);

  const toggleForm = () => {
    const next = !isSignIn;
    setIsSignIn(next);
    onModeChange?.(next);
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden border-0 bg-background outline-none md:grid md:grid-cols-2">
      <style>{`
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear {
          display: none;
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-20 bottom-1/4 h-72 w-72 rounded-full bg-primary/8 blur-3xl" />
      </div>

      <div className="relative z-30 flex min-h-screen items-center justify-center px-6 pb-10 pt-20 md:px-10 md:py-14 md:pt-16">
        <AuthFormContainer
          isSignIn={isSignIn}
          loading={loading}
          preferenceOptions={preferenceOptions}
          onToggle={toggleForm}
          onSignIn={onSignIn}
          onSignUp={onSignUp}
          onGoogleSignIn={onGoogleSignIn}
        />
      </div>

      <div className="relative z-0 hidden min-h-screen items-center p-6 md:flex lg:p-8">
        <AuthSplinePanel isSignIn={isSignIn} />
      </div>
    </div>
  );
}
