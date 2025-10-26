import { Button } from "@/components/ui/button";
import SystemRow from "../SystemRow";
import { Plus, Download, Filter, Search, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { AISystem, InsertAISystem } from "@shared/schema";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AISystemForm } from "@/components/forms/AISystemForm";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

interface AIInventoryViewProps {
  onSelectSystem?: (systemName: string) => void;
}

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return "never";
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"}`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "day" : "days"}`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks} ${diffWeeks === 1 ? "week" : "weeks"}`;
}

export default function AIInventoryView({ onSelectSystem }: AIInventoryViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<AISystem | null>(null);
  const [deletingSystem, setDeletingSystem] = useState<AISystem | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: systems = [], isLoading } = useQuery<AISystem[]>({
    queryKey: ["/api/ai-systems"],
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertAISystem) => {
      await apiRequest("POST", "/api/ai-systems", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-systems"] });
      setIsCreateDialogOpen(false);
      toast({ title: "AI system created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create AI system", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertAISystem> }) => {
      await apiRequest("PATCH", `/api/ai-systems/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-systems"] });
      setEditingSystem(null);
      toast({ title: "AI system updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update AI system", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ai-systems/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-systems"] });
      setDeletingSystem(null);
      toast({ title: "AI system deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete AI system", variant: "destructive" });
    },
  });

  const filteredSystems = systems.filter(system => 
    system.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    system.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return <div className="p-6">Loading AI systems...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI Inventory</h1>
          <p className="text-muted-foreground">Complete catalog of all AI systems</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" data-testid="button-filter">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm" data-testid="button-export">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            size="sm"
            data-testid="button-add-system"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add System
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search systems by name, department, or vendor..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="input-search-systems"
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-6 gap-4 px-4 py-3 bg-muted text-sm font-medium border-b">
          <div>System Name</div>
          <div>Department</div>
          <div>Risk</div>
          <div>Status</div>
          <div>Last Check</div>
          <div className="text-right">Actions</div>
        </div>
        {filteredSystems.map((system) => (
          <div
            key={system.id}
            className="grid grid-cols-6 gap-4 px-4 py-3 border-b last:border-0 hover-elevate"
          >
            <div className="font-medium">{system.name}</div>
            <div className="text-muted-foreground">{system.department}</div>
            <div>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                system.riskLevel === "Critical" ? "bg-destructive/10 text-destructive" :
                system.riskLevel === "High" ? "bg-orange-500/10 text-orange-600" :
                system.riskLevel === "Medium" ? "bg-yellow-500/10 text-yellow-600" :
                "bg-green-500/10 text-green-600"
              }`}>
                {system.riskLevel}
              </span>
            </div>
            <div>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                system.status === "Compliant" ? "bg-green-500/10 text-green-600" :
                system.status === "Drift" ? "bg-yellow-500/10 text-yellow-600" :
                "bg-destructive/10 text-destructive"
              }`}>
                {system.status}
              </span>
            </div>
            <div className="text-muted-foreground">{formatTimeAgo(system.lastCheck)}</div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditingSystem(system)}
                data-testid={`button-edit-${system.id}`}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeletingSystem(system)}
                data-testid={`button-delete-${system.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-system">
          <DialogHeader>
            <DialogTitle>Add AI System</DialogTitle>
            <DialogDescription>
              Add a new AI system to your portfolio for monitoring and compliance tracking.
            </DialogDescription>
          </DialogHeader>
          <AISystemForm
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setIsCreateDialogOpen(false)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {editingSystem && (
        <Dialog open={!!editingSystem} onOpenChange={() => setEditingSystem(null)}>
          <DialogContent data-testid="dialog-edit-system">
            <DialogHeader>
              <DialogTitle>Edit AI System</DialogTitle>
              <DialogDescription>
                Update the details of this AI system.
              </DialogDescription>
            </DialogHeader>
            <AISystemForm
              defaultValues={{
                ...editingSystem,
                integrationConfig: editingSystem.integrationConfig as any,
              }}
              onSubmit={(data) => updateMutation.mutate({ id: editingSystem.id, data })}
              onCancel={() => setEditingSystem(null)}
              isLoading={updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingSystem && (
        <AlertDialog open={!!deletingSystem} onOpenChange={() => setDeletingSystem(null)}>
          <AlertDialogContent data-testid="dialog-delete-system">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete AI System</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingSystem.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(deletingSystem.id)}
                data-testid="button-confirm-delete"
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
