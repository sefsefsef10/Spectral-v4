import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Map, CheckCircle2, AlertCircle, TrendingUp, Shield, Code, Eye, Lightbulb
} from "lucide-react";

type Platform = "langsmith" | "arize" | "langfuse" | "wandb";

const PLATFORM_OPTIONS = [
  { id: "langsmith", name: "LangSmith", description: "LLM observability & tracing" },
  { id: "arize", name: "Arize AI", description: "Model monitoring & drift detection" },
  { id: "langfuse", name: "LangFuse", description: "Open-source AI observability" },
  { id: "wandb", name: "Weights & Biases", description: "ML experiment tracking" },
];

export default function RosettaStone() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);

  const { data: analysis, isLoading, refetch } = useQuery({
    queryKey: ["/api/rosetta-stone/analyze", selectedPlatforms.join(",")],
    queryFn: async () => {
      if (selectedPlatforms.length === 0) return null;
      const response = await fetch(
        `/api/rosetta-stone/analyze?platforms=${selectedPlatforms.join(",")}`
      );
      if (!response.ok) throw new Error("Failed to analyze");
      return response.json();
    },
    enabled: selectedPlatforms.length > 0,
  });

  const handlePlatformToggle = (platformId: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getFrameworkBadgeColor = (framework: string) => {
    switch (framework) {
      case "HIPAA":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "NIST_AI_RMF":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "FDA_SaMD":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "ISO_42001":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Map className="w-8 h-8" />
          Rosetta Stone
        </h1>
        <p className="text-muted-foreground">
          Map your existing observability metrics to Spectral's compliance frameworks and
          identify gaps
        </p>
      </div>

      {/* Platform Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>1. Select Your Observability Platforms</CardTitle>
          <CardDescription>
            Choose which platforms you're currently using for AI monitoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {PLATFORM_OPTIONS.map((platform) => (
              <div
                key={platform.id}
                className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => handlePlatformToggle(platform.id as Platform)}
              >
                <Checkbox
                  checked={selectedPlatforms.includes(platform.id as Platform)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">{platform.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {platform.description}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedPlatforms.length > 0 && (
            <div className="mt-4">
              <Button onClick={() => refetch()}>
                <Eye className="w-4 h-4 mr-2" />
                Analyze Compliance Coverage
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-pulse">Analyzing your metrics...</div>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <>
          {/* Compliance Score */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>2. Your Compliance Score</CardTitle>
              <CardDescription>
                Overall compliance coverage based on your current metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Compliance Coverage</span>
                    <span className={`text-2xl font-bold ${getScoreColor(analysis.complianceScore)}`}>
                      {analysis.complianceScore}%
                    </span>
                  </div>
                  <Progress value={analysis.complianceScore} className="h-3" />
                </div>

                <div className="text-center px-6 border-l">
                  <div className="text-3xl font-bold text-primary">
                    {analysis.detectedMetrics.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Active Metrics
                  </div>
                </div>

                <div className="text-center px-6 border-l">
                  <div className="text-3xl font-bold text-destructive">
                    {analysis.missingEventTypes.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Gaps Found
                  </div>
                </div>
              </div>

              {analysis.complianceScore < 100 && (
                <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <strong>Gaps Detected:</strong> You're missing {analysis.missingEventTypes.length}{" "}
                      critical compliance checks. Review recommendations below to achieve 100%
                      coverage.
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Control Coverage */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>3. Control Coverage by Framework</CardTitle>
              <CardDescription>
                Which compliance controls you're currently monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {["HIPAA", "NIST_AI_RMF", "FDA_SaMD", "ISO_42001"].map((framework) => {
                  const frameworkControls = analysis.controlCoverage.filter(
                    (c: any) => c.framework === framework
                  );
                  const covered = frameworkControls.filter((c: any) => c.covered).length;
                  const total = frameworkControls.length;
                  const percentage = total > 0 ? Math.round((covered / total) * 100) : 0;

                  if (total === 0) return null;

                  return (
                    <div key={framework} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={getFrameworkBadgeColor(framework)}>
                          {framework.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {covered} / {total} controls
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>

              <details className="mt-6">
                <summary className="cursor-pointer text-sm font-medium text-primary">
                  View Detailed Control Coverage ({analysis.controlCoverage.length} total controls)
                </summary>
                <div className="mt-4 space-y-2">
                  {analysis.controlCoverage.map((control: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {control.covered ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">
                            {control.framework} {control.controlId}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {control.controlName}
                          </div>
                        </div>
                      </div>
                      {control.covered && (
                        <Badge variant="secondary" className="text-xs">
                          {control.coveringMetrics.length} metrics
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  4. Recommended Actions
                </CardTitle>
                <CardDescription>
                  Step-by-step guidance to achieve 100% compliance coverage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysis.recommendations.map((rec: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm">{rec}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 text-primary mt-0.5" />
                    <div className="text-sm">
                      <strong>Next Steps:</strong> Configure the recommended metrics in your
                      observability platforms, then run this analysis again to verify 100%
                      compliance coverage.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!analysis && !isLoading && selectedPlatforms.length > 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Click "Analyze Compliance Coverage" to see your metrics mapped to compliance
              frameworks
            </p>
          </CardContent>
        </Card>
      )}

      {!analysis && !isLoading && selectedPlatforms.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Code className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Select at least one observability platform to begin your compliance analysis
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
