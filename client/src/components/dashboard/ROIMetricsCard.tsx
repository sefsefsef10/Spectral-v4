import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, Clock, Shield, Award } from "lucide-react";

interface ROIMetric {
  type: string;
  category: string;
  value: number;
  unit: string;
  description: string;
  trend?: number;
}

interface ROIMetricsCardProps {
  metrics?: ROIMetric[];
}

export default function ROIMetricsCard({ metrics = [] }: ROIMetricsCardProps) {
  const demoMetrics: ROIMetric[] = metrics.length > 0 ? metrics : [
    {
      type: "cost_avoided",
      category: "compliance",
      value: 450000,
      unit: "usd",
      description: "Avoided HIPAA violations through automated monitoring",
      trend: 15,
    },
    {
      type: "time_saved",
      category: "efficiency",
      value: 1200,
      unit: "hours",
      description: "Automated compliance reporting and certification workflows",
      trend: 22,
    },
    {
      type: "deal_closed",
      category: "revenue",
      value: 3,
      unit: "count",
      description: "Vendors certified and procured through platform",
      trend: 50,
    },
    {
      type: "risk_mitigated",
      category: "risk",
      value: 89,
      unit: "percentage",
      description: "AI systems with zero critical compliance violations",
      trend: 12,
    },
  ];

  const formatValue = (value: number, unit: string) => {
    switch (unit) {
      case "usd":
        return `$${(value / 1000).toFixed(0)}K`;
      case "hours":
        return `${value.toLocaleString()} hrs`;
      case "percentage":
        return `${value}%`;
      case "count":
        return value.toString();
      default:
        return value.toString();
    }
  };

  const getIcon = (category: string) => {
    switch (category) {
      case "revenue":
        return <DollarSign className="w-5 h-5 text-green-600" />;
      case "efficiency":
        return <Clock className="w-5 h-5 text-blue-600" />;
      case "compliance":
        return <Shield className="w-5 h-5 text-purple-600" />;
      case "risk":
        return <Award className="w-5 h-5 text-orange-600" />;
      default:
        return <TrendingUp className="w-5 h-5" />;
    }
  };

  const totalValue = demoMetrics.reduce((sum, metric) => {
    if (metric.unit === "usd") return sum + metric.value;
    return sum;
  }, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          Business Value Delivered
        </CardTitle>
        <CardDescription>
          Tangible ROI from AI governance platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="text-sm text-muted-foreground mb-1">Total Cost Savings (YTD)</div>
          <div className="text-3xl font-bold text-green-700">${(totalValue / 1000).toFixed(0)}K</div>
        </div>

        <div className="space-y-3">
          {demoMetrics.map((metric, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="mt-1">{getIcon(metric.category)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-medium text-sm">{formatValue(metric.value, metric.unit)}</div>
                  {metric.trend && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <TrendingUp className="w-3 h-3" />
                      {metric.trend}%
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{metric.description}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
