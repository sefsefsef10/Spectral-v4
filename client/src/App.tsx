import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import AdvancedAnalytics from "@/pages/AdvancedAnalytics";
import TemplateLibrary from "@/pages/TemplateLibrary";
import UserManagement from "@/pages/UserManagement";
import AuditLogs from "@/pages/AuditLogs";
import OrganizationSettings from "@/pages/OrganizationSettings";
import SystemHealth from "@/pages/SystemHealth";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import PricingPage from "@/pages/Pricing";
import ConstellationPage from "@/pages/products/Constellation";
import SentinelPage from "@/pages/products/Sentinel";
import WatchtowerPage from "@/pages/products/Watchtower";
import BeaconPage from "@/pages/products/Beacon";
import VendorDirectoryPage from "@/pages/VendorDirectory";
import VendorMarketplace from "@/pages/VendorMarketplace";
import VendorTrustPage from "@/pages/vendor-trust-page";
import BillingDashboard from "@/pages/BillingDashboard";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/products/constellation" component={ConstellationPage} />
      <Route path="/products/sentinel" component={SentinelPage} />
      <Route path="/products/watchtower" component={WatchtowerPage} />
      <Route path="/products/beacon" component={BeaconPage} />
      <Route path="/vendors" component={VendorDirectoryPage} />
      <Route path="/marketplace" component={VendorMarketplace} />
      <Route path="/trust/:vendorId" component={VendorTrustPage} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/analytics">
        {() => <ProtectedRoute component={AdvancedAnalytics} />}
      </Route>
      <Route path="/templates">
        {() => <ProtectedRoute component={TemplateLibrary} />}
      </Route>
      <Route path="/users">
        {() => <ProtectedRoute component={UserManagement} />}
      </Route>
      <Route path="/audit-logs">
        {() => <ProtectedRoute component={AuditLogs} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={OrganizationSettings} />}
      </Route>
      <Route path="/system-health">
        {() => <ProtectedRoute component={SystemHealth} />}
      </Route>
      <Route path="/billing">
        {() => <ProtectedRoute component={BillingDashboard} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
