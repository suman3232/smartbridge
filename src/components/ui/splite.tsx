import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const Spline = lazy(() => import("@splinetool/react-spline"));

interface SplineSceneProps {
  scene: string;
  className?: string;
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading 3D scene" />
        </div>
      }
    >
      <div className={cn("h-full w-full bg-background [&>div]:h-full [&>div]:w-full [&_canvas]:bg-background", className)}>
        <Spline scene={scene} className="h-full w-full" />
      </div>
    </Suspense>
  );
}
