import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Database, Activity, FileText, Building2, PresentationIcon, Shield, Award, Heart, Network } from "lucide-react";
import { useState } from "react";
import { WebSocketStatus } from "./WebSocketStatus";

interface SidebarProps {
  currentView?: string;
  onViewChange?: (view: string) => void;
  interfaceMode?: "health-system" | "ai-vendor";
  onInterfaceModeChange?: (mode: "health-system" | "ai-vendor") => void;
}

export default function Sidebar({ 
  currentView = "dashboard", 
  onViewChange,
  interfaceMode = "health-system",
  onInterfaceModeChange
}: SidebarProps) {
  const healthSystemMenuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "healthcare-portfolio", label: "Healthcare Score", icon: Heart },
    { id: "ai-inventory", label: "AI Inventory", icon: Database },
    { id: "monitoring", label: "Monitoring", icon: Activity },
    { id: "compliance", label: "Compliance", icon: Shield },
    { id: "reporting", label: "Reporting", icon: FileText },
    { id: "vendor-directory", label: "Vendor Directory", icon: Building2 },
    { id: "network-effects", label: "Network", icon: Network },
    { id: "certification-review", label: "Certification Review", icon: Award },
    { id: "board-dashboard", label: "Board Dashboard", icon: PresentationIcon },
  ];

  const vendorMenuItems = [
    { id: "vendor-dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "certification-intake", label: "Get Certified", icon: Award },
    { id: "trust-page", label: "Trust Page", icon: FileText },
    { id: "network-reach", label: "Network Reach", icon: Network },
    { id: "customers", label: "Customers", icon: Building2 },
    { id: "performance", label: "Performance", icon: Activity },
  ];

  const menuItems = interfaceMode === "health-system" ? healthSystemMenuItems : vendorMenuItems;

  return (
    <aside className="w-64 border-r bg-background flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">🪐</span>
          </div>
          <span className="font-bold text-lg flex-1">Spectral</span>
          <WebSocketStatus />
        </div>

        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback>JS</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium text-sm" data-testid="sidebar-user-name">Jane Smith</div>
            <div className="text-xs text-muted-foreground">CISO</div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground" data-testid="sidebar-hospital">
          Main Hospital System
        </div>
      </div>

      <div className="p-4 border-b">
        <div className="text-xs font-medium text-muted-foreground mb-2">Interface View</div>
        <div className="flex gap-2">
          <Button
            variant={interfaceMode === "health-system" ? "default" : "outline"}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => {
              onInterfaceModeChange?.("health-system");
              onViewChange?.("dashboard");
            }}
            data-testid="button-view-health-system"
          >
            Health System
          </Button>
          <Button
            variant={interfaceMode === "ai-vendor" ? "default" : "outline"}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => {
              onInterfaceModeChange?.("ai-vendor");
              onViewChange?.("vendor-dashboard");
            }}
            data-testid="button-view-ai-vendor"
          >
            AI Vendor
          </Button>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange?.(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-secondary text-secondary-foreground font-medium"
                  : "text-muted-foreground hover-elevate"
              }`}
              data-testid={`nav-${item.id}`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <div className="text-xs text-muted-foreground">
          {interfaceMode === "health-system" ? "Health System View" : "AI Vendor View"}
        </div>
      </div>
    </aside>
  );
}
