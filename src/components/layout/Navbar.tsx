import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { InstallButton } from "@/components/pwa/InstallButton";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const LANDING_LINKS = [
  { label: "Roles", href: "#features" },
  { label: "Pricing", href: "#how-it-works" },
  { label: "Deals", href: "/deals" },
];

export function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isLanding = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOut();
    navigate("/");
  };

  const handleAnchorClick = (href: string) => {
    setMobileMenuOpen(false);
    if (!href.startsWith("#")) return;
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-[100] px-3 sm:px-5 pt-3 sm:pt-4 pointer-events-none">
      <nav
        className={cn(
          "pointer-events-auto mx-auto max-w-5xl rounded-full transition-all duration-500",
          scrolled ? "nav-glass-scrolled" : "nav-glass",
        )}
      >
        <div className="flex items-center justify-between h-[3.25rem] px-3 sm:px-4">
          <Link to="/" className="group shrink-0 rounded-full pr-2 -ml-1 transition-opacity hover:opacity-90">
            <Logo size="md" />
          </Link>

          {isLanding && !user && (
            <div className="hidden lg:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
              {LANDING_LINKS.map((link) =>
                link.href.startsWith("#") ? (
                  <button key={link.href} type="button" onClick={() => handleAnchorClick(link.href)} className="nav-link">
                    {link.label}
                  </button>
                ) : (
                  <Link key={link.href} to={link.href} className="nav-link">
                    {link.label}
                  </Link>
                ),
              )}
            </div>
          )}

          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            <InstallButton variant="ghost" className="text-muted-foreground" />
            <Link to="/support">
              <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground hover:bg-white/[0.05]">
                Support
              </Button>
            </Link>
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground hover:bg-white/[0.05]">
                    Dashboard
                  </Button>
                </Link>
                <Link to="/deals">
                  <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground hover:bg-white/[0.05]">
                    Deals
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={handleSignOut} className="rounded-full border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground hover:bg-white/[0.05]">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth?mode=signup">
                  <Button variant="hero" size="sm" className="rounded-full px-5">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu — portal-rendered drawer (robust against overlays/stacking). */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="md:hidden p-2 -mr-1 rounded-lg text-foreground hover:bg-white/[0.06] transition-colors touch-manipulation"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-xs border-l border-white/10 bg-background/95 p-0 backdrop-blur-xl">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex flex-col gap-1 p-4 pt-14">
                <InstallButton variant="outline" size="default" full className="mb-2 w-full justify-center" />
                <Link
                  to="/support"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
                >
                  Support
                </Link>

                {isLanding && !user &&
                  LANDING_LINKS.map((link) =>
                    link.href.startsWith("#") ? (
                      <button
                        key={link.href}
                        type="button"
                        onClick={() => handleAnchorClick(link.href)}
                        className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <Link
                        key={link.href}
                        to={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    ),
                  )}

                {user ? (
                  <>
                    <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="block">
                      <Button variant="ghost" className="h-11 w-full justify-start">Dashboard</Button>
                    </Link>
                    <Link to="/deals" onClick={() => setMobileMenuOpen(false)} className="block">
                      <Button variant="ghost" className="h-11 w-full justify-start">Browse Deals</Button>
                    </Link>
                    <Button variant="outline" className="mt-2 h-11 w-full border-white/10" onClick={handleSignOut}>
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 pt-2">
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="h-11 w-full">Sign In</Button>
                    </Link>
                    <Link to="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="hero" className="h-11 w-full">Get Started</Button>
                    </Link>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
