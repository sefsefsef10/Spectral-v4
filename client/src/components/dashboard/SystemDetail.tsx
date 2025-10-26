import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, AlertCircle } from "lucide-react";

interface SystemDetailProps {
  onBack?: () => void;
}

export default function SystemDetail({ onBack }: SystemDetailProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Inventory
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="system-detail-title">Radiology AI v2.1</h1>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div data-testid="system-vendor">Vendor: VizAI Inc.</div>
            <div data-testid="system-department">Department: Radiology</div>
            <div data-testid="system-risk">Risk Level: High (processes patient imaging)</div>
          </div>
        </div>
        <Badge variant="destructive" className="text-base" data-testid="status-badge">
          Needs Action
        </Badge>
      </div>

      <Card className="p-6 border-destructive bg-destructive/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold mb-2" data-testid="alert-heading">ALERT: Model drift detected (4 hours ago)</div>
            <div className="text-sm mb-4" data-testid="alert-details">Accuracy dropped 8% on chest X-rays in past 7 days</div>
            
            <div className="space-y-2">
              <div className="font-medium text-sm">Recommended Actions:</div>
              <div className="space-y-2">
                <Button variant="outline" size="sm" data-testid="button-vendor-call">
                  Schedule vendor call - Discuss retraining
                </Button>
                <Button variant="outline" size="sm" data-testid="button-rollback">
                  Roll back to v2.0 - Automatic (click to confirm)
                </Button>
                <Button variant="outline" size="sm" data-testid="button-review-cases">
                  Review cases - See which cases affected
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="monitoring" data-testid="tab-monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Model Details</h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version:</span>
                <span data-testid="model-version">2.1.4</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deployed:</span>
                <span data-testid="model-deployed">45 days ago</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing:</span>
                <span data-testid="model-processing">~200 scans/day</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last verified:</span>
                <span data-testid="model-verified">30 days ago (re-verification due)</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Clinical Use</h3>
            <ul className="space-y-2 text-sm">
              <li data-testid="clinical-use-1">• Chest X-ray analysis</li>
              <li data-testid="clinical-use-2">• Pneumonia detection</li>
              <li data-testid="clinical-use-3">• Care pathway: ED triage</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Ownership</h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Clinical owner:</span>
                <span data-testid="owner-clinical">Dr. Sarah Chen (Radiology)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IT owner:</span>
                <span data-testid="owner-it">Mike Peterson (Clinical IT)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Compliance:</span>
                <span data-testid="owner-compliance">Jane Smith (you)</span>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6 mt-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Real-Time Health (Last 24 Hours)</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-green-600">🟢</span>
                <span className="text-sm">PHI Leakage: None detected</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-destructive">🔴</span>
                <span className="text-sm">Model Drift: 8% accuracy drop (ALERT)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">🟢</span>
                <span className="text-sm">Bias: Within tolerance (&lt;5% variance)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">🟢</span>
                <span className="text-sm">Uptime: 99.9%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">🟢</span>
                <span className="text-sm">Response Time: Avg 2.1 sec (normal)</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Drift Analysis (Past 7 Days)</h3>
            <div className="h-48 bg-muted rounded flex items-center justify-center text-muted-foreground">
              Graph: Accuracy declining from 94% → 86%
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="font-medium">Possible Causes:</div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Patient population change (new facility opened)</li>
                <li>• Imaging equipment update (new scanner type)</li>
                <li>• Seasonal variation (flu season X-rays different)</li>
              </ul>
              <div className="pt-2">
                <span className="font-medium">Recommended:</span> Contact vendor for model retraining
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6 mt-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Compliance Status</h3>
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✅</span>
                  <span className="text-sm font-medium">HIPAA Security Rule</span>
                </div>
                <span className="text-sm text-muted-foreground">Last audit: 30 days ago</span>
              </div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✅</span>
                  <span className="text-sm font-medium">NIST AI RMF</span>
                </div>
                <span className="text-sm text-muted-foreground">Mapped to 18 controls</span>
              </div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✅</span>
                  <span className="text-sm font-medium">FDA SaMD Guidance</span>
                </div>
                <span className="text-sm text-muted-foreground">Class II (low-risk)</span>
              </div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-600">⚠️</span>
                  <span className="text-sm font-medium">Re-verification due</span>
                </div>
                <span className="text-sm text-muted-foreground">Schedule within 7 days</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Evidence Documents (Audit-Ready)</h3>
            <div className="space-y-2">
              {[
                { name: "HIPAA Risk Assessment", date: "Jan 2025" },
                { name: "Clinical Validation Report", date: "Dec 2024" },
                { name: "Bias Testing Results", date: "Dec 2024" },
                { name: "Vendor BAA (signed)", date: "Nov 2024" },
                { name: "30-Day Activity Log", date: "auto-generated" },
              ].map((doc, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="flex items-center gap-2">
                    <span>📄</span>
                    <div>
                      <div className="text-sm font-medium">{doc.name}</div>
                      <div className="text-xs text-muted-foreground">({doc.date})</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" data-testid={`button-download-${i}`}>
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Activity History</h3>
            <div className="space-y-4 text-sm">
              <div className="border-l-2 border-muted pl-4">
                <div className="font-medium">4 hours ago</div>
                <div className="text-muted-foreground">Model drift detected - 8% accuracy drop</div>
              </div>
              <div className="border-l-2 border-muted pl-4">
                <div className="font-medium">30 days ago</div>
                <div className="text-muted-foreground">Last verification completed</div>
              </div>
              <div className="border-l-2 border-muted pl-4">
                <div className="font-medium">45 days ago</div>
                <div className="text-muted-foreground">Version 2.1.4 deployed</div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
