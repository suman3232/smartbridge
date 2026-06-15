import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SplineScene } from "@/components/ui/splite";
import { Spotlight } from "@/components/ui/spotlight";
import { cn } from "@/lib/utils";

const SPLINE_SCENE = "https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode";

export interface SplineLandingHeroProps {
  openDealsCount?: number | null;
  className?: string;
}

export function SplineLandingHero({ openDealsCount, className }: SplineLandingHeroProps) {
  useEffect(() => {
    window.dispatchEvent(new Event("landing-hero-ready"));
  }, []);

  return (
    <section className={cn("relative w-full pt-24 sm:pt-28", className)}>
      <Card className="relative mx-auto min-h-[min(720px,calc(100vh-7rem))] w-full max-w-[1400px] overflow-hidden border-white/[0.08] bg-black/[0.96] shadow-2xl">
        <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="white" />

        <div className="flex h-full min-h-[min(720px,calc(100vh-7rem))] flex-col lg:flex-row">
          <div className="relative z-10 flex flex-1 flex-col justify-center p-8 sm:p-10 lg:p-12">
            {openDealsCount != null && openDealsCount > 0 && (
              <p className="mb-4 text-sm font-medium text-primary">
                {openDealsCount} open deal{openDealsCount === 1 ? "" : "s"} live now
              </p>
            )}
            <h1 className="font-display text-4xl font-bold tracking-tight text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text md:text-5xl lg:text-6xl">
              Use your card.
              <br />
              Earn on every order.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-neutral-300 md:text-lg">
              OfferBridge connects shoppers who need card discounts with card holders who place orders
              and get reimbursed plus commission.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/deals">
                <Button variant="hero" size="lg" className="h-12 w-full rounded-full px-8 sm:w-auto">
                  Browse deals
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button variant="outline" size="lg" className="h-12 w-full rounded-full border-white/15 px-8 sm:w-auto">
                  Start earning
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative min-h-[320px] flex-1 lg:min-h-0">
            <SplineScene scene={SPLINE_SCENE} className="absolute inset-0" />
          </div>
        </div>
      </Card>
    </section>
  );
}
