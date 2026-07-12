import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { MailCheck, Loader2, ArrowLeft } from "lucide-react";

const RESEND_COOLDOWN = 60; // seconds

interface EmailOtpVerificationProps {
  email: string;
  onVerified: () => void;
  onBack?: () => void;
}

export function EmailOtpVerification({ email, onVerified, onBack }: EmailOtpVerificationProps) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async (token: string) => {
    if (token.length !== 6 || verifying) return;
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
    setVerifying(false);

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      const friendly =
        msg.includes("expired")
          ? "That code has expired. Tap Resend to get a new one."
          : msg.includes("invalid") || msg.includes("token")
            ? "Incorrect code. Please check and try again."
            : error.message || "Verification failed. Please try again.";
      toast({ title: "Verification failed", description: friendly, variant: "destructive" });
      setCode("");
      return;
    }

    verifiedRef.current = true;
    toast({ title: "Email verified", description: "Welcome to OfferBridge!" });
    onVerified();
  };

  const resend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    if (error) {
      const friendly = /rate limit/i.test(error.message)
        ? "Email limit reached for now. Use the link in the email you already received, or try resending in a while."
        : error.message;
      toast({ title: "Couldn't resend", description: friendly, variant: "destructive" });
      return;
    }
    setCooldown(RESEND_COOLDOWN);
    toast({ title: "Code sent", description: `A new 6-digit code is on its way to ${email}.` });
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <MailCheck className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Verify your email</h2>
          <p className="text-sm text-muted-foreground mt-1">
            We sent a verification email to <span className="font-medium text-foreground">{email}</span>.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Enter the 6-digit code from the email — or if it shows a confirmation <span className="font-medium text-foreground">link</span>,
            just click it and this page will continue automatically.
          </p>
        </div>
      </div>

      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(v) => {
            setCode(v);
            if (v.length === 6) void verify(v);
          }}
          disabled={verifying}
        >
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      <Button onClick={() => void verify(code)} disabled={verifying || code.length !== 6} className="w-full">
        {verifying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying…</> : "Verify email"}
      </Button>

      <div className="text-sm text-muted-foreground">
        Didn't get it?{" "}
        <button
          type="button"
          onClick={() => void resend()}
          disabled={cooldown > 0 || resending}
          className="font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {resending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>

      {onBack && (
        <button type="button" onClick={onBack} className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Use a different email
        </button>
      )}
    </div>
  );
}
