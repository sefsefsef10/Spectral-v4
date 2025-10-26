import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Users, AlertTriangle, FileText, Briefcase, CheckCircle } from "lucide-react";

interface SystemHealthMetrics {
  users: {
    total: number;
  };
  alerts: {
    total: number;
    unresolved: number;
  };
  auditLogs: {
    recent: number;
  };
  backgroundJobs: {
    pending: number;
    running: number;
  };
  aiSystems?: {
    total: number;
  };
}

export default function SystemHealth() {
  const { data: metrics, isLoading, isError, error, refetch } = useQuery<SystemHealthMetrics>({
    queryKey: ["/api/system-health"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <p className="text-center text-muted-foreground">Loading system health metrics...</p>
      </div>
    );
  }

  if (isError || !metrics) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Error Loading System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Failed to fetch system health metrics. Please try again."}
            </p>
            <button 
              onClick={() => refetch()} 
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              data-testid="button-retry"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const healthScore = calculateHealthScore(metrics);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold mb-2" data-testid="text-system-health-title">System Health</h1>
        <p className="text-muted-foreground">
          Monitor platform performance and system status
        </p>
      </div>

      {/* Overall Health Score */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Overall Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold" data-testid="text-health-score">
              {healthScore}%
            </div>
            <Badge variant={healthScore >= 80 ? "default" : healthScore >= 60 ? "secondary" : "destructive"}>
              {healthScore >= 80 ? "Healthy" : healthScore >= 60 ? "Fair" : "Needs Attention"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Users */}
        <Card data-testid="card-users-metric">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Users
            </CardTitle>
            <CardDescription>Total users in organization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-users-count">
              {metrics?.users.total || 0}
            </div>
          </CardContent>
        </Card>

        {/* AI Systems (Health Systems only) */}
        {metrics?.aiSystems && (
          <Card data-testid="card-ai-systems-metric">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                AI Systems
              </CardTitle>
              <CardDescription>Systems under monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-ai-systems-count">
                {metrics.aiSystems.total}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerts */}
        <Card data-testid="card-alerts-metric">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Unresolved Alerts
            </CardTitle>
            <CardDescription>Alerts requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold" data-testid="text-alerts-unresolved">
                {metrics?.alerts.unresolved || 0}
              </div>
              {(metrics?.alerts.unresolved || 0) === 0 && (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs */}
        <Card data-testid="card-audit-metric">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Recent Activity
            </CardTitle>
            <CardDescription>Audit log entries (last 10)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-audit-count">
              {metrics?.auditLogs.recent || 0}
            </div>
          </CardContent>
        </Card>

        {/* Background Jobs */}
        <Card data-testid="card-jobs-metric">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Background Jobs
            </CardTitle>
            <CardDescription>Pending job queue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold" data-testid="text-jobs-pending">
                {metrics?.backgroundJobs.pending || 0}
              </div>
              {(metrics?.backgroundJobs.pending || 0) === 0 && (
                <Badge variant="outline">All Clear</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function calculateHealthScore(metrics: SystemHealthMetrics): number {
  let score = 100;
  
  // Deduct points for unresolved alerts
  if (metrics.alerts.unresolved > 0) {
    score -= Math.min(30, metrics.alerts.unresolved * 5);
  }
  
  // Deduct points for pending background jobs
  if (metrics.backgroundJobs.pending > 5) {
    score -= Math.min(20, (metrics.backgroundJobs.pending - 5) * 2);
  }
  
  // Bonus points for active audit logging
  if (metrics.auditLogs.recent >= 5) {
    score = Math.min(100, score + 5);
  }
  
  return Math.max(0, Math.round(score));
}
