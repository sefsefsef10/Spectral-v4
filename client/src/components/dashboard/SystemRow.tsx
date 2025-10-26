import { Badge } from "@/components/ui/badge";

interface SystemRowProps {
  name: string;
  department: string;
  riskLevel: string;
  status: "verified" | "drift" | "testing";
  lastCheck: string;
  onClick?: () => void;
}

export default function SystemRow({ name, department, riskLevel, status, lastCheck, onClick }: SystemRowProps) {
  const statusConfig = {
    verified: { icon: "🟢", text: "Verified", variant: "secondary" as const },
    drift: { icon: "🔴", text: "Drift", variant: "destructive" as const },
    testing: { icon: "🟡", text: "Testing", variant: "secondary" as const },
  };

  const config = statusConfig[status];

  return (
    <div
      className="grid grid-cols-5 gap-4 px-4 py-3 hover-elevate cursor-pointer border-b transition-colors"
      onClick={onClick}
      data-testid={`system-row-${name.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-2">
        <span>{config.icon}</span>
        <span className="font-medium" data-testid="system-name">{name}</span>
      </div>
      <div className="text-sm text-muted-foreground" data-testid="system-department">{department}</div>
      <div className="text-sm" data-testid="system-risk">{riskLevel}</div>
      <div>
        <Badge variant={config.variant} data-testid="system-status">{config.text}</Badge>
      </div>
      <div className="text-sm text-muted-foreground" data-testid="system-last-check">{lastCheck}</div>
    </div>
  );
}
