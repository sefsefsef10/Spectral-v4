import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Rocket, RefreshCw, Play, RotateCcw, TrendingUp, Heart } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

const createDeploymentSchema = z.object({
  aiSystemId: z.string().min(1, "AI system ID is required"),
  version: z.string().min(1, "Version is required"),
  strategy: z.enum(["rolling", "blue_green", "canary"]),
  healthCheckEndpoint: z.string().min(1, "Health check endpoint is required"),
  canaryPercentage: z.number().min(10).max(100).optional(),
});

type CreateDeploymentForm = z.infer<typeof createDeploymentSchema>;

interface Deployment {
  id: string;
  aiSystemId: string;
  version: string;
  strategy: string;
  status: string;
  canaryPercentage?: number;
  errorRate?: number;
  consecutiveHealthCheckFailures?: number;
  deployedAt?: string;
  createdAt: string;
}

export default function DeploymentManagementCA() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: deployments = [], isLoading, refetch } = useQuery<Deployment[]>({
    queryKey: ["ca-deployments", filterStatus],
    queryFn: async () => {
      const params = filterStatus !== "all" ? `?status=${filterStatus}` : "";
      return await apiRequest("GET", `/api/deployments${params}`);
    },
  });

  const createDeploymentMutation = useMutation({
    mutationFn: async (data: CreateDeploymentForm) => {
      return await apiRequest("POST", "/api/deployments", {
        ...data,
        healthChecks: [
          { endpoint: data.healthCheckEndpoint, expectedStatus: 200, timeout: 5000 },
        ],
        rollbackPolicy: {
          autoRollback: true,
          errorThreshold: 0.05,
          healthCheckFailureThreshold: 3,
        },
      });
    },
    onSuccess: () => {
      toast({ title: "✓ Deployment created successfully" });
      queryClient.invalidateQueries({ queryKey: ["ca-deployments"] });
      setCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create deployment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const advanceCanaryMutation = useMutation({
    mutationFn: async (deploymentId: string) => {
      return await apiRequest("POST", `/api/deployments/${deploymentId}/advance-canary`);
    },
    onSuccess: () => {
      toast({ title: "✓ Canary advanced successfully" });
      queryClient.invalidateQueries({ queryKey: ["ca-deployments"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to advance canary",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: async ({ deploymentId, reason }: { deploymentId: string; reason: string }) => {
      return await apiRequest("POST", `/api/deployments/${deploymentId}/rollback`, { reason });
    },
    onSuccess: () => {
      toast({ title: "✓ Deployment rolled back successfully" });
      queryClient.invalidateQueries({ queryKey: ["ca-deployments"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to rollback deployment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const healthCheckMutation = useMutation({
    mutationFn: async (deploymentId: string) => {
      return await apiRequest("POST", `/api/deployments/${deploymentId}/health-check`);
    },
    onSuccess: (data) => {
      toast({
        title: data.allHealthy ? "✓ All health checks passed" : "⚠ Health check failed",
        description: `Healthy: ${data.healthyCount}/${data.totalChecks}`,
        variant: data.allHealthy ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["ca-deployments"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to execute health check",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<CreateDeploymentForm>({
    resolver: zodResolver(createDeploymentSchema),
    defaultValues: {
      aiSystemId: "",
      version: "",
      strategy: "blue_green",
      healthCheckEndpoint: "/health",
      canaryPercentage: 10,
    },
  });

  const onCreateSubmit = (data: CreateDeploymentForm) => {
    createDeploymentMutation.mutate(data);
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "healthy":
        return "default";
      case "in_progress":
        return "secondary";
      case "degraded":
      case "failed":
      case "rolled_back":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Deployment Management (Clean Architecture)</CardTitle>
            <CardDescription>
              Create deployments, advance canary releases, and execute rollbacks
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="degraded">Degraded</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="rolled_back">Rolled Back</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Rocket className="w-4 h-4 mr-2" />
                  Create Deployment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Deployment</DialogTitle>
                  <DialogDescription>
                    Deploy a new AI system version with specified strategy
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
                      name="version"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Version</FormLabel>
                          <FormControl>
                            <Input placeholder="v1.0.0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="strategy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deployment Strategy</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="rolling">Rolling - Update gradually</SelectItem>
                              <SelectItem value="blue_green">Blue/Green - Zero downtime</SelectItem>
                              <SelectItem value="canary">Canary - Progressive traffic</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="healthCheckEndpoint"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Health Check Endpoint</FormLabel>
                          <FormControl>
                            <Input placeholder="/health" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {form.watch("strategy") === "canary" && (
                      <FormField
                        control={form.control}
                        name="canaryPercentage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Initial Canary %</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={10}
                                max={100}
                                step={10}
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createDeploymentMutation.isPending}>
                        {createDeploymentMutation.isPending ? "Creating..." : "Create Deployment"}
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
          <p className="text-muted-foreground">Loading deployments...</p>
        ) : deployments.length === 0 ? (
          <p className="text-muted-foreground">No deployments found</p>
        ) : (
          <div className="space-y-3">
            {deployments.map((deployment) => (
              <div
                key={deployment.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium">
                      {deployment.aiSystemId} - {deployment.version}
                    </p>
                    <Badge variant={getStatusBadgeVariant(deployment.status)}>
                      {deployment.status}
                    </Badge>
                    <Badge variant="outline">{deployment.strategy}</Badge>
                    {deployment.canaryPercentage !== undefined && (
                      <Badge variant="secondary">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {deployment.canaryPercentage}%
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                    {deployment.errorRate !== undefined && (
                      <span>Error Rate: {(deployment.errorRate * 100).toFixed(2)}%</span>
                    )}
                    {deployment.consecutiveHealthCheckFailures !== undefined && (
                      <span>Failed Checks: {deployment.consecutiveHealthCheckFailures}</span>
                    )}
                    {deployment.deployedAt && (
                      <span>Deployed: {new Date(deployment.deployedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {deployment.strategy === "canary" && deployment.status === "in_progress" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => advanceCanaryMutation.mutate(deployment.id)}
                      disabled={advanceCanaryMutation.isPending}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Advance +10%
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => healthCheckMutation.mutate(deployment.id)}
                    disabled={healthCheckMutation.isPending}
                  >
                    <Heart className="w-4 h-4 mr-1" />
                    Health Check
                  </Button>
                  {deployment.status !== "rolled_back" && deployment.status !== "failed" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        rollbackMutation.mutate({
                          deploymentId: deployment.id,
                          reason: "Manual rollback from UI",
                        })
                      }
                      disabled={rollbackMutation.isPending}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Rollback
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
