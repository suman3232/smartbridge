import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { useAuth } from "@/contexts/AuthContext";
import { useSupportWhatsApp } from "@/lib/settings";
import { LifeBuoy, MessageCircle, ShieldCheck, Clock } from "lucide-react";

const faqs = [
  {
    q: "How do I get reimbursed after placing an order?",
    a: "Once the shopper confirms delivery, the admin completes the deal and your card cost plus commission is credited to your wallet. You can withdraw it after your KYC is approved.",
  },
  {
    q: "When is the delivery address shared?",
    a: "To protect the shopper's privacy, the delivery address is revealed only after you accept a deal — never before.",
  },
  {
    q: "Why do I need to complete KYC?",
    a: "KYC (PAN + bank details) is required before any withdrawal so payouts reach the right, verified account. An admin reviews and approves each submission.",
  },
  {
    q: "A deal or payment looks wrong — what do I do?",
    a: "Message us on WhatsApp with the product name and the amount. Our team can look up the deal and help sort it out.",
  },
];

export default function Support() {
  const supportNumber = useSupportWhatsApp();
  const { user } = useAuth();

  const content = (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Help & support"
          title="We're here to help"
          description="Reach the OfferBridge team on WhatsApp, or browse the common questions below."
        />

        <Card className="overflow-hidden">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#25D366]/10">
                <MessageCircle className="h-6 w-6 text-[#25D366]" />
              </div>
              <div>
                <p className="font-semibold">Chat with support</p>
                <p className="text-sm text-muted-foreground">
                  {supportNumber
                    ? "Typical reply within a few hours during working days."
                    : "Support chat isn't configured yet. Please check back soon."}
                </p>
              </div>
            </div>
            {supportNumber && (
              <WhatsAppButton
                phone={supportNumber}
                message="Hi, I need help with OfferBridge."
                label="Open WhatsApp"
                className="shrink-0"
              />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Every deal is admin-reviewed before it goes live.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Clock className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Payouts are released after delivery is confirmed.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <LifeBuoy className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Stuck on a step? We'll walk you through it.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Frequently asked questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-xl border border-white/[0.06] bg-secondary/20 p-4">
                <p className="font-medium">{f.q}</p>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
  );

  // Logged-in users get the app shell; visitors get the public navbar so the
  // Support page is reachable without an account.
  if (user) {
    return <DashboardLayout>{content}</DashboardLayout>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-28 sm:px-6">{content}</main>
    </div>
  );
}
