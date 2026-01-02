import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/layout/Navbar";
import {
  Zap,
  CreditCard,
  Wallet,
  Shield,
  ArrowRight,
  Users,
  TrendingUp,
  CheckCircle2,
  Sparkles
} from "lucide-react";

const features = [
  {
    icon: CreditCard,
    title: "Use Any Card Offer",
    description: "Access discounts from credit cards you don't own through our trusted community."
  },
  {
    icon: Wallet,
    title: "Earn Commissions",
    description: "Help others and earn money by using your card's exclusive offers."
  },
  {
    icon: Shield,
    title: "Secure Escrow",
    description: "All transactions are protected through our secure escrow system."
  },
  {
    icon: Users,
    title: "Trusted Community",
    description: "KYC-verified users ensure safe and reliable transactions."
  }
];

const stats = [
  { value: "10K+", label: "Happy Users" },
  { value: "₹5Cr+", label: "Savings Delivered" },
  { value: "50K+", label: "Deals Completed" },
  { value: "4.9★", label: "User Rating" },
];

const steps = [
  {
    number: "01",
    title: "Create or Accept Deals",
    description: "Post a deal when you need a card offer, or accept deals to earn commission."
  },
  {
    number: "02",
    title: "Secure Payment",
    description: "Funds are held safely in escrow until the deal is complete."
  },
  {
    number: "03",
    title: "Get Your Savings",
    description: "Receive your discounted product or earn your commission."
  }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl animate-pulse-slow" />
          <div className="absolute top-1/2 -left-40 w-80 h-80 rounded-full bg-accent/10 blur-3xl animate-pulse-slow" style={{ animationDelay: "2s" }} />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 animate-fadeIn">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">India's #1 Card Offer Sharing Platform</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight mb-6 animate-slideUp">
              Share Credit Card
              <span className="block gradient-text">Offers & Earn</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slideUp" style={{ animationDelay: "0.1s" }}>
              Access exclusive card discounts you don't have, or help others and earn commission. 
              A win-win for everyone.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slideUp" style={{ animationDelay: "0.2s" }}>
              <Link to="/auth?mode=signup">
                <Button variant="hero" size="xl">
                  Get Started Free
                  <ArrowRight className="w-5 h-5 ml-1" />
                </Button>
              </Link>
              <Link to="/deals">
                <Button variant="outline" size="xl">
                  Browse Deals
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-20 animate-slideUp" style={{ animationDelay: "0.3s" }}>
            {stats.map((stat, index) => (
              <Card key={index} glass className="text-center p-6">
                <p className="text-3xl lg:text-4xl font-bold gradient-text">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-32 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-bold mb-4">
              Why Choose <span className="gradient-text">OfferBridge</span>?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A secure platform that connects card holders with people who need access to exclusive offers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group hover:-translate-y-2 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center mb-4 group-hover:shadow-glow transition-shadow duration-300">
                    <feature.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-bold mb-4">
              How It <span className="gradient-text">Works</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Simple steps to start saving or earning through card offers.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="text-8xl font-black text-primary/10 absolute -top-8 left-0">
                  {step.number}
                </div>
                <div className="relative pt-8 pl-2">
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="gradient-hero overflow-hidden">
            <CardContent className="p-10 lg:p-16 text-center relative">
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary-foreground/10 blur-3xl" />
                <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-primary-foreground/10 blur-3xl" />
              </div>
              
              <div className="relative">
                <h2 className="text-3xl lg:text-5xl font-bold text-primary-foreground mb-4">
                  Ready to Start Saving?
                </h2>
                <p className="text-primary-foreground/80 text-lg max-w-2xl mx-auto mb-8">
                  Join thousands of users who are already benefiting from OfferBridge.
                </p>
                <Link to="/auth?mode=signup">
                  <Button variant="glass" size="xl" className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-primary-foreground/20">
                    Create Free Account
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold">OfferBridge</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 OfferBridge. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
