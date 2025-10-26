import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { FileText, User, Shield, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { AuditLog } from "@shared/schema";

export default function AuditLogs() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("all");

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs", { action: actionFilter !== "all" ? actionFilter : undefined, resourceType: resourceTypeFilter !== "all" ? resourceTypeFilter : undefined }],
  });

  const actionTypes = ["all", "create", "update", "delete", "login", "logout", "invite_user", "cancel_invitation", "accept_invitation", "resolve_alert", "approve_certification", "reject_certification"];
  const resourceTypes = ["all", "user", "ai_system", "alert", "certification", "deployment", "compliance_report"];

  const getActionColor = (action: string) => {
    if (action.includes("delete") || action.includes("reject")) return "destructive";
    if (action.includes("create") || action.includes("approve")) return "default";
    if (action.includes("update")) return "secondary";
    return "outline";
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold mb-2" data-testid="text-audit-logs-title">Audit Logs</h1>
        <p className="text-muted-foreground">
          Comprehensive activity tracking for compliance and security monitoring
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Action Type</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger data-testid="select-action-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {actionTypes.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action === "all" ? "All Actions" : action.replace(/_/g, " ").toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Resource Type</label>
              <Select value={resourceTypeFilter} onValueChange={setResourceTypeFilter}>
                <SelectTrigger data-testid="select-resource-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resourceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === "all" ? "All Resources" : type.replace(/_/g, " ").toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Entries */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Loading audit logs...</p>
          </CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">No audit logs found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id} className="hover-elevate" data-testid={`card-audit-log-${log.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant={getActionColor(log.action)} data-testid={`badge-action-${log.id}`}>
                        {log.action.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                      <Badge variant="outline" data-testid={`badge-resource-${log.id}`}>
                        <FileText className="h-3 w-3 mr-1" />
                        {log.resourceType}
                      </Badge>
                      {log.resourceName && (
                        <span className="text-sm font-medium truncate" data-testid={`text-resource-name-${log.id}`}>
                          {log.resourceName}
                        </span>
                      )}
                    </div>
                    <CardDescription className="flex items-center gap-2 text-xs">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              {(log.metadata !== null || log.changes !== null) ? (
                <CardContent className="pt-0">
                  <div className="space-y-2 text-sm">
                    {log.metadata !== null && log.metadata !== undefined && (
                      <div>
                        <span className="font-medium text-muted-foreground">Details: </span>
                        <span className="text-foreground">
                          {typeof log.metadata === 'object' 
                            ? JSON.stringify(log.metadata as Record<string, unknown>, null, 2)
                            : String(log.metadata)
                          }
                        </span>
                      </div>
                    )}
                    
                    {log.changes !== null && log.changes !== undefined && (
                      <details className="mt-2">
                        <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                          View Changes
                        </summary>
                        <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto">
                          {JSON.stringify(log.changes as Record<string, unknown>, null, 2)}
                        </pre>
                      </details>
                    )}

                    {(log.ipAddress || log.userAgent) ? (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
                        {log.ipAddress && (
                          <span data-testid={`text-ip-${log.id}`}>IP: {log.ipAddress}</span>
                        )}
                        {log.userAgent && (
                          <span className="truncate max-w-md" data-testid={`text-useragent-${log.id}`}>
                            {log.userAgent}
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
