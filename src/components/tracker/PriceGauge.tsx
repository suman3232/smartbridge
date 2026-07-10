import { cn } from "@/lib/utils";

const TONE_COLOR: Record<string, string> = {
  excellent: "hsl(152 69% 48%)",
  good: "hsl(152 69% 55%)",
  fair: "hsl(38 92% 55%)",
  wait: "hsl(0 72% 58%)",
  neutral: "hsl(215 18% 58%)",
};

interface PriceGaugeProps {
  /** 0 = wait (high price), 100 = excellent buy (near low). Null while building. */
  score: number | null;
  label: string;
  subLabel?: string;
  tone: "excellent" | "good" | "fair" | "wait" | "neutral";
  className?: string;
}

/** "Should you buy now?" semicircular gauge with a needle. */
export function PriceGauge({ score, label, subLabel, tone, className }: PriceGaugeProps) {
  const s = score == null ? 50 : Math.max(0, Math.min(100, score));
  const angle = -90 + (s / 100) * 180; // -90° = left (wait), +90° = right (buy)
  const color = TONE_COLOR[tone] ?? TONE_COLOR.neutral;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg viewBox="0 0 200 118" className="w-full max-w-[240px]" role="img" aria-label={label}>
        <defs>
          <linearGradient id="gaugeArc" x1="0" y1="0" x2="200" y2="0">
            <stop offset="0" stopColor="hsl(0 72% 58%)" />
            <stop offset="0.5" stopColor="hsl(38 92% 55%)" />
            <stop offset="1" stopColor="hsl(152 69% 48%)" />
          </linearGradient>
        </defs>
        {/* track */}
        <path d="M15 100 A85 85 0 0 1 185 100" fill="none" stroke="url(#gaugeArc)" strokeWidth="13" strokeLinecap="round" opacity={score == null ? 0.28 : 1} />
        {/* needle (hidden while building history) */}
        {score != null && (
          <g transform={`rotate(${angle} 100 100)`} style={{ transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)" }}>
            <line x1="100" y1="100" x2="100" y2="30" stroke="hsl(210 40% 96%)" strokeWidth="3" strokeLinecap="round" />
          </g>
        )}
        <circle cx="100" cy="100" r="7" fill="hsl(210 40% 96%)" />
        <circle cx="100" cy="100" r="3" fill="hsl(222 47% 6%)" />
      </svg>
      <div className="-mt-3 flex w-full items-center justify-between px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span>Wait</span>
        <span>Buy</span>
      </div>
      <p className="mt-2 text-center text-base font-bold" style={{ color }}>{label}</p>
      {subLabel && <p className="text-center text-xs text-muted-foreground">{subLabel}</p>}
    </div>
  );
}
