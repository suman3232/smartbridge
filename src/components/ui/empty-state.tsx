import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

/** A designed empty state — never a bare "No data" line. */
export function EmptyState({ icon: Icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "py-10" : "py-16", className)}>
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-lg" aria-hidden />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-secondary/60">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      </div>
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
