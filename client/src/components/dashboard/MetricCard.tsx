import { Card } from "@/components/ui/card";

interface MetricCardProps {
  value: string | number;
  label: string;
  variant?: "default" | "warning" | "success";
}

export default function MetricCard({ value, label, variant = "default" }: MetricCardProps) {
  return (
    <Card className="p-6">
      <div className="text-3xl font-bold mb-2" data-testid={`metric-${label.toLowerCase().replace(/\s+/g, '-')}-value`}>
        {value}
      </div>
      <div className="text-sm text-muted-foreground" data-testid={`metric-${label.toLowerCase().replace(/\s+/g, '-')}-label`}>
        {label}
      </div>
    </Card>
  );
}
