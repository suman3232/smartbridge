import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  ShoppingBag,
  PlusCircle,
  Wallet,
  Bell,
  User,
  Shield,
  FileCheck,
  LineChart,
  Gift,
  LifeBuoy,
  Menu,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { InstallButton } from "@/components/pwa/InstallButton";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: ShoppingBag, label: "Browse Deals", href: "/deals" },
  { icon: PlusCircle, label: "Post Request", href: "/create-deal" },
  { icon: LineChart, label: "Price Tracker", href: "/tracker" },
  { icon: Wallet, label: "Wallet", href: "/wallet" },
  { icon: Gift, label: "Refer & Earn", href: "/refer" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: FileCheck, label: "KYC", href: "/kyc" },
  { icon: LifeBuoy, label: "Support", href: "/support" },
];

const adminItems = [
  { icon: Shield, label: "Admin Panel", href: "/admin" },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isActive = (href: string) => location.pathname === href;

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-border/50">
        <Link to="/">
          <Logo size="md" />
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <p className="px-6 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">Menu</p>
        <div className="px-3 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors duration-150",
                isActive(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
              )}
            >
              {isActive(item.href) && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <item.icon className={cn("h-[18px] w-[18px] transition-colors", isActive(item.href) ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              {item.label}
            </Link>
          ))}
        </div>

        {/* Admin section */}
        {isAdmin && (
          <div className="mt-6 px-3">
            <p className="px-3.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">Admin</p>
            {adminItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors duration-150",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                )}
              >
                {isActive(item.href) && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <item.icon className={cn("h-[18px] w-[18px]", isActive(item.href) ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* User section */}
      <div className="p-4 border-t border-border/50">
        <Link
          to="/profile"
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
          </div>
        </Link>
        <InstallButton variant="outline" size="default" full className="mt-2 w-full justify-center" />
        <Button
          variant="ghost"
          className="w-full mt-2 justify-start text-muted-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-background/80 backdrop-blur-xl border-b border-border/50 flex items-center px-4">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <button className="p-2 -ml-2 touch-manipulation" aria-label="Open menu">
              <Menu className="w-6 h-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col border-r border-border bg-card p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <div className="flex-1 flex items-center justify-center">
          <Link to="/">
            <Logo size="sm" />
          </Link>
        </div>
        <div className="flex w-10 justify-end">
          <InstallButton variant="ghost" size="sm" className="px-2" />
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed top-0 left-0 bottom-0 w-72 bg-sidebar-background/95 border-r border-border/60 flex-col z-40">
        <SidebarContent />
      </aside>

      {/* Main content — keyed by route so each page gets a subtle enter transition */}
      <main className="lg:ml-72 min-h-screen pt-16 lg:pt-0">
        <div key={location.pathname} className="page-enter mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
