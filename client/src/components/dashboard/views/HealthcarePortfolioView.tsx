import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Heart, 
  FileCheck, 
  Activity, 
  AlertTriangle, 
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  XCircle,
  AlertCircle
} from "lucide-react";

export function HealthcarePortfolioView() {
  const { user } = useUser();

  const { data: healthcareScore, isLoading, error } = useQuery({
    queryKey: ["healthcare-score", user?.healthSystemId],
    queryFn: async () => {
      const res = await fetch(`/api/health-systems/${user?.healthSystemId}/analytics/healthcare-score`);
      if (!res.ok) throw new Error("Failed to fetch healthcare score");
      return res.json();
    },
    enabled: !!user?.healthSystemId,
  });

  const { data: responseMetrics } = useQuery({
    queryKey: ["response-times", user?.healthSystemId],
    queryFn: async () => {
      const res = await fetch(`/api/health-systems/${user?.healthSystemId}/analytics/response-times`);
      if (!res.ok) throw new Error("Failed to fetch response times");
      return res.json();
    },
    enabled: !!user?.healthSystemId,
  });

  const { data: phiRiskBreakdown } = useQuery({
    queryKey: ["phi-risk-breakdown", user?.healthSystemId],
    queryFn: async () => {
      const res = await fetch(`/api/health-systems/${user?.healthSystemId}/analytics/phi-risk-breakdown`);
      if (!res.ok) throw new Error("Failed to fetch PHI risk breakdown");
      return res.json();
    },
    enabled: !!user?.healthSystemId,
  });

  const { data: clinicalSafetyBreakdown } = useQuery({
    queryKey: ["clinical-safety-breakdown", user?.healthSystemId],
    queryFn: async () => {
      const res = await fetch(`/api/health-systems/${user?.healthSystemId}/analytics/clinical-safety-breakdown`);
      if (!res.ok) throw new Error("Failed to fetch clinical safety breakdown");
      return res.json();
    },
    enabled: !!user?.healthSystemId,
  });

  const { data: complianceBreakdown } = useQuery({
    queryKey: ["compliance-breakdown", user?.healthSystemId],
    queryFn: async () => {
      const res = await fetch(`/api/health-systems/${user?.healthSystemId}/analytics/compliance-breakdown`);
      if (!res.ok) throw new Error("Failed to fetch compliance breakdown");
      return res.json();
    },
    enabled: !!user?.healthSystemId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load healthcare portfolio score. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-500';
      case 'B': return 'bg-blue-500';
      case 'C': return 'bg-yellow-500';
      case 'D': return 'bg-orange-500';
      case 'F': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'stable': return <Minus className="h-4 w-4 text-gray-600" />;
      default: return null;
    }
  };

  const formatSeconds = (seconds: number | null) => {
    if (seconds === null) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Hero Score Card */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl font-bold">Healthcare AI Portfolio Score</CardTitle>
              <CardDescription className="text-base mt-2">
                Healthcare-specific grading with defensible acquisition metrics
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className={`text-6xl font-bold ${getGradeColor(healthcareScore?.grade)} bg-clip-text text-transparent bg-gradient-to-r from-current to-current`}>
                  {healthcareScore?.grade || 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Grade</div>
              </div>
              <div className="text-center">
                <div className="text-6xl font-bold text-primary">
                  {healthcareScore?.overall || 0}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Score</div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-6">
            <Badge variant={healthcareScore?.trend === 'improving' ? 'default' : 'secondary'} className="text-sm">
              {getTrendIcon(healthcareScore?.trend)}
              <span className="ml-1 capitalize">{healthcareScore?.trend || 'stable'}</span>
            </Badge>
            {healthcareScore?.boardMetrics?.auditReady && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Audit Ready
              </Badge>
            )}
          </div>

          {/* Component Breakdown */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* PHI Protection */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <Badge variant="outline" className="text-xs">35% Weight</Badge>
                </div>
                <CardTitle className="text-lg">PHI Protection</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {healthcareScore?.breakdown?.phiProtection?.score || 0}
                    </span>
                    <span className={`text-lg font-semibold ${getGradeColor(healthcareScore?.breakdown?.phiProtection?.grade)}`}>
                      {healthcareScore?.breakdown?.phiProtection?.grade}
                    </span>
                  </div>
                  <Progress 
                    value={healthcareScore?.breakdown?.phiProtection?.score || 0} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    HIPAA-aligned PHI risk scoring
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Clinical Safety */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Heart className="h-5 w-5 text-red-600" />
                  <Badge variant="outline" className="text-xs">25% Weight</Badge>
                </div>
                <CardTitle className="text-lg">Clinical Safety</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {healthcareScore?.breakdown?.clinicalSafety?.score || 0}
                    </span>
                    <span className={`text-lg font-semibold ${getGradeColor(healthcareScore?.breakdown?.clinicalSafety?.grade)}`}>
                      {healthcareScore?.breakdown?.clinicalSafety?.grade}
                    </span>
                  </div>
                  <Progress 
                    value={healthcareScore?.breakdown?.clinicalSafety?.score || 0} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Accuracy, bias, hallucinations
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Regulatory Compliance */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <FileCheck className="h-5 w-5 text-green-600" />
                  <Badge variant="outline" className="text-xs">25% Weight</Badge>
                </div>
                <CardTitle className="text-lg">Regulatory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {healthcareScore?.breakdown?.regulatoryCompliance?.score || 0}
                    </span>
                    <span className={`text-lg font-semibold ${getGradeColor(healthcareScore?.breakdown?.regulatoryCompliance?.grade)}`}>
                      {healthcareScore?.breakdown?.regulatoryCompliance?.grade}
                    </span>
                  </div>
                  <Progress 
                    value={healthcareScore?.breakdown?.regulatoryCompliance?.score || 0} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    HIPAA, NIST, FDA compliance
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Operational Health */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Activity className="h-5 w-5 text-purple-600" />
                  <Badge variant="outline" className="text-xs">15% Weight</Badge>
                </div>
                <CardTitle className="text-lg">Operational</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {healthcareScore?.breakdown?.operationalHealth?.score || 0}
                    </span>
                    <span className={`text-lg font-semibold ${getGradeColor(healthcareScore?.breakdown?.operationalHealth?.grade)}`}>
                      {healthcareScore?.breakdown?.operationalHealth?.grade}
                    </span>
                  </div>
                  <Progress 
                    value={healthcareScore?.breakdown?.operationalHealth?.score || 0} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Response times, alerts
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Critical Issues & Board Metrics */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Critical Issues */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Critical Issues
            </CardTitle>
            <CardDescription>Issues requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <div>
                  <div className="font-semibold">PHI Violations</div>
                  <div className="text-xs text-muted-foreground">HIPAA-related incidents</div>
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {healthcareScore?.criticalIssues?.phiViolations || 0}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <div>
                  <div className="font-semibold">Patient Safety Incidents</div>
                  <div className="text-xs text-muted-foreground">Clinical harm events</div>
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  {healthcareScore?.criticalIssues?.patientSafetyIncidents || 0}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div>
                  <div className="font-semibold">Compliance Violations</div>
                  <div className="text-xs text-muted-foreground">Framework violations</div>
                </div>
                <div className="text-2xl font-bold text-yellow-600">
                  {healthcareScore?.criticalIssues?.complianceViolations || 0}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div>
                  <div className="font-semibold">Unresolved Critical Alerts</div>
                  <div className="text-xs text-muted-foreground">Active critical alerts</div>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {healthcareScore?.criticalIssues?.unresolvedCriticalAlerts || 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Board Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Board Metrics
            </CardTitle>
            <CardDescription>Executive-grade indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <div className="font-semibold">Total AI Systems</div>
                  <div className="text-xs text-muted-foreground">Portfolio size</div>
                </div>
                <div className="text-2xl font-bold">
                  {healthcareScore?.boardMetrics?.totalSystems || 0}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <div className="font-semibold">Audit Readiness</div>
                  <div className="text-xs text-muted-foreground">Compliance status</div>
                </div>
                <div>
                  {healthcareScore?.boardMetrics?.auditReady ? (
                    <Badge className="bg-green-600">Ready</Badge>
                  ) : (
                    <Badge variant="destructive">Not Ready</Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Avg Response Time
                  </div>
                  <div className="text-xs text-muted-foreground">Alert resolution speed</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {formatSeconds(healthcareScore?.boardMetrics?.averageResponseTime)}
                  </div>
                  {responseMetrics?.under2Minutes && (
                    <div className="text-xs text-green-600 font-semibold">
                      {Math.round((responseMetrics.under2Minutes / responseMetrics.totalResolved) * 100)}% under 2min
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="font-semibold mb-2">Beacon Tier Distribution</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>🏆 Trusted</span>
                    <span className="font-semibold">{healthcareScore?.boardMetrics?.beaconTiers?.trusted || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>✅ Certified</span>
                    <span className="font-semibold">{healthcareScore?.boardMetrics?.beaconTiers?.certified || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>📝 Verified</span>
                    <span className="font-semibold">{healthcareScore?.boardMetrics?.beaconTiers?.verified || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {healthcareScore?.recommendations && healthcareScore.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
            <CardDescription>Actionable insights to improve your portfolio score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {healthcareScore.recommendations.map((rec: string, idx: number) => (
                <Alert key={idx} variant={rec.includes('URGENT') || rec.includes('CRITICAL') ? 'destructive' : 'default'}>
                  <AlertDescription className="font-medium">{rec}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Healthcare-Specific Metrics Breakdown</CardTitle>
          <CardDescription>Deep-dive into PHI protection, clinical safety, and compliance</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="phi" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="phi">PHI Protection</TabsTrigger>
              <TabsTrigger value="clinical">Clinical Safety</TabsTrigger>
              <TabsTrigger value="compliance">Compliance Translation</TabsTrigger>
            </TabsList>

            {/* PHI Protection Tab */}
            <TabsContent value="phi" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      Overall PHI Risk
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold">{phiRiskBreakdown?.overall || 0}</span>
                        <span className="text-lg text-muted-foreground">/100</span>
                      </div>
                      <Progress value={phiRiskBreakdown?.overall || 0} className="h-3" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">HIPAA Control Mapping</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">164.312(a) - Access Controls</span>
                        <Badge variant={phiRiskBreakdown?.mappedControls?.includes('164.312(a)') ? 'default' : 'destructive'}>
                          {phiRiskBreakdown?.mappedControls?.includes('164.312(a)') ? 'Met' : 'Violation'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">164.312(b) - Audit Controls</span>
                        <Badge variant={phiRiskBreakdown?.mappedControls?.includes('164.312(b)') ? 'default' : 'destructive'}>
                          {phiRiskBreakdown?.mappedControls?.includes('164.312(b)') ? 'Met' : 'Violation'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">PHI Exposure Events</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">
                      {phiRiskBreakdown?.phiExposures || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">10x weight multiplier</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Data Leakage Events</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600">
                      {phiRiskBreakdown?.dataLeaks || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">High priority</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Unauthorized Access</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-yellow-600">
                      {phiRiskBreakdown?.unauthorizedAccess || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Moderate priority</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Clinical Safety Tab */}
            <TabsContent value="clinical" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-600" />
                      Overall Clinical Safety
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold">{clinicalSafetyBreakdown?.overall || 0}</span>
                        <span className="text-lg text-muted-foreground">/100</span>
                      </div>
                      <Progress value={clinicalSafetyBreakdown?.overall || 0} className="h-3" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Patient Safety Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {clinicalSafetyBreakdown?.patientSafetyIncidents === 0 ? (
                        <>
                          <CheckCircle2 className="h-8 w-8 text-green-600" />
                          <div>
                            <div className="font-semibold text-green-600">No Incidents</div>
                            <div className="text-xs text-muted-foreground">Zero patient harm events</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-8 w-8 text-red-600" />
                          <div>
                            <div className="font-semibold text-red-600">{clinicalSafetyBreakdown?.patientSafetyIncidents} Incidents</div>
                            <div className="text-xs text-muted-foreground">Requires immediate review</div>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Clinical Accuracy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {clinicalSafetyBreakdown?.components?.accuracy || 0}
                    </div>
                    <Progress value={clinicalSafetyBreakdown?.components?.accuracy || 0} className="h-2 mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Bias Detection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {clinicalSafetyBreakdown?.components?.bias || 0}
                    </div>
                    <Progress value={clinicalSafetyBreakdown?.components?.bias || 0} className="h-2 mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Hallucination Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {clinicalSafetyBreakdown?.components?.hallucinations || 0}
                    </div>
                    <Progress value={clinicalSafetyBreakdown?.components?.hallucinations || 0} className="h-2 mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Patient Safety</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {clinicalSafetyBreakdown?.components?.patientSafety || 0}
                    </div>
                    <Progress value={clinicalSafetyBreakdown?.components?.patientSafety || 0} className="h-2 mt-2" />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Compliance Translation Tab */}
            <TabsContent value="compliance" className="space-y-4">
              {complianceBreakdown?.frameworks?.map((framework: any, idx: number) => (
                <Card key={idx}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileCheck className="h-4 w-4 text-green-600" />
                          {framework.name}
                        </CardTitle>
                        <CardDescription>{framework.description}</CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">
                          {framework.met}/{framework.total}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {Math.round((framework.met / framework.total) * 100)}% compliance
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Progress value={(framework.met / framework.total) * 100} className="h-3 mb-4" />
                      
                      {framework.violations && framework.violations.length > 0 && (
                        <div>
                          <div className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            Specific Violations ({framework.violations.length})
                          </div>
                          <div className="space-y-1">
                            {framework.violations.map((violation: string, vIdx: number) => (
                              <div key={vIdx} className="flex items-start gap-2 text-sm">
                                <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                <span className="text-red-600 font-mono">{violation}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(!framework.violations || framework.violations.length === 0) && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm font-semibold">All controls met - Full compliance achieved</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
