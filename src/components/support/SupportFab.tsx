import { useLocation } from "react-router-dom";
import { whatsappLink } from "@/lib/contact";
import { useSupportWhatsApp } from "@/lib/settings";
import { WhatsAppGlyph } from "@/components/ui/whatsapp-button";

/**
 * Floating "chat with support" button pinned to the bottom-right, app-wide.
 * Opens a WhatsApp chat with the admin-configured support number. Renders
 * nothing until a support number is set (so no fake number is ever shown),
 * and stays out of the way on the auth screen.
 */
export function SupportFab() {
  const supportNumber = useSupportWhatsApp();
  const location = useLocation();

  // Don't cover the sign-in / sign-up form.
  if (location.pathname.startsWith("/auth")) return null;
  if (!supportNumber) return null;

  const href = whatsappLink(supportNumber, "Hi, I need help with OfferBridge.");
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with support on WhatsApp"
      className="group fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-lg shadow-[#25D366]/30 transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6"
    >
      {/* pulsing ring */}
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[#25D366] opacity-60 motion-safe:animate-ping" aria-hidden="true" />
      <WhatsAppGlyph className="relative h-6 w-6 shrink-0" />
      <span className="relative hidden text-sm font-semibold sm:inline">Support</span>
    </a>
  );
}
