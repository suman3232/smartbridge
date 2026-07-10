"use client";

import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, CheckCircle2, CreditCard, Handshake, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const INJECTED_STYLES = `
  .film-grain {
      position: absolute; inset: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 50; opacity: 0.05; mix-blend-mode: overlay;
      background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noiseFilter)"/></svg>');
  }

  .bg-grid-theme {
      background-size: 60px 60px;
      background-image:
          linear-gradient(to right, color-mix(in srgb, hsl(var(--foreground)) 5%, transparent) 1px, transparent 1px),
          linear-gradient(to bottom, color-mix(in srgb, hsl(var(--foreground)) 5%, transparent) 1px, transparent 1px);
      mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
  }

  .text-3d-matte {
      color: hsl(var(--foreground));
      text-shadow:
          0 10px 30px color-mix(in srgb, hsl(var(--foreground)) 20%, transparent),
          0 2px 4px color-mix(in srgb, hsl(var(--foreground)) 10%, transparent);
  }

  .text-silver-matte {
      background: linear-gradient(180deg, hsl(var(--foreground)) 0%, color-mix(in srgb, hsl(var(--foreground)) 40%, transparent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      transform: translateZ(0);
      filter:
          drop-shadow(0px 10px 20px color-mix(in srgb, hsl(var(--foreground)) 15%, transparent))
          drop-shadow(0px 2px 4px color-mix(in srgb, hsl(var(--foreground)) 10%, transparent));
  }

  .text-card-silver-matte {
      background: linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      transform: translateZ(0);
      filter:
          drop-shadow(0px 12px 24px rgba(0,0,0,0.8))
          drop-shadow(0px 4px 8px rgba(0,0,0,0.6));
  }

  .iphone-bezel {
      background-color: #111;
      box-shadow:
          inset 0 0 0 2px #52525B,
          inset 0 0 0 7px #000,
          0 40px 80px -15px rgba(0,0,0,0.9),
          0 15px 25px -5px rgba(0,0,0,0.7);
      transform-style: preserve-3d;
  }

  .hardware-btn {
      background: linear-gradient(90deg, #404040 0%, #171717 100%);
      box-shadow:
          -2px 0 5px rgba(0,0,0,0.8),
          inset -1px 0 1px rgba(255,255,255,0.15),
          inset 1px 0 2px rgba(0,0,0,0.8);
      border-left: 1px solid rgba(255,255,255,0.05);
  }

  .screen-glare {
      background: linear-gradient(110deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 45%);
  }

  .widget-depth {
      background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
      box-shadow:
          0 10px 20px rgba(0,0,0,0.3),
          inset 0 1px 1px rgba(255,255,255,0.05),
          inset 0 -1px 1px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.03);
  }

  .floating-ui-badge {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.01) 100%);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.1),
          0 25px 50px -12px rgba(0, 0, 0, 0.8),
          inset 0 1px 1px rgba(255,255,255,0.2),
          inset 0 -1px 1px rgba(0,0,0,0.5);
  }

  .btn-modern-light, .btn-modern-dark {
      transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
  }
  .btn-modern-light {
      background: linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%);
      color: #0F172A;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.1), 0 12px 24px -4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,1), inset 0 -3px 6px rgba(0,0,0,0.06);
  }
  .btn-modern-light:hover {
      transform: translateY(-3px);
      box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 6px 12px -2px rgba(0,0,0,0.15), 0 20px 32px -6px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,1), inset 0 -3px 6px rgba(0,0,0,0.06);
  }
  .btn-modern-light:active {
      transform: translateY(1px);
      background: linear-gradient(180deg, #F1F5F9 0%, #E2E8F0 100%);
      box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1), inset 0 3px 6px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(0,0,0,0.02);
  }
  .btn-modern-dark {
      background: linear-gradient(180deg, #27272A 0%, #18181B 100%);
      color: #FFFFFF;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.6), 0 12px 24px -4px rgba(0,0,0,0.9), inset 0 1px 1px rgba(255,255,255,0.15), inset 0 -3px 6px rgba(0,0,0,0.8);
  }
  .btn-modern-dark:hover {
      transform: translateY(-3px);
      background: linear-gradient(180deg, #3F3F46 0%, #27272A 100%);
      box-shadow: 0 0 0 1px rgba(255,255,255,0.15), 0 6px 12px -2px rgba(0,0,0,0.7), 0 20px 32px -6px rgba(0,0,0,1), inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -3px 6px rgba(0,0,0,0.8);
  }
  .btn-modern-dark:active {
      transform: translateY(1px);
      background: #18181B;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.05), inset 0 3px 8px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(0,0,0,0.5);
  }

  .progress-ring {
      transform: rotate(-90deg);
      transform-origin: center;
      stroke-dasharray: 402;
      stroke-dashoffset: 402;
      stroke-linecap: round;
  }
`;

export interface CinematicHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  brandName?: string;
  tagline1?: string;
  tagline2?: string;
  cardHeading?: string;
  cardDescription?: React.ReactNode;
  metricValue?: number;
  metricLabel?: string;
  ctaHeading?: string;
  ctaDescription?: string;
  openDealsCount?: number | null;
}

export function CinematicHero({
  brandName = "OfferBridge",
  tagline1 = "Use your card,",
  tagline2 = "earn on every order.",
  cardHeading = "Your second income.",
  cardDescription = (
    <>
      Browse deals that match your credit card, place the order on Amazon or Flipkart with your
      card discount, and get reimbursed plus a cash reward when delivery completes.
    </>
  ),
  metricValue,
  metricLabel = "Open deals",
  ctaHeading = "Earn from your credit card.",
  ctaDescription = "Card holders get paid for placing orders. Shoppers get card-only prices without holding every bank card.",
  openDealsCount = null,
  className,
  ...props
}: CinematicHeroProps) {
  const displayMetric = metricValue ?? openDealsCount ?? 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  // Keep the latest metric in a ref so the GSAP timeline can read it via
  // function-based values without being torn down and rebuilt when the async
  // open-deals count arrives.
  const displayMetricRef = useRef(displayMetric);
  useEffect(() => {
    displayMetricRef.current = displayMetric;
  }, [displayMetric]);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (!finePointer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!mockupRef.current) return;

      cancelAnimationFrame(requestRef.current);

      requestRef.current = requestAnimationFrame(() => {
        if (!mockupRef.current) return;

        const xVal = (e.clientX / window.innerWidth - 0.5) * 2;
        const yVal = (e.clientY / window.innerHeight - 0.5) * 2;

        gsap.to(mockupRef.current, {
          rotationY: xVal * 10,
          rotationX: -yVal * 10,
          ease: "power3.out",
          duration: 1,
        });
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const scrollEnd = window.innerWidth < 768 ? 1000 : 1500;
      // Function-based values so they resolve to the latest count at tween time.
      const ringOffset = () => {
        const m = displayMetricRef.current;
        return m > 0 ? Math.max(60, 402 - (m / 50) * 340) : 340;
      };

      gsap.set(".text-track", { autoAlpha: 0, y: 50, scale: 0.9, filter: "blur(12px)" });
      gsap.set(".text-days", { autoAlpha: 1, clipPath: "inset(0 100% 0 0)" });
      gsap.set(".hero-scene", { autoAlpha: 1 });
      gsap.set(
        [".card-left-text", ".brand-watermark", ".mockup-scroll-wrapper", ".floating-badge", ".phone-widget"],
        { autoAlpha: 0 },
      );
      gsap.set(".cta-wrapper", { autoAlpha: 0, scale: 0.9, filter: "blur(16px)", pointerEvents: "none" });

      const introTl = gsap.timeline({ delay: 0.2 });
      introTl
        .to(".text-track", {
          duration: 1.4,
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          ease: "expo.out",
        })
        .to(".text-days", { duration: 1.2, clipPath: "inset(0 0% 0 0)", ease: "power4.inOut" }, "-=0.9");

      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: `+=${scrollEnd}`,
          pin: true,
          scrub: 0.25,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      scrollTl
        .to([".hero-text-wrapper", ".bg-grid-theme"], {
          scale: 1.03,
          filter: "blur(8px)",
          autoAlpha: 0,
          ease: "power2.inOut",
          duration: 0.55,
        }, 0)
        .fromTo(
          ".mockup-scroll-wrapper",
          { y: 120, z: -180, rotationX: 24, rotationY: -10, autoAlpha: 0, scale: 0.82 },
          { y: 0, z: 0, rotationX: 0, rotationY: 0, autoAlpha: 1, scale: 1, ease: "expo.out", duration: 0.65 },
          0.02,
        )
        .fromTo(
          ".phone-widget",
          { y: 12, autoAlpha: 0, scale: 0.98 },
          { y: 0, autoAlpha: 1, scale: 1, stagger: 0.04, ease: "back.out(1.2)", duration: 0.45 },
          0.08,
        )
        .fromTo(
          ".floating-badge",
          { y: 32, autoAlpha: 0, scale: 0.9 },
          { y: 0, autoAlpha: 1, scale: 1, ease: "back.out(1.3)", duration: 0.4, stagger: 0.05 },
          0.12,
        )
        .fromTo(".card-left-text", { x: -20, autoAlpha: 0 }, { x: 0, autoAlpha: 1, ease: "power4.out", duration: 0.45 }, 0.1)
        .to(".progress-ring", { strokeDashoffset: ringOffset, duration: 0.5, ease: "power3.inOut" }, 0.14)
        .to(
          ".counter-val",
          { innerHTML: () => displayMetricRef.current, snap: { innerHTML: 1 }, duration: 0.5, ease: "expo.out" },
          0.14,
        )
        .to(
          [".mockup-scroll-wrapper", ".floating-badge", ".card-left-text", ".brand-watermark"],
          { autoAlpha: 0, y: -10, ease: "power2.in", duration: 0.4, stagger: 0.02 },
          "+=0.1",
        )
        .to(".hero-scene", { autoAlpha: 0, duration: 0.3, ease: "power2.in" }, "-=0.15")
        .to(
          ".cta-wrapper",
          {
            autoAlpha: 1,
            scale: 1,
            filter: "blur(0px)",
            pointerEvents: "auto",
            duration: 0.5,
            ease: "power2.out",
          },
          "-=0.05",
        );

      requestAnimationFrame(() => {
        ScrollTrigger.refresh(true);
        window.dispatchEvent(new Event("landing-hero-ready"));
      });
    }, containerRef);

    return () => ctx.revert();
    // Built once on mount; the counter/ring read live values via refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-screen min-h-screen overflow-hidden flex items-center justify-center bg-background text-foreground font-sans antialiased pt-24 md:pt-28",
        className,
      )}
      style={{ perspective: "1500px" }}
      {...props}
    >
      <style dangerouslySetInnerHTML={{ __html: INJECTED_STYLES }} />
      <div className="film-grain" aria-hidden="true" />
      <div className="bg-grid-theme absolute inset-0 z-0 pointer-events-none opacity-50" aria-hidden="true" />

      <div className="hero-text-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-screen px-4 will-change-transform">
        <h1 className="text-track text-3d-matte text-4xl sm:text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight mb-2">
          {tagline1}
        </h1>
        <h1 className="text-days text-silver-matte text-4xl sm:text-5xl md:text-7xl lg:text-[5.5rem] font-extrabold tracking-tighter">
          {tagline2}
        </h1>
      </div>

      <div className="cta-wrapper absolute inset-0 z-30 flex flex-col items-center justify-center text-center px-4 pointer-events-none will-change-transform opacity-0">
        <h2 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight text-silver-matte">
          {ctaHeading}
        </h2>
        <p className="text-muted-foreground text-base md:text-xl mb-10 max-w-xl mx-auto font-light leading-relaxed px-2">
          {ctaDescription}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pointer-events-auto">
          <Link
            to="/auth?mode=signup"
            className="btn-modern-light flex items-center justify-center gap-3 px-8 py-4 rounded-[1.25rem] group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
          >
            <Sparkles className="w-5 h-5 transition-transform group-hover:scale-105" aria-hidden="true" />
            <span className="text-lg font-bold leading-none tracking-tight">Get started</span>
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <Link
            to="/deals"
            className="btn-modern-dark flex items-center justify-center gap-3 px-8 py-4 rounded-[1.25rem] group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
          >
            <CreditCard className="w-5 h-5 transition-transform group-hover:scale-105" aria-hidden="true" />
            <span className="text-lg font-bold leading-none tracking-tight">Browse deals</span>
          </Link>
        </div>
      </div>

      <div
        className="hero-scene absolute inset-0 z-20 flex items-center justify-center pointer-events-none px-3 sm:px-4 lg:px-8"
        style={{ perspective: "1500px" }}
      >
        <div className="relative w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-6 lg:gap-10 py-4 sm:py-6 lg:py-0 pointer-events-auto min-h-[70vh]">
          <div className="card-left-text order-2 lg:order-1 flex flex-col justify-center text-center lg:text-left z-20 w-full px-2 sm:px-0">
            <h3 className="text-foreground text-xl sm:text-2xl md:text-3xl font-bold mb-2 lg:mb-4 tracking-tight">
              {cardHeading}
            </h3>
            <p className="text-muted-foreground text-sm md:text-base font-normal leading-relaxed mx-auto lg:mx-0 max-w-sm">
              {cardDescription}
            </p>
          </div>

          <div
            className="mockup-scroll-wrapper order-1 lg:order-2 relative w-full flex items-center justify-center z-10"
            style={{ perspective: "1000px" }}
          >
            <div
              className="brand-watermark pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 hidden lg:block select-none"
              aria-hidden="true"
            >
              <span className="text-[5.5rem] xl:text-[7rem] font-black uppercase tracking-tighter text-card-silver-matte opacity-[0.18] whitespace-nowrap">
                {brandName}
              </span>
            </div>

            <div className="relative z-10 w-full h-[300px] sm:h-[380px] lg:h-[560px] flex items-center justify-center transform scale-[0.58] sm:scale-[0.72] md:scale-[0.85] lg:scale-100">
              <div
                ref={mockupRef}
                className="relative w-[260px] sm:w-[280px] h-[540px] sm:h-[580px] rounded-[3rem] iphone-bezel flex flex-col will-change-transform transform-style-3d"
              >
                <div className="absolute top-[120px] -left-[3px] w-[3px] h-[25px] hardware-btn rounded-l-md z-0" aria-hidden="true" />
                <div className="absolute top-[160px] -left-[3px] w-[3px] h-[45px] hardware-btn rounded-l-md z-0" aria-hidden="true" />
                <div className="absolute top-[220px] -left-[3px] w-[3px] h-[45px] hardware-btn rounded-l-md z-0" aria-hidden="true" />
                <div className="absolute top-[170px] -right-[3px] w-[3px] h-[70px] hardware-btn rounded-r-md z-0 scale-x-[-1]" aria-hidden="true" />

                <div className="absolute inset-[7px] bg-[#050914] rounded-[2.5rem] overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,1)] text-white z-10">
                  <div className="absolute inset-0 screen-glare z-40 pointer-events-none" aria-hidden="true" />

                  <div className="absolute top-[5px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full z-50 flex items-center justify-end px-3 shadow-[inset_0_-1px_2px_rgba(255,255,255,0.1)]">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                  </div>

                  <div className="relative w-full h-full pt-12 px-5 pb-8 flex flex-col">
                    <div className="phone-widget flex justify-between items-center mb-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-1">Deals</span>
                        <span className="text-xl font-bold tracking-tight text-white drop-shadow-md">Open now</span>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-white/5 text-neutral-200 flex items-center justify-center font-bold text-sm border border-white/10 shadow-lg shadow-black/50">
                        OB
                      </div>
                    </div>

                    <div className="phone-widget relative w-40 h-40 sm:w-44 sm:h-44 mx-auto flex items-center justify-center mb-6 drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]">
                      <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
                        <circle cx="88" cy="88" r="64" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="12" />
                        <circle className="progress-ring" cx="88" cy="88" r="64" fill="none" stroke="#3B82F6" strokeWidth="12" />
                      </svg>
                      <div className="text-center z-10 flex flex-col items-center">
                        <span className="counter-val text-3xl sm:text-4xl font-extrabold tracking-tighter text-white">0</span>
                        <span className="text-[8px] text-blue-200/50 uppercase tracking-[0.1em] font-bold mt-0.5">{metricLabel}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="phone-widget widget-depth rounded-2xl p-3 flex items-center">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/5 flex items-center justify-center mr-3 border border-blue-400/20 shadow-inner">
                          <CreditCard className="w-4 h-4 text-blue-400 drop-shadow-md" aria-hidden="true" />
                        </div>
                        <div className="flex-1">
                          <div className="h-2 w-20 bg-neutral-300/80 rounded-full mb-2 shadow-inner" />
                          <div className="h-1.5 w-12 bg-neutral-600 rounded-full shadow-inner" />
                        </div>
                      </div>
                      <div className="phone-widget widget-depth rounded-2xl p-3 flex items-center">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 flex items-center justify-center mr-3 border border-emerald-400/20 shadow-inner">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 drop-shadow-md" aria-hidden="true" />
                        </div>
                        <div className="flex-1">
                          <div className="h-2 w-16 bg-neutral-300/80 rounded-full mb-2 shadow-inner" />
                          <div className="h-1.5 w-24 bg-neutral-600 rounded-full shadow-inner" />
                        </div>
                      </div>
                    </div>

                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[120px] h-[4px] bg-white/20 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                  </div>
                </div>
              </div>

              <div className="floating-badge absolute flex top-4 sm:top-6 lg:top-12 left-[-8px] sm:left-[-15px] lg:left-[-70px] floating-ui-badge rounded-xl lg:rounded-2xl p-2.5 sm:p-3 lg:p-4 items-center gap-2 sm:gap-3 lg:gap-4 z-30 max-w-[160px] sm:max-w-none">
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-b from-blue-500/20 to-blue-900/10 flex items-center justify-center border border-blue-400/30 shadow-inner shrink-0">
                  <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-blue-300" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs lg:text-sm font-bold tracking-tight truncate">Order placed</p>
                  <p className="text-blue-200/50 text-[10px] lg:text-xs font-medium">On Amazon / Flipkart</p>
                </div>
              </div>

              <div className="floating-badge absolute flex bottom-8 sm:bottom-12 lg:bottom-20 right-[-8px] sm:right-[-15px] lg:right-[-70px] floating-ui-badge rounded-xl lg:rounded-2xl p-2.5 sm:p-3 lg:p-4 items-center gap-2 sm:gap-3 lg:gap-4 z-30 max-w-[160px] sm:max-w-none">
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-b from-indigo-500/20 to-indigo-900/10 flex items-center justify-center border border-indigo-400/30 shadow-inner shrink-0">
                  <Handshake className="w-4 h-4 lg:w-5 lg:h-5 text-indigo-300" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs lg:text-sm font-bold tracking-tight truncate">Cash reward</p>
                  <p className="text-blue-200/50 text-[10px] lg:text-xs font-medium">Credited to wallet</p>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:block lg:order-3" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
