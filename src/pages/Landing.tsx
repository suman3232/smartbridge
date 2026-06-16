import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLoader } from "@/components/layout/PageLoader";
import { Navbar } from "@/components/layout/Navbar";
import { useLandingScrollAnimations } from "@/hooks/use-landing-scroll-animations";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/brand/Logo";
import {
  CreditCard,
  Wallet,
  Shield,
  ArrowRight,
  ArrowDown,
  Store,
  UserCheck,
} from "lucide-react";

const CinematicHero = lazy(() =>
  import("@/components/ui/cinematic-landing-hero").then((m) => ({ default: m.CinematicHero })),
);

const shopperSteps = [
  "Request a product and the card offer you need (or browse curated deals).",
  "Set what you are willing to pay and the cash reward for the card holder.",
  "A card holder accepts and places the order on the e-commerce site.",
  "Receive the product once the order is delivered.",
];

const cardHolderSteps = [
  "Browse deals that match a card you hold (HDFC, ICICI, Axis, etc.).",
  "Accept a deal — delivery address is shown for the shopper.",
  "Place the order on the e-commerce app using only your card at checkout.",
  "Get order cost reimbursed plus cash reward in your wallet after delivery.",
];

const pricingItems = [
  { label: "Card offer price", desc: "What the card holder pays at checkout using their card discount.", icon: CreditCard },
  { label: "Commission", desc: "Fixed amount you set when creating the deal. Paid to the card holder on completion.", icon: Wallet },
  { label: "Expected buy price", desc: "What you (the shopper) pay in total for the product.", icon: ArrowDown },
  { label: "Wallet", desc: "Commissions and balances tracked in-app. KYC required before withdrawals.", icon: Shield },
];

export default function Landing() {
  const [openDealsCount, setOpenDealsCount] = useState<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useLandingScrollAnimations(pageRef);

  useEffect(() => {
    const fetchOpenDeals = async () => {
      const { data, error } = await supabase.rpc("list_open_deals");

      if (!error && data) {
        setOpenDealsCount(data.length);
        return;
      }

      const { count, error: fallbackError } = await supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved")
        .is("customer_id", null);

      if (!fallbackError && count !== null) {
        setOpenDealsCount(count);
      }
    };

    void fetchOpenDeals();
  }, []);

  return (
    <div ref={pageRef} className="overflow-x-hidden w-full min-h-screen bg-background">
      <Navbar />
      <Suspense fallback={<PageLoader className="min-h-[80vh]" />}>
        <CinematicHero openDealsCount={openDealsCount} />
      </Suspense>

      <section id="features" className="content-section py-20 lg:py-28 border-t border-white/[0.05] scroll-mt-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-14">
            <h2 className="landing-reveal-heading font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              How it works
            </h2>
            <p className="landing-reveal-subtext text-muted-foreground text-lg leading-relaxed">
              Card holders earn by placing orders for shoppers. Shoppers get card-only discounts without needing every bank card.
            </p>
          </div>

          <div className="landing-reveal-grid grid md:grid-cols-2 gap-6 lg:gap-8">
            <Card className="landing-reveal-card landing-card h-full bg-card/40 border-white/[0.07]">
              <CardContent className="p-7 sm:p-8">
                <div className="landing-icon-wrap w-11 h-11 rounded-xl bg-white/[0.06] border border-white/[0.06] flex items-center justify-center mb-5">
                  <Store className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display text-xl font-bold mb-2">Shopper</h3>
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                  Wants a product at a card-specific price on Amazon, Flipkart, or similar — but does not have the right credit card.
                </p>
                <ul className="space-y-3">
                  {shopperSteps.map((step, i) => (
                    <li key={i} className="landing-step-item flex gap-3 text-sm text-foreground/85 leading-relaxed">
                      <span className="text-primary font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="landing-reveal-card landing-card h-full bg-card/40 border-white/[0.07]">
              <CardContent className="p-7 sm:p-8">
                <div className="landing-icon-wrap w-11 h-11 rounded-xl bg-white/[0.06] border border-white/[0.06] flex items-center justify-center mb-5">
                  <UserCheck className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-display text-xl font-bold mb-2">Card holder</h3>
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                  Has the right card and wants to earn for placing the order — with clear amounts agreed upfront on each deal.
                </p>
                <ul className="space-y-3">
                  {cardHolderSteps.map((step, i) => (
                    <li key={i} className="landing-step-item flex gap-3 text-sm text-foreground/85 leading-relaxed">
                      <span className="text-accent font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="content-section py-20 lg:py-28 bg-secondary/30 border-y border-white/[0.05] scroll-mt-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="landing-reveal-heading font-display text-3xl sm:text-4xl font-bold tracking-tight mb-12">
            How pricing works
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {pricingItems.map((item) => (
              <div
                key={item.label}
                className="landing-reveal-pricing landing-card h-full p-5 rounded-2xl border border-white/[0.07] bg-background/50"
              >
                <div className="landing-icon-wrap w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold mb-2">{item.label}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <p className="landing-reveal-subtext mt-10 text-sm text-muted-foreground max-w-3xl leading-relaxed">
            Every deal is reviewed before it goes live. Status moves from pending to approved, then accepted, in progress, and completed — you can track it from your dashboard.
          </p>
        </div>
      </section>

      <section className="content-section py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="landing-reveal-cta landing-card rounded-3xl border border-white/[0.08] bg-card/30 p-10 sm:p-14 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-3">
                {openDealsCount && openDealsCount > 0
                  ? `${openDealsCount} deal${openDealsCount === 1 ? "" : "s"} open now`
                  : "Start with a deal or a card"}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {openDealsCount && openDealsCount > 0
                  ? "Browse what's live, or post a purchase you need help placing."
                    : "Create an account, post what you need bought, or browse deals that match your cards."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link to="/deals">
                <Button variant="hero" size="lg" className="w-full sm:w-auto h-12 px-8 rounded-full">
                  Browse deals
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 rounded-full">
                  Sign up
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-10">
        <div className="landing-reveal-footer max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <p className="text-sm text-muted-foreground">Share card offers. Split the savings fairly.</p>
        </div>
      </footer>
    </div>
  );
}
