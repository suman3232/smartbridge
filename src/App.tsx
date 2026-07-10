import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { ReferralRedirect } from "@/components/auth/ReferralRedirect";
import { PageLoader } from "@/components/layout/PageLoader";

const LandingWithOAuthRedirect = lazy(() => import("./pages/LandingWithOAuthRedirect"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CreateDeal = lazy(() => import("./pages/CreateDeal"));
const BrowseDeals = lazy(() => import("./pages/BrowseDeals"));
const DealDetail = lazy(() => import("./pages/DealDetail"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Notifications = lazy(() => import("./pages/Notifications"));
const KYCPage = lazy(() => import("./pages/KYC"));
const Profile = lazy(() => import("./pages/Profile"));
const PriceTracker = lazy(() => import("./pages/PriceTracker"));
const ReferAndEarn = lazy(() => import("./pages/ReferAndEarn"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader fullScreen />}>
            <Routes>
              <Route path="/" element={<LandingWithOAuthRedirect />} />
              <Route path="/r/:code" element={<ReferralRedirect />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/create-deal" element={<ProtectedRoute><CreateDeal /></ProtectedRoute>} />
              <Route path="/deals" element={<BrowseDeals />} />
              <Route path="/deals/:id" element={<ProtectedRoute><DealDetail /></ProtectedRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
              <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/kyc" element={<ProtectedRoute><KYCPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/tracker" element={<ProtectedRoute><PriceTracker /></ProtectedRoute>} />
              <Route path="/refer" element={<ProtectedRoute><ReferAndEarn /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
