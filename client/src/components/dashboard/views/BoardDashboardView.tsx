import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MetricCard from "../MetricCard";
import { Download, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AISystem } from "@shared/schema";
import { useAuth } from "@/lib/auth";

export default function BoardDashboardView() {
  const { user } = useAuth();

  const { data: systems = [], isLoading } = useQuery<AISystem[]>({
    queryKey: ["/api/ai-systems"],
    enabled: !!user,
  });

  // Calculate metrics from real data
  const totalSystems = systems.length;
  const compliantSystems = systems.filter(s => s.status === "Compliant").length;
  const complianceRate = totalSystems > 0 ? Math.round((compliantSystems / totalSystems) * 100) : 0;

  // Risk distribution
  const riskCounts = {
    Critical: systems.filter(s => s.riskLevel === "Critical").length,
    High: systems.filter(s => s.riskLevel === "High").length,
    Medium: systems.filter(s => s.riskLevel === "Medium").length,
    Low: systems.filter(s => s.riskLevel === "Low").length,
  };

  const needsAttention = systems.filter(s => s.status === "Drift" || s.status === "Non-Compliant").length;
  const verifiedVendors = new Set(systems.filter(s => s.vendorId).map(s => s.vendorId)).size;

  // Department distribution
  const departmentCounts = systems.reduce((acc, system) => {
    acc[system.department] = (acc[system.department] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (!user) {
    return <div className="p-6">Loading user data...</div>;
  }

  if (!user.healthSystemId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">This view is only available for health system accounts.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6">Loading executive report...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Executive Dashboard</h1>
          <p className="text-muted-foreground">Board-ready AI governance overview</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-schedule-presentation">
            <Calendar className="w-4 h-4 mr-2" />
            Schedule Presentation
          </Button>
          <Button data-testid="button-export-board-report">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard 
          value={totalSystems} 
          label="Total AI Systems" 
        />
        <MetricCard 
          value={`${complianceRate}%`} 
          label="Compliance Rate" 
          variant={complianceRate >= 90 ? "success" : "warning"}
        />
        <MetricCard 
          value={needsAttention} 
          label="Needs Attention" 
          variant={needsAttention === 0 ? "success" : "warning"}
        />
        <MetricCard 
          value={verifiedVendors} 
          label="Verified Vendors" 
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Risk Distribution</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Critical Risk</span>
              <div className="text-right">
                <span className="font-semibold text-destructive" data-testid="risk-critical">{riskCounts.Critical}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({totalSystems > 0 ? Math.round((riskCounts.Critical / totalSystems) * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">High Risk</span>
              <div className="text-right">
                <span className="font-semibold text-orange-600" data-testid="risk-high">{riskCounts.High}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({totalSystems > 0 ? Math.round((riskCounts.High / totalSystems) * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Medium Risk</span>
              <div className="text-right">
                <span className="font-semibold text-yellow-600" data-testid="risk-medium">{riskCounts.Medium}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({totalSystems > 0 ? Math.round((riskCounts.Medium / totalSystems) * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Low Risk</span>
              <div className="text-right">
                <span className="font-semibold text-green-600" data-testid="risk-low">{riskCounts.Low}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({totalSystems > 0 ? Math.round((riskCounts.Low / totalSystems) * 100) : 0}%)
                </span>
              </div>
            </div>
            {(riskCounts.Critical > 0 || riskCounts.High > 0) && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-destructive">Requires Immediate Action</span>
                  <span className="font-semibold text-destructive">{riskCounts.Critical + riskCounts.High}</span>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Portfolio Compliance</h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Compliance Rate</span>
                <span className="text-2xl font-bold">{complianceRate}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full ${complianceRate >= 90 ? 'bg-green-600' : complianceRate >= 70 ? 'bg-yellow-600' : 'bg-destructive'}`}
                  style={{ width: `${complianceRate}%` }}
                />
              </div>
            </div>
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Compliant Systems</span>
                <span className="font-semibold text-green-600">{compliantSystems} of {totalSystems}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Drift Detected</span>
                <span className="font-semibold text-yellow-600">
                  {systems.filter(s => s.status === "Drift").length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Non-Compliant</span>
                <span className="font-semibold text-destructive">
                  {systems.filter(s => s.status === "Non-Compliant").length}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Department Distribution</h2>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(departmentCounts).map(([dept, count]) => (
            <div key={dept} className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold mb-1">{count}</div>
              <div className="text-sm text-muted-foreground">{dept}</div>
            </div>
          ))}
          {Object.keys(departmentCounts).length === 0 && (
            <div className="col-span-3 text-center p-4 bg-muted rounded-lg text-muted-foreground">
              No AI systems yet
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
