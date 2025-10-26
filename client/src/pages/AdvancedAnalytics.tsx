import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Shield, Activity, Building2, Download } from "lucide-react";
import { exportDepartmentMetrics, exportPortfolioHealth, exportAlertTrends, exportComplianceTrend, exportRiskTrend } from "@/lib/csv-export";

interface PortfolioHealth {
  overall: number;
  breakdown: {
    riskManagement: number;
    compliancePosture: number;
    alertResponse: number;
    systemVerification: number;
  };
  grade: "A" | "B" | "C" | "D" | "F";
  trend: "improving" | "stable" | "declining";
}

interface DepartmentMetrics {
  department: string;
  systemCount: number;
  averageRiskScore: number;
  averageComplianceRate: number;
  activeAlertCount: number;
  highRiskSystemCount: number;
}

interface AlertTrendAnalysis {
  totalAlerts: number;
  resolvedAlerts: number;
  unresolvedAlerts: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  timeSeries: Array<{ date: string; value: number }>;
  averageResolutionTimeHours: number | null;
}

export default function AdvancedAnalytics() {
  const { user } = useAuth();
  const healthSystemId = user?.healthSystemId;

  const { data: portfolioHealth, isLoading: healthLoading } = useQuery<PortfolioHealth>({
    queryKey: [`/api/health-systems/${healthSystemId}/analytics/portfolio-health`],
    enabled: !!healthSystemId,
  });

  const { data: departments, isLoading: deptLoading } = useQuery<DepartmentMetrics[]>({
    queryKey: [`/api/health-systems/${healthSystemId}/analytics/departments`],
    enabled: !!healthSystemId,
  });

  const { data: alertTrends, isLoading: alertLoading } = useQuery<AlertTrendAnalysis>({
    queryKey: [`/api/health-systems/${healthSystemId}/analytics/alert-trends`],
    enabled: !!healthSystemId,
  });

  const { data: complianceTrend, isLoading: complianceLoading } = useQuery<Array<{ date: string; value: number }>>({
    queryKey: [`/api/health-systems/${healthSystemId}/analytics/compliance-trend`],
    enabled: !!healthSystemId,
  });

  const { data: riskTrend, isLoading: riskLoading } = useQuery<Array<{ date: string; value: number }>>({
    queryKey: [`/api/health-systems/${healthSystemId}/analytics/risk-trend`],
    enabled: !!healthSystemId,
  });

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A": return "text-green-600 dark:text-green-400";
      case "B": return "text-blue-600 dark:text-blue-400";
      case "C": return "text-yellow-600 dark:text-yellow-400";
      case "D": return "text-orange-600 dark:text-orange-400";
      case "F": return "text-red-600 dark:text-red-400";
      default: return "text-gray-600 dark:text-gray-400";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving": return <TrendingUp className="w-4 h-4 text-green-600" data-testid="icon-trending-up" />;
      case "declining": return <TrendingDown className="w-4 h-4 text-red-600" data-testid="icon-trending-down" />;
      default: return <Minus className="w-4 h-4 text-gray-600" data-testid="icon-stable" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Advanced Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive insights into your AI portfolio performance
          </p>
        </div>
      </div>

      {/* Portfolio Health Score */}
      <Card data-testid="card-portfolio-health">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Portfolio Health Score
              </CardTitle>
              <CardDescription>
                Composite metric based on risk, compliance, alerts, and verification
              </CardDescription>
            </div>
            {portfolioHealth && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportPortfolioHealth(portfolioHealth)}
                data-testid="button-export-portfolio"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : portfolioHealth ? (
            <div className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className={`text-6xl font-bold ${getGradeColor(portfolioHealth.grade)}`} data-testid="text-health-score">
                    {portfolioHealth.overall}
                  </div>
                  <div className="text-sm text-muted-foreground">Overall Score</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={getGradeColor(portfolioHealth.grade)} data-testid="badge-health-grade">
                      Grade {portfolioHealth.grade}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(portfolioHealth.trend)}
                      <span className="text-sm text-muted-foreground capitalize">
                        {portfolioHealth.trend}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Risk Management</div>
                      <div className="text-2xl font-semibold" data-testid="text-risk-score">
                        {portfolioHealth.breakdown.riskManagement}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Compliance Posture</div>
                      <div className="text-2xl font-semibold" data-testid="text-compliance-score">
                        {portfolioHealth.breakdown.compliancePosture}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Alert Response</div>
                      <div className="text-2xl font-semibold" data-testid="text-alert-score">
                        {portfolioHealth.breakdown.alertResponse}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">System Verification</div>
                      <div className="text-2xl font-semibold" data-testid="text-verification-score">
                        {portfolioHealth.breakdown.systemVerification}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No portfolio data available
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Trend */}
        <Card data-testid="card-compliance-trend">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Compliance Trend
                </CardTitle>
                <CardDescription>6-month historical compliance rate</CardDescription>
              </div>
              {complianceTrend && complianceTrend.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportComplianceTrend(complianceTrend)}
                  data-testid="button-export-compliance"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {complianceLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : complianceTrend && complianceTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={complianceTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="Compliance Rate (%)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                No compliance trend data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Score Trend */}
        <Card data-testid="card-risk-trend">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Risk Score Trend
                </CardTitle>
                <CardDescription>6-month historical risk levels</CardDescription>
              </div>
              {riskTrend && riskTrend.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportRiskTrend(riskTrend)}
                  data-testid="button-export-risk"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {riskLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : riskTrend && riskTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={riskTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} name="Avg Risk Score" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                No risk trend data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department Metrics */}
      <Card data-testid="card-department-metrics">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Department Performance
              </CardTitle>
              <CardDescription>
                Comparative metrics across organizational departments
              </CardDescription>
            </div>
            {departments && departments.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportDepartmentMetrics(departments)}
                data-testid="button-export-departments"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {deptLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : departments && departments.length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={departments}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="averageComplianceRate" fill="#10b981" name="Compliance %" />
                  <Bar yAxisId="right" dataKey="activeAlertCount" fill="#ef4444" name="Active Alerts" />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {departments.map((dept) => (
                  <div key={dept.department} className="border rounded-lg p-4" data-testid={`card-department-${dept.department.toLowerCase().replace(/\s+/g, '-')}`}>
                    <h4 className="font-semibold mb-2">{dept.department}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Systems:</span>
                        <span className="font-medium">{dept.systemCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Risk:</span>
                        <span className="font-medium">{dept.averageRiskScore.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Compliance:</span>
                        <span className="font-medium">{dept.averageComplianceRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">High Risk:</span>
                        <span className="font-medium">{dept.highRiskSystemCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              No department data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Trends */}
      <Card data-testid="card-alert-trends">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Alert Activity
              </CardTitle>
              <CardDescription>30-day alert patterns and distribution</CardDescription>
            </div>
            {alertTrends && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportAlertTrends(alertTrends)}
                data-testid="button-export-alerts"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {alertLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : alertTrends ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Alerts</div>
                  <div className="text-2xl font-semibold" data-testid="text-total-alerts">{alertTrends.totalAlerts}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Resolved</div>
                  <div className="text-2xl font-semibold text-green-600" data-testid="text-resolved-alerts">{alertTrends.resolvedAlerts}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Unresolved</div>
                  <div className="text-2xl font-semibold text-red-600" data-testid="text-unresolved-alerts">{alertTrends.unresolvedAlerts}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Critical</div>
                  <div className="text-2xl font-semibold text-red-600" data-testid="text-critical-alerts">{alertTrends.bySeverity.critical}</div>
                </div>
              </div>
              {alertTrends.timeSeries && alertTrends.timeSeries.length > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={alertTrends.timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} name="Alerts per Day" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              No alert data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
