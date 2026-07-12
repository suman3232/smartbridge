import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ReservationCountdownProps {
  /** ISO timestamp when the reservation expires (server source of truth). */
  reservedUntil: string;
  /** ISO server clock captured with the same fetch, to correct device-clock skew. */
  serverNow?: string;
  /** Fired once when the countdown reaches zero. */
  onExpire?: () => void;
  /** Show toast warnings at 10 / 5 / 1 minute remaining. */
  warn?: boolean;
  className?: string;
}

function fmt(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const WARN_THRESHOLDS = [600, 300, 60]; // 10m, 5m, 1m

/**
 * Live reservation countdown. The deadline is a server timestamp; we only correct
 * for device-clock skew for display — all enforcement happens server-side, so
 * changing the local clock cannot extend the real timer.
 */
export function ReservationCountdown({ reservedUntil, serverNow, onExpire, warn, className }: ReservationCountdownProps) {
  const { toast } = useToast();
  // Offset between the device clock and the server clock, measured once.
  const skewRef = useRef(serverNow ? Date.parse(serverNow) - Date.now() : 0);
  const deadline = Date.parse(reservedUntil);
  const remainingNow = () => Math.round((deadline - (Date.now() + skewRef.current)) / 1000);

  const [remaining, setRemaining] = useState(remainingNow);
  const firedRef = useRef<Set<number>>(new Set());
  const expiredRef = useRef(false);
  const deadlineRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset warning/expiry tracking only when the DEADLINE changes (a new
    // reservation) — not on every serverNow refresh, otherwise a refetch that
    // returns the same lapsed deadline would re-fire onExpire in a loop.
    if (deadlineRef.current !== reservedUntil) {
      deadlineRef.current = reservedUntil;
      firedRef.current = new Set();
      expiredRef.current = false;
    }
    skewRef.current = serverNow ? Date.parse(serverNow) - Date.now() : 0;

    // Thresholds already passed when this mounts (e.g. page reopened at 4 min
    // left) are marked silently — only future crossings toast.
    const initial = remainingNow();
    for (const t of WARN_THRESHOLDS) {
      if (initial <= t) firedRef.current.add(t);
    }
    setRemaining(initial);

    const tick = () => {
      const r = remainingNow();
      setRemaining(r);

      if (warn) {
        // Crossing-based so a throttled background tab can't skip a warning.
        for (const t of WARN_THRESHOLDS) {
          if (r <= t && r > 0 && !firedRef.current.has(t)) {
            firedRef.current.add(t);
            toast({
              title: `${t / 60} minute${t === 60 ? "" : "s"} left`,
              description: "Place the order and submit proof, or release the deal.",
              variant: t <= 60 ? "destructive" : undefined,
            });
          }
        }
      }

      if (r <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
    };

    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservedUntil, serverNow]);

  const danger = remaining <= 60;
  const warnState = remaining <= 300;

  return (
    <span
      role="timer"
      aria-live="off"
      aria-label={`Time remaining to place the order: ${fmt(remaining)}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-sm font-semibold tabular-nums",
        danger
          ? "bg-destructive/15 text-destructive motion-safe:animate-pulse"
          : warnState
            ? "bg-warning/15 text-warning"
            : "bg-primary/10 text-primary",
        className,
      )}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {remaining > 0 ? fmt(remaining) : "0:00"}
    </span>
  );
}
