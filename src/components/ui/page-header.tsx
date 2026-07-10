import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}

/** Editorial page header — eyebrow label, display title, optional actions. */
export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">{eyebrow}</p>
        )}
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight leading-tight">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
