import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Calendar } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function ReportingView() {
  const { user } = useAuth();
  const { toast } = useToast();

  const reports = [
    { name: "Board Executive Summary", type: "Quarterly", lastRun: "1 week ago", status: "ready", reportType: "quarterly", periodDays: 90 },
    { name: "HIPAA Compliance Report", type: "Monthly", lastRun: "3 days ago", status: "ready", reportType: "monthly", periodDays: 30 },
    { name: "AI Risk Assessment", type: "Monthly", lastRun: "1 week ago", status: "ready", reportType: "monthly", periodDays: 30 },
    { name: "Vendor Performance Review", type: "Quarterly", lastRun: "2 weeks ago", status: "ready", reportType: "quarterly", periodDays: 90 },
  ];

  const downloadMutation = useMutation({
    mutationFn: async ({ reportType, periodDays }: { reportType: string; periodDays: number }) => {
      if (!user?.healthSystemId) {
        throw new Error("No health system associated with your account");
      }

      const response = await fetch(`/api/health-systems/${user.healthSystemId}/reports/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reportType, periodDays }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate report");
      }

      return response.blob();
    },
    onSuccess: (blob, variables) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `compliance-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Report Downloaded",
        description: "Your compliance report has been generated and downloaded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Reporting</h1>
        <p className="text-muted-foreground">Automated compliance and executive reports</p>
      </div>

      <div className="grid gap-4">
        {reports.map((report, index) => (
          <Card key={index} className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="font-semibold" data-testid={`report-name-${index}`}>{report.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {report.type} · Last run: {report.lastRun}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" data-testid={`button-schedule-${index}`}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule
                </Button>
                <Button 
                  size="sm" 
                  data-testid={`button-download-${index}`}
                  onClick={() => downloadMutation.mutate({ reportType: report.reportType, periodDays: report.periodDays })}
                  disabled={downloadMutation.isPending}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {downloadMutation.isPending ? "Generating..." : "Download"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Custom Report Builder</h2>
        <div className="text-sm text-muted-foreground mb-4">
          Create custom reports with specific metrics, date ranges, and AI systems
        </div>
        <Button data-testid="button-create-custom">Create Custom Report</Button>
      </Card>
    </div>
  );
}
