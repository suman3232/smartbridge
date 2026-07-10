import { cn } from "@/lib/utils";
import type { ReactNode, CSSProperties, ElementType } from "react";

interface FadeInProps {
  children: ReactNode;
  /** Stagger index — each step adds ~55ms delay. */
  index?: number;
  /** Explicit delay in ms (overrides index). */
  delay?: number;
  className?: string;
  as?: ElementType;
}

/** Lightweight CSS entrance animation (no JS animation library). */
export function FadeIn({ children, index = 0, delay, className, as: Tag = "div" }: FadeInProps) {
  const ms = delay ?? index * 55;
  const style: CSSProperties = { animationDelay: `${ms}ms` };
  return (
    <Tag className={cn("animate-fade-up", className)} style={style}>
      {children}
    </Tag>
  );
}
