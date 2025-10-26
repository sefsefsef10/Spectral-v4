/**
 * CSV Export Utilities
 * Generate CSV files from analytics data for board presentations
 */

export function downloadCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    console.error("No data to export");
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    // Header row
    headers.join(","),
    // Data rows
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values that might contain commas
        if (typeof value === "string" && value.includes(",")) {
          return `"${value}"`;
        }
        return value ?? "";
      }).join(",")
    )
  ].join("\n");

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportDepartmentMetrics(departments: any[]) {
  const exportData = departments.map(dept => ({
    Department: dept.department,
    "System Count": dept.systemCount,
    "Average Risk Score": dept.averageRiskScore.toFixed(2),
    "Compliance Rate (%)": dept.averageComplianceRate,
    "Active Alerts": dept.activeAlertCount,
    "High Risk Systems": dept.highRiskSystemCount,
  }));

  const filename = `department-metrics-${new Date().toISOString().split("T")[0]}.csv`;
  downloadCSV(exportData, filename);
}

export function exportAlertTrends(alertData: any) {
  const summaryData = [
    {
      Metric: "Total Alerts",
      Value: alertData.totalAlerts,
    },
    {
      Metric: "Resolved Alerts",
      Value: alertData.resolvedAlerts,
    },
    {
      Metric: "Unresolved Alerts",
      Value: alertData.unresolvedAlerts,
    },
    {
      Metric: "Critical Severity",
      Value: alertData.bySeverity.critical,
    },
    {
      Metric: "High Severity",
      Value: alertData.bySeverity.high,
    },
    {
      Metric: "Medium Severity",
      Value: alertData.bySeverity.medium,
    },
    {
      Metric: "Low Severity",
      Value: alertData.bySeverity.low,
    },
  ];

  const filename = `alert-trends-${new Date().toISOString().split("T")[0]}.csv`;
  downloadCSV(summaryData, filename);
}

export function exportPortfolioHealth(healthData: any) {
  const exportData = [
    {
      Metric: "Overall Score",
      Value: healthData.overall,
    },
    {
      Metric: "Grade",
      Value: healthData.grade,
    },
    {
      Metric: "Trend",
      Value: healthData.trend,
    },
    {
      Metric: "Risk Management Score",
      Value: healthData.breakdown.riskManagement,
    },
    {
      Metric: "Compliance Posture Score",
      Value: healthData.breakdown.compliancePosture,
    },
    {
      Metric: "Alert Response Score",
      Value: healthData.breakdown.alertResponse,
    },
    {
      Metric: "System Verification Score",
      Value: healthData.breakdown.systemVerification,
    },
  ];

  const filename = `portfolio-health-${new Date().toISOString().split("T")[0]}.csv`;
  downloadCSV(exportData, filename);
}

export function exportComplianceTrend(trendData: any[]) {
  const exportData = trendData.map(point => ({
    Date: point.date,
    "Compliance Rate (%)": point.value,
  }));

  const filename = `compliance-trend-${new Date().toISOString().split("T")[0]}.csv`;
  downloadCSV(exportData, filename);
}

export function exportRiskTrend(trendData: any[]) {
  const exportData = trendData.map(point => ({
    Date: point.date,
    "Risk Score": point.value,
  }));

  const filename = `risk-trend-${new Date().toISOString().split("T")[0]}.csv`;
  downloadCSV(exportData, filename);
}
