import { useId } from "react";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
}

export function LogoMark({ className }: LogoMarkProps) {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="8" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(217, 91%, 60%)" />
          <stop offset="1" stopColor="hsl(199, 89%, 58%)" />
        </linearGradient>
      </defs>
      <rect x="5" y="19" width="7" height="15" rx="2" fill={`url(#${gradientId})`} opacity="0.9" />
      <rect x="28" y="19" width="7" height="15" rx="2" fill={`url(#${gradientId})`} opacity="0.9" />
      <path
        d="M12 23.5C12 23.5 17.5 12.5 20 12.5C22.5 12.5 28 23.5 28 23.5"
        stroke={`url(#${gradientId})`}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="20" cy="22" r="3.5" fill="hsl(222, 47%, 6%)" stroke={`url(#${gradientId})`} strokeWidth="2" />
    </svg>
  );
}

const sizeStyles = {
  sm: { mark: "w-7 h-7", text: "text-sm", gap: "gap-2" },
  md: { mark: "w-9 h-9", text: "text-base", gap: "gap-2.5" },
  lg: { mark: "w-12 h-12", text: "text-xl", gap: "gap-3" },
} as const;

interface LogoProps {
  size?: keyof typeof sizeStyles;
  showWordmark?: boolean;
  className?: string;
}

export function Logo({ size = "md", showWordmark = true, className }: LogoProps) {
  const s = sizeStyles[size];

  return (
    <div className={cn("flex items-center", s.gap, className)}>
      <div
        className={cn(
          "rounded-[0.65rem] border border-white/10 bg-white/[0.04] flex items-center justify-center p-1",
          size === "lg" ? "rounded-xl p-1.5" : ""
        )}
      >
        <LogoMark className={s.mark} />
      </div>
      {showWordmark && (
        <span className={cn("font-display font-semibold tracking-tight leading-none", s.text)}>
          <span className="text-foreground">Offer</span>
          <span className="text-primary">Bridge</span>
        </span>
      )}
    </div>
  );
}
