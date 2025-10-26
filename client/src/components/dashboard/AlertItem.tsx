import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AlertItemProps {
  title: string;
  description: string;
  onAction?: () => void;
}

export default function AlertItem({ title, description, onAction }: AlertItemProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b last:border-b-0">
      <div className="flex items-start gap-3 flex-1">
        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="font-medium" data-testid="alert-title">{title}</div>
          <div className="text-sm text-muted-foreground" data-testid="alert-description">{description}</div>
        </div>
      </div>
      {onAction && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAction}
          data-testid="button-alert-action"
        >
          <ArrowRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
