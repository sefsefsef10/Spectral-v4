import MetricCard from "../MetricCard";
import AlertItem from "../AlertItem";
import ROIMetricsCard from "../ROIMetricsCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { AISystem, MonitoringAlert } from "@shared/schema";
import { useAuth } from "@/lib/auth";

interface DashboardViewProps {
  onNavigateToSystem?: (systemName: string) => void;
  onNavigateToInventory?: () => void;
}

export default function DashboardView({ onNavigateToSystem, onNavigateToInventory }: DashboardViewProps) {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalSystems: number;
    atRisk: number;
    verified: number;
    compliant: string;
    unresolvedAlerts: number;
  }>({
    queryKey: ["/api/dashboard/stats"],
    enabled: !!user,
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<MonitoringAlert[]>({
    queryKey: ["/api/alerts"],
    enabled: !!user,
  });

  const { data: systems = [] } = useQuery<AISystem[]>({
    queryKey: ["/api/ai-systems"],
    enabled: !!user,
  });

  if (statsLoading || alertsLoading) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">AI Portfolio Health</h1>
        <p className="text-muted-foreground">Last 30 Days</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard value={stats?.totalSystems || 0} label="AI Systems" />
        <MetricCard value={stats?.atRisk || 0} label="At Risk" variant="warning" />
        <MetricCard value={stats?.verified || 0} label="Verified" />
        <MetricCard value={stats?.compliant || "100%"} label="Compliant" variant="success" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {alerts.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-destructive">⚠️</span>
              {alerts.length} {alerts.length === 1 ? "system needs" : "systems need"} attention
            </h2>
            <div>
              {alerts.slice(0, 3).map((alert) => {
                const system = systems.find(s => s.id === alert.aiSystemId);
                return (
                  <AlertItem
                    key={alert.id}
                    title={system?.name || "Unknown System"}
                    description={alert.message}
                    onAction={() => system && onNavigateToSystem?.(system.name)}
                  />
                );
              })}
            </div>
          </Card>
        )}

        <ROIMetricsCard />
      </div>

      <div className="flex gap-4">
        <Button onClick={onNavigateToInventory} data-testid="button-view-all">
          View All Systems
        </Button>
        <Button variant="outline" data-testid="button-board-report">
          Generate Board Report
        </Button>
        <Button variant="outline" data-testid="button-schedule-audit">
          Schedule Audit
        </Button>
      </div>
    </div>
  );
}
