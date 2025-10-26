import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { AISystem } from "@shared/schema";
import { Download, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

const COMPLIANCE_FRAMEWORKS = [
  {
    id: "hipaa",
    name: "HIPAA",
    fullName: "Health Insurance Portability and Accountability Act",
    requirements: [
      "Privacy Rule Compliance",
      "Security Rule Compliance",
      "PHI Access Controls",
      "Audit Controls",
      "Data Encryption",
    ],
  },
  {
    id: "nist",
    name: "NIST AI RMF",
    fullName: "NIST AI Risk Management Framework",
    requirements: [
      "Risk Assessment Documentation",
      "Model Validation",
      "Bias Testing",
      "Explainability Standards",
      "Continuous Monitoring",
    ],
  },
  {
    id: "fda",
    name: "FDA SaMD",
    fullName: "FDA Software as a Medical Device Guidance",
    requirements: [
      "Clinical Validation",
      "Performance Monitoring",
      "Adverse Event Reporting",
      "Change Control Process",
      "Quality System Documentation",
    ],
  },
];

export default function ComplianceView() {
  const [selectedFramework, setSelectedFramework] = useState("hipaa");
  const { user } = useAuth();

  const { data: systems = [], isLoading } = useQuery<AISystem[]>({
    queryKey: ["/api/ai-systems"],
    enabled: !!user,
  });

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
    return <div className="p-6">Loading compliance data...</div>;
  }

  const totalSystems = systems.length;
  const compliantSystems = systems.filter(s => s.status === "Compliant").length;
  const driftSystems = systems.filter(s => s.status === "Drift").length;
  const nonCompliantSystems = systems.filter(s => s.status === "Non-Compliant").length;
  const complianceRate = totalSystems > 0 ? Math.round((compliantSystems / totalSystems) * 100) : 0;

  const selectedFrameworkData = COMPLIANCE_FRAMEWORKS.find(f => f.id === selectedFramework);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Compliance Dashboard</h1>
          <p className="text-muted-foreground">Healthcare AI regulatory compliance tracking</p>
        </div>
        <Button data-testid="button-export-audit-log">
          <Download className="w-4 h-4 mr-2" />
          Export Audit Log
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium">Compliant Systems</span>
          </div>
          <div className="text-3xl font-bold" data-testid="compliant-count">{compliantSystems}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {complianceRate}% of portfolio
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium">Drift Detected</span>
          </div>
          <div className="text-3xl font-bold" data-testid="drift-count">{driftSystems}</div>
          <div className="text-sm text-muted-foreground mt-1">
            Requires review
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <XCircle className="w-5 h-5 text-destructive" />
            <span className="text-sm font-medium">Non-Compliant</span>
          </div>
          <div className="text-3xl font-bold" data-testid="non-compliant-count">{nonCompliantSystems}</div>
          <div className="text-sm text-muted-foreground mt-1">
            Immediate action required
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Framework Coverage</h2>
        <div className="flex gap-2 mb-6">
          {COMPLIANCE_FRAMEWORKS.map((framework) => (
            <Button
              key={framework.id}
              variant={selectedFramework === framework.id ? "default" : "outline"}
              onClick={() => setSelectedFramework(framework.id)}
              data-testid={`framework-${framework.id}`}
            >
              {framework.name}
            </Button>
          ))}
        </div>

        {selectedFrameworkData && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-1">{selectedFrameworkData.fullName}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Compliance status: <span className={complianceRate >= 90 ? "text-green-600" : "text-yellow-600"}>
                  {complianceRate}% ({compliantSystems}/{totalSystems} systems)
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Key Requirements</h4>
              {selectedFrameworkData.requirements.map((req, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  data-testid={`requirement-${index}`}
                >
                  <span className="text-sm">{req}</span>
                  <Badge variant={complianceRate >= 90 ? "secondary" : "outline"}>
                    {complianceRate >= 90 ? (
                      <CheckCircle className="w-3 h-3 mr-1" />
                    ) : (
                      <AlertCircle className="w-3 h-3 mr-1" />
                    )}
                    {complianceRate >= 90 ? "Met" : "In Progress"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Compliance Activity</h2>
        <div className="space-y-3">
          {systems.slice(0, 5).map((system, index) => (
            <div key={system.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <div className="flex-1">
                <div className="font-medium">{system.name}</div>
                <div className="text-sm text-muted-foreground">{system.department}</div>
              </div>
              <Badge 
                variant={
                  system.status === "Compliant" ? "secondary" : 
                  system.status === "Drift" ? "outline" : 
                  "destructive"
                }
                data-testid={`system-status-${index}`}
              >
                {system.status}
              </Badge>
            </div>
          ))}
          {systems.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No AI systems to display
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
