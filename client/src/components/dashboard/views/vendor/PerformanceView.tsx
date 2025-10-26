import { Card } from "@/components/ui/card";

export default function PerformanceView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Performance Metrics</h1>
        <p className="text-muted-foreground">System health and performance across all deployments</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="text-3xl font-bold mb-2" data-testid="metric-uptime">99.9%</div>
          <div className="text-sm text-muted-foreground">System Uptime (30 days)</div>
        </Card>
        <Card className="p-6">
          <div className="text-3xl font-bold mb-2" data-testid="metric-response-time">1.8s</div>
          <div className="text-sm text-muted-foreground">Avg Response Time</div>
        </Card>
        <Card className="p-6">
          <div className="text-3xl font-bold mb-2" data-testid="metric-accuracy">94.2%</div>
          <div className="text-sm text-muted-foreground">Model Accuracy</div>
        </Card>
        <Card className="p-6">
          <div className="text-3xl font-bold mb-2" data-testid="metric-scans">127K</div>
          <div className="text-sm text-muted-foreground">Scans Processed (30 days)</div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">System Health</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">PHI Leakage Detection</span>
              <span className="text-green-600 font-medium">0 incidents</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Model Drift</span>
              <span className="text-green-600 font-medium">Within tolerance</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Bias Variance</span>
              <span className="text-green-600 font-medium">&lt;3% (target: &lt;5%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">API Errors</span>
              <span className="text-green-600 font-medium">0.02%</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Performance by Deployment</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm">Regional Medical Center</span>
              <span className="text-sm font-medium">99.8%</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm">St. Mary's Hospital</span>
              <span className="text-sm font-medium">99.9%</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm">University Health System</span>
              <span className="text-sm font-medium">100%</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Metro Medical Group</span>
              <span className="text-sm font-medium">99.7%</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Usage Trends (Last 30 Days)</h2>
        <div className="h-64 bg-muted rounded flex items-center justify-center text-muted-foreground">
          Graph: Daily scans processed, response times, accuracy metrics
        </div>
      </Card>
    </div>
  );
}
