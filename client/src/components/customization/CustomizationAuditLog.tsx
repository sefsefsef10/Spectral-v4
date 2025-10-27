/**
 * 📋 CUSTOMIZATION AUDIT LOG
 * 
 * Complete audit trail of all Translation Engine customizations
 * Required for compliance documentation
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, CheckCircle2, Clock, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface AuditLogEntry {
  id: string;
  customizationType: string;
  action: string;
  changedBy: string;
  changeReason: string | null;
  oldValue: string | null;
  newValue: string | null;
  approvalRequired: boolean;
  approvalStatus: string | null;
  createdAt: string;
}

export function CustomizationAuditLog() {
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAuditLog();
  }, []);

  const loadAuditLog = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/customization/audit?limit=50", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load audit log");
      }

      const data = await response.json();
      setAuditLog(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string, approvalStatus: string | null) => {
    if (approvalStatus === "approved") {
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {action}
        </Badge>
      );
    }
    if (approvalStatus === "pending") {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          {action} (pending)
        </Badge>
      );
    }
    if (approvalStatus === "rejected") {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          {action} (rejected)
        </Badge>
      );
    }
    return <Badge variant="outline">{action}</Badge>;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      threshold_override: "Threshold Override",
      control_toggle: "Control Toggle",
      custom_control: "Custom Control",
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <CardTitle>Customization Audit Trail</CardTitle>
        </div>
        <CardDescription>
          Complete history of all Translation Engine customizations for compliance documentation
        </CardDescription>
      </CardHeader>
      <CardContent>
        {auditLog.length === 0 ? (
          <Alert>
            <AlertDescription>
              No customization history yet. Create threshold overrides, toggle controls, or build custom controls to see audit entries.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {auditLog.map((entry) => (
              <div
                key={entry.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{getTypeLabel(entry.customizationType)}</span>
                      {getActionBadge(entry.action, entry.approvalStatus)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(entry.createdAt), "PPpp")}
                    </p>
                  </div>
                  {entry.approvalRequired && (
                    <Badge variant="outline" className="gap-1">
                      <Shield className="h-3 w-3" />
                      Approval Required
                    </Badge>
                  )}
                </div>

                {entry.changeReason && (
                  <div>
                    <p className="text-sm font-medium mb-1">Reason:</p>
                    <p className="text-sm text-muted-foreground">{entry.changeReason}</p>
                  </div>
                )}

                {(entry.oldValue || entry.newValue) && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {entry.oldValue && (
                      <div>
                        <p className="font-medium mb-1">Previous Value:</p>
                        <p className="text-muted-foreground font-mono text-xs bg-muted p-2 rounded">
                          {entry.oldValue}
                        </p>
                      </div>
                    )}
                    {entry.newValue && (
                      <div>
                        <p className="font-medium mb-1">New Value:</p>
                        <p className="text-muted-foreground font-mono text-xs bg-muted p-2 rounded">
                          {entry.newValue}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Modified by: {entry.changedBy}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
