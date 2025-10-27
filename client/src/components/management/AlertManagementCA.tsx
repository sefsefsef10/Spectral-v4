import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

const createAlertSchema = z.object({
  aiSystemId: z.string().min(1, "AI system ID is required"),
  type: z.enum(["performance_degradation", "model_drift", "security_breach", "phi_exposure", "compliance_violation"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  message: z.string().min(1, "Message is required"),
  details: z.string().optional(),
});

type CreateAlertForm = z.infer<typeof createAlertSchema>;

interface Alert {
  id: string;
  aiSystemId: string;
  type: string;
  severity: string;
  message: string;
  status: string;
  slaDeadline?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

export default function AlertManagementCA() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [aiSystemIdFilter, setAiSystemIdFilter] = useState<string>("ai-system-123");

  const { data: alerts = [], isLoading, refetch } = useQuery<Alert[]>({
    queryKey: ["ca-alerts", aiSystemIdFilter, filterSeverity, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams({ aiSystemId: aiSystemIdFilter });
      if (filterSeverity !== "all") params.append("severity", filterSeverity);
      if (filterStatus !== "all") params.append("status", filterStatus);
      const response = await apiRequest("GET", `/api/alerts?${params.toString()}`);
      return response.alerts || [];
    },
    enabled: !!aiSystemIdFilter,
  });

  const createAlertMutation = useMutation({
    mutationFn: async (data: CreateAlertForm) => {
      return await apiRequest("POST", "/api/alerts", data);
    },
    onSuccess: () => {
      toast({ title: "✓ Alert created successfully" });
      queryClient.invalidateQueries({ queryKey: ["ca-alerts"] });
      setCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create alert",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return await apiRequest("PUT", `/api/alerts/${alertId}/acknowledge`);
    },
    onSuccess: () => {
      toast({ title: "✓ Alert acknowledged successfully" });
      queryClient.invalidateQueries({ queryKey: ["ca-alerts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to acknowledge alert",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return await apiRequest("PUT", `/api/alerts/${alertId}/resolve`);
    },
    onSuccess: () => {
      toast({ title: "✓ Alert resolved successfully" });
      queryClient.invalidateQueries({ queryKey: ["ca-alerts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to resolve alert",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<CreateAlertForm>({
    resolver: zodResolver(createAlertSchema),
    defaultValues: {
      aiSystemId: "ai-system-123",
      type: "performance_degradation",
      severity: "medium",
      message: "",
      details: "",
    },
  });

  const onCreateSubmit = (data: CreateAlertForm) => {
    createAlertMutation.mutate(data);
  };

  const getSeverityBadgeVariant = (severity: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "high":
        return "default";
      case "medium":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "active":
        return "destructive";
      case "acknowledged":
        return "secondary";
      case "resolved":
        return "outline";
      default:
        return "outline";
    }
  };

  const calculateTimeRemaining = (slaDeadline?: string) => {
    if (!slaDeadline) return null;
    const deadline = new Date(slaDeadline);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    if (diff < 0) return "⚠ SLA BREACHED";
    return `${formatDistanceToNow(deadline, { addSuffix: false })} remaining`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Alert Management (Clean Architecture)</CardTitle>
            <CardDescription>
              Monitor alerts, acknowledge issues, and resolve incidents with SLA tracking
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="AI System ID"
              value={aiSystemIdFilter}
              onChange={(e) => setAiSystemIdFilter(e.target.value)}
              className="w-48"
            />
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Create Alert
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Alert</DialogTitle>
                  <DialogDescription>
                    Report a new issue for monitoring and tracking
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="aiSystemId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>AI System ID</FormLabel>
                          <FormControl>
                            <Input placeholder="ai-system-123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alert Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="performance_degradation">Performance Degradation</SelectItem>
                              <SelectItem value="model_drift">Model Drift</SelectItem>
                              <SelectItem value="security_breach">Security Breach</SelectItem>
                              <SelectItem value="phi_exposure">PHI Exposure</SelectItem>
                              <SelectItem value="compliance_violation">Compliance Violation</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="severity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Severity</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="critical">Critical - Immediate action</SelectItem>
                              <SelectItem value="high">High - Urgent attention</SelectItem>
                              <SelectItem value="medium">Medium - Important</SelectItem>
                              <SelectItem value="low">Low - Monitor</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Input placeholder="Brief alert description" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="details"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Details (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Additional context..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createAlertMutation.isPending}>
                        {createAlertMutation.isPending ? "Creating..." : "Create Alert"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading alerts...</p>
        ) : !aiSystemIdFilter ? (
          <p className="text-muted-foreground">Enter an AI System ID to view alerts</p>
        ) : alerts.length === 0 ? (
          <p className="text-muted-foreground">No alerts found for {aiSystemIdFilter}</p>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium">{alert.message}</p>
                    <Badge variant={getSeverityBadgeVariant(alert.severity)}>
                      {alert.severity}
                    </Badge>
                    <Badge variant={getStatusBadgeVariant(alert.status)}>
                      {alert.status}
                    </Badge>
                    <Badge variant="outline">{alert.type.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                    <span>System: {alert.aiSystemId}</span>
                    <span>Created: {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}</span>
                    {alert.slaDeadline && alert.status === "active" && (
                      <span className="flex items-center gap-1 text-orange-600 font-medium">
                        <Clock className="w-3 h-3" />
                        SLA: {calculateTimeRemaining(alert.slaDeadline)}
                      </span>
                    )}
                    {alert.acknowledgedBy && (
                      <span>Ack by: {alert.acknowledgedBy}</span>
                    )}
                    {alert.resolvedBy && (
                      <span>Resolved by: {alert.resolvedBy}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {alert.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                      disabled={acknowledgeAlertMutation.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Acknowledge
                    </Button>
                  )}
                  {(alert.status === "active" || alert.status === "acknowledged") && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => resolveAlertMutation.mutate(alert.id)}
                      disabled={resolveAlertMutation.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
