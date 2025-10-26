import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Link2, RefreshCw, Trash2, Plus, CheckCircle, XCircle, Clock, Settings, AlertCircle } from "lucide-react";

interface ProviderConnection {
  id: string;
  healthSystemId: string;
  providerType: string;
  baseUrl: string;
  status: string;
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface ConnectionFormData {
  providerType: string;
  baseUrl: string;
  credentials: {
    clientId: string;
    clientSecret: string;
  };
  syncEnabled: boolean;
  syncIntervalMinutes: number;
}

export default function ProviderConnectionsView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ProviderConnection | null>(null);
  const [formData, setFormData] = useState<ConnectionFormData>({
    providerType: "epic",
    baseUrl: "",
    credentials: {
      clientId: "",
      clientSecret: "",
    },
    syncEnabled: true,
    syncIntervalMinutes: 1440,
  });

  const { data: connections = [], isLoading } = useQuery<ProviderConnection[]>({
    queryKey: ["/api/provider-connections"],
  });

  const createConnection = useMutation({
    mutationFn: async (data: ConnectionFormData) => {
      const response = await fetch("/api/provider-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create connection");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-connections"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Connection created",
        description: "EHR connection created successfully. Test the connection to activate it.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testConnection = useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await fetch(`/api/provider-connections/${connectionId}/test`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Connection test failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-connections"] });
      toast({
        title: "Connection successful",
        description: "EHR connection is active and ready for syncing.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncNow = useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await fetch(`/api/provider-connections/${connectionId}/sync`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync failed");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sync initiated",
        description: "AI inventory sync has started. This may take a few minutes.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateConnection = useMutation({
    mutationFn: async ({ connectionId, updates }: { connectionId: string; updates: Partial<ProviderConnection> }) => {
      const response = await fetch(`/api/provider-connections/${connectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update connection");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-connections"] });
      setIsEditDialogOpen(false);
      setEditingConnection(null);
      toast({
        title: "Connection updated",
        description: "EHR connection settings have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await fetch(`/api/provider-connections/${connectionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete connection");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-connections"] });
      toast({
        title: "Connection deleted",
        description: "EHR connection has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openEditDialog = (connection: ProviderConnection) => {
    setEditingConnection(connection);
    setIsEditDialogOpen(true);
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConnection) return;
    updateConnection.mutate({
      connectionId: editingConnection.id,
      updates: {
        syncEnabled: editingConnection.syncEnabled,
        syncIntervalMinutes: editingConnection.syncIntervalMinutes,
      },
    });
  };

  const resetForm = () => {
    setFormData({
      providerType: "epic",
      baseUrl: "",
      credentials: {
        clientId: "",
        clientSecret: "",
      },
      syncEnabled: true,
      syncIntervalMinutes: 1440,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createConnection.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case "inactive":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Inactive</Badge>;
      case "error":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatLastSync = (lastSyncedAt: string | null) => {
    if (!lastSyncedAt) return "Never";
    const date = new Date(lastSyncedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return `${Math.floor(diffMins / 1440)} days ago`;
  };

  if (isLoading) {
    return <div className="p-6">Loading EHR connections...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">EHR Integrations</h1>
          <p className="text-muted-foreground mt-2">
            Connect your EHR systems to automatically discover and monitor AI tools
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-connection">
          <Plus className="w-4 h-4 mr-2" />
          Add Connection
        </Button>
      </div>

      {connections.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <Link2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No EHR connections yet</h3>
            <p className="text-muted-foreground mb-6">
              Connect your Epic, Cerner, or Athenahealth systems to automatically sync AI inventory
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Connection
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {connections.map((connection) => (
            <Card key={connection.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold capitalize">{connection.providerType}</h3>
                    {getStatusBadge(connection.status)}
                    {connection.syncEnabled && (
                      <Badge variant="outline">Auto-sync enabled</Badge>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Base URL: {connection.baseUrl}</p>
                    <p>Sync Interval: Every {connection.syncIntervalMinutes / 60} hours</p>
                    <p>Last Sync: {formatLastSync(connection.lastSyncedAt)}</p>
                  </div>
                  {connection.lastError && connection.status === "error" && (
                    <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-destructive">{connection.lastError}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {(connection.status === "inactive" || connection.status === "error") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConnection.mutate(connection.id)}
                      disabled={testConnection.isPending}
                    >
                      {connection.status === "error" ? "Retry" : "Test Connection"}
                    </Button>
                  )}
                  {connection.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncNow.mutate(connection.id)}
                      disabled={syncNow.isPending}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync Now
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(connection)}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this connection?")) {
                        deleteConnection.mutate(connection.id);
                      }
                    }}
                    disabled={deleteConnection.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add EHR Connection</DialogTitle>
              <DialogDescription>
                Connect your EHR system to automatically discover AI tools and monitor their usage
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="providerType">EHR System</Label>
                <Select
                  value={formData.providerType}
                  onValueChange={(value) => setFormData({ ...formData, providerType: value })}
                >
                  <SelectTrigger id="providerType">
                    <SelectValue placeholder="Select EHR system" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="epic">Epic</SelectItem>
                    <SelectItem value="cerner">Cerner</SelectItem>
                    <SelectItem value="athenahealth">Athenahealth</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseUrl">FHIR Base URL</Label>
                <Input
                  id="baseUrl"
                  placeholder="https://fhir.epic.com/interconnect-fhir-oauth"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  placeholder="Your EHR app client ID"
                  value={formData.credentials.clientId}
                  onChange={(e) => setFormData({
                    ...formData,
                    credentials: { ...formData.credentials, clientId: e.target.value }
                  })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientSecret">Client Secret</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  placeholder="Your EHR app client secret"
                  value={formData.credentials.clientSecret}
                  onChange={(e) => setFormData({
                    ...formData,
                    credentials: { ...formData.credentials, clientSecret: e.target.value }
                  })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Credentials are encrypted and never exposed in API responses
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="syncInterval">Sync Interval (hours)</Label>
                <Select
                  value={formData.syncIntervalMinutes.toString()}
                  onValueChange={(value) => setFormData({ ...formData, syncIntervalMinutes: parseInt(value) })}
                >
                  <SelectTrigger id="syncInterval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="360">6 hours</SelectItem>
                    <SelectItem value="720">12 hours</SelectItem>
                    <SelectItem value="1440">24 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="syncEnabled"
                  checked={formData.syncEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, syncEnabled: checked })}
                />
                <Label htmlFor="syncEnabled" className="text-sm font-normal">
                  Enable automatic syncing
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createConnection.isPending}>
                {createConnection.isPending ? "Creating..." : "Create Connection"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleUpdateSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Connection Settings</DialogTitle>
              <DialogDescription>
                Update sync interval and auto-sync settings for this EHR connection
              </DialogDescription>
            </DialogHeader>

            {editingConnection && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>EHR System</Label>
                  <p className="text-sm text-muted-foreground capitalize">{editingConnection.providerType}</p>
                </div>

                <div className="space-y-2">
                  <Label>Base URL</Label>
                  <p className="text-sm text-muted-foreground">{editingConnection.baseUrl}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-syncInterval">Sync Interval (hours)</Label>
                  <Select
                    value={editingConnection.syncIntervalMinutes.toString()}
                    onValueChange={(value) => setEditingConnection({
                      ...editingConnection,
                      syncIntervalMinutes: parseInt(value)
                    })}
                  >
                    <SelectTrigger id="edit-syncInterval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="360">6 hours</SelectItem>
                      <SelectItem value="720">12 hours</SelectItem>
                      <SelectItem value="1440">24 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-syncEnabled"
                    checked={editingConnection.syncEnabled}
                    onCheckedChange={(checked) => setEditingConnection({
                      ...editingConnection,
                      syncEnabled: checked
                    })}
                  />
                  <Label htmlFor="edit-syncEnabled" className="text-sm font-normal">
                    Enable automatic syncing
                  </Label>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsEditDialogOpen(false);
                setEditingConnection(null);
              }}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateConnection.isPending}>
                {updateConnection.isPending ? "Updating..." : "Update Connection"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
