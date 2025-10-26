import { CheckCircle2 } from "lucide-react";

interface ActivityItemProps {
  description: string;
  timeAgo: string;
}

export default function ActivityItem({ description, timeAgo }: ActivityItemProps) {
  return (
    <div className="flex items-start gap-3 py-2">
      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="text-sm" data-testid="activity-description">{description}</div>
        <div className="text-xs text-muted-foreground" data-testid="activity-time">{timeAgo}</div>
      </div>
    </div>
  );
}
