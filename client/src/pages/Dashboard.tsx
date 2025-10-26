import { useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import SystemDetail from "@/components/dashboard/SystemDetail";
import DashboardView from "@/components/dashboard/views/DashboardView";
import AIInventoryView from "@/components/dashboard/views/AIInventoryView";
import MonitoringView from "@/components/dashboard/views/MonitoringView";
import ReportingView from "@/components/dashboard/views/ReportingView";
import VendorDirectoryView from "@/components/dashboard/views/VendorDirectoryView";
import BoardDashboardView from "@/components/dashboard/views/BoardDashboardView";
import ComplianceView from "@/components/dashboard/views/ComplianceView";
import VendorDashboardView from "@/components/dashboard/views/vendor/VendorDashboardView";
import TrustPageView from "@/components/dashboard/views/vendor/TrustPageView";
import CustomersView from "@/components/dashboard/views/vendor/CustomersView";
import PerformanceView from "@/components/dashboard/views/vendor/PerformanceView";
import CertificationIntakeView from "@/components/dashboard/views/vendor/CertificationIntakeView";
import CertificationReviewView from "@/components/dashboard/views/CertificationReviewView";

export default function Dashboard() {
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState("dashboard");
  const [interfaceMode, setInterfaceMode] = useState<"health-system" | "ai-vendor">("health-system");

  const renderView = () => {
    if (selectedSystem) {
      return <SystemDetail onBack={() => setSelectedSystem(null)} />;
    }

    if (interfaceMode === "ai-vendor") {
      switch (currentView) {
        case "vendor-dashboard":
          return <VendorDashboardView />;
        case "certification-intake":
          return <CertificationIntakeView />;
        case "trust-page":
          return <TrustPageView />;
        case "customers":
          return <CustomersView />;
        case "performance":
          return <PerformanceView />;
        default:
          return <VendorDashboardView />;
      }
    }

    switch (currentView) {
      case "dashboard":
        return (
          <DashboardView
            onNavigateToSystem={setSelectedSystem}
            onNavigateToInventory={() => setCurrentView("ai-inventory")}
          />
        );
      case "ai-inventory":
        return <AIInventoryView onSelectSystem={setSelectedSystem} />;
      case "monitoring":
        return <MonitoringView />;
      case "compliance":
        return <ComplianceView />;
      case "reporting":
        return <ReportingView />;
      case "vendor-directory":
        return <VendorDirectoryView />;
      case "board-dashboard":
        return <BoardDashboardView />;
      case "certification-review":
        return <CertificationReviewView />;
      default:
        return <DashboardView onNavigateToSystem={setSelectedSystem} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView}
        interfaceMode={interfaceMode}
        onInterfaceModeChange={setInterfaceMode}
      />
      <main className="flex-1 p-6">{renderView()}</main>
    </div>
  );
}
