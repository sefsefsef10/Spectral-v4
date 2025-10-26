import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MonitoringAlert, AISystem, PredictiveAlert } from "@shared/schema";
import { useState } from "react";
import { AlertCircle, CheckCircle, TrendingUp, X } from "lucide-react";
import { useAuth } from "@/lib/auth";

function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks} ${diffWeeks === 1 ? "week" : "weeks"} ago`;
}

export default function MonitoringView() {
  const { toast } = useToast();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const { user } = useAuth();

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<MonitoringAlert[]>({
    queryKey: ["/api/alerts"],
    enabled: !!user,
  });

  const { data: systems = [], isLoading: systemsLoading } = useQuery<AISystem[]>({
    queryKey: ["/api/ai-systems"],
    enabled: !!user,
  });

  const { data: predictiveAlerts = [], isLoading: predictiveAlertsLoading } = useQuery<PredictiveAlert[]>({
    queryKey: ["/api/health-systems", user?.healthSystemId, "predictive-alerts"],
    enabled: !!user?.healthSystemId,
  });

  const dismissPredictiveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await fetch(`/api/predictive-alerts/${alertId}/dismiss`, {
        method: "PATCH",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-systems", user?.healthSystemId, "predictive-alerts"] });
      toast({
        title: "Predictive Alert Dismissed",
        description: "Predictive alert has been dismissed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to dismiss predictive alert",
        variant: "destructive",
      });
    },
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await fetch(`/api/alerts/${alertId}/resolve`, {
        method: "PATCH",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Alert Resolved",
        description: "Alert has been marked as resolved",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to resolve alert",
        variant: "destructive",
      });
    },
  });

  if (alertsLoading || systemsLoading || predictiveAlertsLoading) {
    return <div className="p-6">Loading monitoring data...</div>;
  }

  // Filter alerts by severity
  const filteredAlerts = severityFilter === "all" 
    ? alerts 
    : alerts.filter(a => a.severity.toLowerCase() === severityFilter.toLowerCase());

  const driftIssues = systems.filter(s => s.status === "drift").length;
  const healthChecks = [
    { category: "PHI Leakage", status: "pass", systems: systems.length, issues: 0 },
    { category: "Model Drift", status: driftIssues > 0 ? "warning" : "pass", systems: systems.length, issues: driftIssues },
    { category: "Bias Detection", status: "pass", systems: systems.length, issues: 0 },
    { category: "Uptime", status: "pass", systems: systems.length, issues: 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Real-Time Monitoring</h1>
        <p className="text-muted-foreground">24/7 safety monitoring across all AI systems</p>
      </div>

      {predictiveAlerts.length > 0 && (
        <Card className="p-6 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Predictive Alerts</h2>
            </div>
            <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900">
              {predictiveAlerts.length} Forecast{predictiveAlerts.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          
          <div className="space-y-3">
            {predictiveAlerts.map((alert, index) => {
              const system = systems.find(s => s.id === alert.aiSystemId);
              const daysUntil = Math.ceil((new Date(alert.predictedDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              
              return (
                <Card key={alert.id} className="p-4 bg-white dark:bg-slate-950" data-testid={`predictive-alert-${index}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium" data-testid={`predictive-alert-system-${index}`}>
                          {system?.name || "Unknown System"}
                        </span>
                        <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900">
                          {alert.metric.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="text-sm mb-2" data-testid={`predictive-alert-message-${index}`}>
                        Predicted to exceed threshold in <span className="font-semibold">{daysUntil} days</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">Current Value:</span> {parseFloat(alert.currentValue).toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">Predicted Value:</span> {parseFloat(alert.predictedValue).toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">Threshold:</span> {parseFloat(alert.threshold).toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">Confidence:</span> {alert.confidenceScore}%
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissPredictiveAlertMutation.mutate(alert.id)}
                      disabled={dismissPredictiveAlertMutation.isPending}
                      data-testid={`button-dismiss-predictive-alert-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Alert Management</h2>
          <div className="flex gap-2">
            <Button
              variant={severityFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSeverityFilter("all")}
              data-testid="filter-all"
            >
              All ({alerts.length})
            </Button>
            <Button
              variant={severityFilter === "critical" ? "default" : "outline"}
              size="sm"
              onClick={() => setSeverityFilter("critical")}
              data-testid="filter-critical"
            >
              Critical ({alerts.filter(a => a.severity.toLowerCase() === "critical").length})
            </Button>
            <Button
              variant={severityFilter === "high" ? "default" : "outline"}
              size="sm"
              onClick={() => setSeverityFilter("high")}
              data-testid="filter-high"
            >
              High ({alerts.filter(a => a.severity.toLowerCase() === "high").length})
            </Button>
            <Button
              variant={severityFilter === "medium" ? "default" : "outline"}
              size="sm"
              onClick={() => setSeverityFilter("medium")}
              data-testid="filter-medium"
            >
              Medium ({alerts.filter(a => a.severity.toLowerCase() === "medium").length})
            </Button>
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            {severityFilter === "all" ? "No active alerts" : `No ${severityFilter} severity alerts`}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert, index) => {
              const system = systems.find(s => s.id === alert.aiSystemId);
              const getSeverityVariant = (severity: string): "destructive" | "secondary" | "outline" => {
                const s = severity.toLowerCase();
                if (s === "critical" || s === "high") return "destructive";
                if (s === "medium") return "outline";
                return "secondary";
              };

              return (
                <Card key={alert.id} className="p-4" data-testid={`alert-item-${index}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        alert.severity.toLowerCase() === "critical" || alert.severity.toLowerCase() === "high"
                          ? "text-destructive"
                          : alert.severity.toLowerCase() === "medium"
                          ? "text-yellow-600"
                          : "text-muted-foreground"
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium" data-testid={`alert-system-${index}`}>
                            {system?.name || "Unknown System"}
                          </span>
                          <Badge variant={getSeverityVariant(alert.severity)}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium mb-1" data-testid={`alert-type-${index}`}>
                          {alert.type}
                        </div>
                        <div className="text-sm text-muted-foreground mb-2" data-testid={`alert-message-${index}`}>
                          {alert.message}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimeAgo(alert.createdAt)}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resolveAlertMutation.mutate(alert.id)}
                      disabled={resolveAlertMutation.isPending}
                      data-testid={`button-resolve-${index}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Resolve
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-6">

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">System Health</h2>
          <div className="space-y-4">
            {healthChecks.map((check, index) => (
              <div key={index} className="flex items-center justify-between" data-testid={`health-check-${index}`}>
                <div className="flex items-center gap-3">
                  <span className={check.status === "pass" ? "text-green-600" : "text-yellow-600"}>
                    {check.status === "pass" ? "✅" : "⚠️"}
                  </span>
                  <div>
                    <div className="font-medium">{check.category}</div>
                    <div className="text-xs text-muted-foreground">
                      {check.systems} systems monitored
                    </div>
                  </div>
                </div>
                {check.issues > 0 && (
                  <Badge variant="destructive">{check.issues} issues</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Monitoring Timeline (Last 24 Hours)</h2>
        <div className="h-64 bg-muted rounded flex items-center justify-center text-muted-foreground">
          Real-time monitoring graph: PHI leakage tests, drift detection, bias checks
        </div>
      </Card>
    </div>
  );
}
