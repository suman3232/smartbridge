import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const REVEAL_SELECTOR =
  ".landing-reveal-heading, .landing-reveal-subtext, .landing-reveal-card, .landing-reveal-pricing, .landing-reveal-cta, .landing-reveal-footer, .landing-step-item";

function refreshLandingTriggers() {
  ScrollTrigger.refresh(true);
}

export function useLandingScrollAnimations(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    let ctx: gsap.Context | undefined;

    const setup = () => {
      ctx?.revert();
      ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>(".landing-reveal-heading").forEach((el) => {
          gsap.from(el, {
            immediateRender: false,
            autoAlpha: 0,
            y: 28,
            duration: 0.65,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              once: true,
            },
          });
        });

        gsap.utils.toArray<HTMLElement>(".landing-reveal-subtext").forEach((el) => {
          gsap.from(el, {
            immediateRender: false,
            autoAlpha: 0,
            y: 16,
            duration: 0.55,
            ease: "power2.out",
            delay: 0.06,
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              once: true,
            },
          });
        });

        const cards = gsap.utils.toArray<HTMLElement>(".landing-reveal-card");
        if (cards.length) {
          gsap.from(cards, {
            immediateRender: false,
            autoAlpha: 0,
            y: 32,
            duration: 0.6,
            ease: "power2.out",
            stagger: 0.1,
            scrollTrigger: {
              trigger: cards[0]?.closest(".landing-reveal-grid") ?? cards[0],
              start: "top 85%",
              once: true,
            },
          });

          cards.forEach((card) => {
            const steps = card.querySelectorAll<HTMLElement>(".landing-step-item");
            if (!steps.length) return;

            gsap.from(steps, {
              immediateRender: false,
              autoAlpha: 0,
              y: 8,
              duration: 0.35,
              stagger: 0.05,
              ease: "power2.out",
              delay: 0.15,
              scrollTrigger: {
                trigger: card,
                start: "top 80%",
                once: true,
              },
            });
          });
        }

        const pricingCards = gsap.utils.toArray<HTMLElement>(".landing-reveal-pricing");
        if (pricingCards.length) {
          gsap.from(pricingCards, {
            immediateRender: false,
            autoAlpha: 0,
            y: 24,
            duration: 0.55,
            ease: "power2.out",
            stagger: 0.08,
            scrollTrigger: {
              trigger: pricingCards[0]?.parentElement ?? pricingCards[0],
              start: "top 85%",
              once: true,
            },
          });
        }

        gsap.utils.toArray<HTMLElement>(".landing-reveal-cta").forEach((el) => {
          gsap.from(el, {
            immediateRender: false,
            autoAlpha: 0,
            y: 20,
            duration: 0.65,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top 86%",
              once: true,
            },
          });
        });

        gsap.utils.toArray<HTMLElement>(".landing-reveal-footer").forEach((el) => {
          gsap.from(el, {
            immediateRender: false,
            autoAlpha: 0,
            y: 10,
            duration: 0.45,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top 92%",
              once: true,
            },
          });
        });

        refreshLandingTriggers();
      }, root);
    };

    const timer = window.setTimeout(setup, 150);
    window.addEventListener("landing-hero-ready", refreshLandingTriggers);
    window.addEventListener("load", refreshLandingTriggers);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("landing-hero-ready", refreshLandingTriggers);
      window.removeEventListener("load", refreshLandingTriggers);
      ctx?.revert();
      gsap.set(root.querySelectorAll(REVEAL_SELECTOR), { clearProps: "all" });
    };
  }, [rootRef]);
}
