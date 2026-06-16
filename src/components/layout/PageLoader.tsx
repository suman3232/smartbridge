import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PageLoaderProps = {
  fullScreen?: boolean;
  className?: string;
};

export function PageLoader({ fullScreen = false, className }: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-background",
        fullScreen ? "min-h-screen" : "h-64 w-full",
        className,
      )}
      aria-label="Loading page"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
