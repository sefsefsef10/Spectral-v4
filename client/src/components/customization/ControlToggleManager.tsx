/**
 * ⚙️ CONTROL TOGGLE MANAGER
 * 
 * Growth tier: Enable/disable compliance controls
 * HIPAA controls cannot be disabled (regulatory guardrail)
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Settings, Info, Shield, AlertTriangle } from "lucide-react";

interface ControlToggleManagerProps {
  customizations: {
    controlToggles: any[];
  };
  onSuccess: () => void;
}

// Mock compliance controls - in production, fetch from /api/compliance-controls
const AVAILABLE_CONTROLS = [
  { id: "HIPAA-164.308", name: "Security Management Process", framework: "HIPAA", canDisable: false },
  { id: "HIPAA-164.312", name: "Technical Safeguards", framework: "HIPAA", canDisable: false },
  { id: "NIST-AI-RMF-1.1", name: "AI Risk Identification", framework: "NIST AI RMF", canDisable: true },
  { id: "NIST-AI-RMF-2.3", name: "Bias Testing", framework: "NIST AI RMF", canDisable: true },
  { id: "FDA-SAMD-3.1", name: "Clinical Validation", framework: "FDA SaMD", canDisable: true },
  { id: "ISO-27001-5.1", name: "Information Security Policy", framework: "ISO 27001", canDisable: true },
  { id: "ISO-42001-7.2", name: "AI System Lifecycle", framework: "ISO 42001", canDisable: true },
];

export function ControlToggleManager({ customizations, onSuccess }: ControlToggleManagerProps) {
  const { toast } = useToast();
  const [selectedControl, setSelectedControl] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toggleAction, setToggleAction] = useState<"enable" | "disable">("disable");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isControlToggled = (controlId: string) => {
    return customizations.controlToggles.find(t => t.controlId === controlId);
  };

  const isControlEnabled = (controlId: string) => {
    const toggle = isControlToggled(controlId);
    return toggle ? toggle.enabled : true; // Default to enabled
  };

  const handleToggleClick = (control: any, newState: boolean) => {
    if (!control.canDisable && !newState) {
      toast({
        title: "Cannot disable HIPAA control",
        description: "HIPAA controls cannot be disabled due to regulatory requirements",
        variant: "destructive",
      });
      return;
    }

    setSelectedControl(control);
    setToggleAction(newState ? "enable" : "disable");
    setReason("");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedControl) return;

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/customization/toggle-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          controlId: selectedControl.id,
          enabled: toggleAction === "enable",
          reason: reason || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to toggle control");
      }

      toast({
        title: `Control ${toggleAction}d`,
        description: `${selectedControl.name} has been ${toggleAction}d`,
      });

      setDialogOpen(false);
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to toggle control",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Control Toggle Management</CardTitle>
          </div>
          <CardDescription>
            Enable or disable compliance controls for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Growth Tier Feature:</strong> Customize which compliance controls are active.
              HIPAA controls cannot be disabled to maintain regulatory compliance.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            {AVAILABLE_CONTROLS.map((control) => {
              const isEnabled = isControlEnabled(control.id);
              const toggle = isControlToggled(control.id);

              return (
                <div
                  key={control.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="font-medium">{control.name}</h4>
                      <Badge variant="outline">{control.framework}</Badge>
                      {!control.canDisable && (
                        <Badge variant="destructive" className="gap-1">
                          <Shield className="h-3 w-3" />
                          Protected
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{control.id}</p>
                    {toggle?.disableReason && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                        Reason: {toggle.disableReason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Label
                      htmlFor={`toggle-${control.id}`}
                      className={isEnabled ? "text-green-600" : "text-muted-foreground"}
                    >
                      {isEnabled ? "Enabled" : "Disabled"}
                    </Label>
                    <Switch
                      id={`toggle-${control.id}`}
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleToggleClick(control, checked)}
                      disabled={!control.canDisable && !isEnabled}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toggleAction === "enable" ? "Enable" : "Disable"} Control
            </DialogTitle>
            <DialogDescription>
              {toggleAction === "enable" 
                ? `Re-enable ${selectedControl?.name}?`
                : `Are you sure you want to disable ${selectedControl?.name}? This may affect compliance detection.`
              }
            </DialogDescription>
          </DialogHeader>

          {toggleAction === "disable" && (
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900 dark:text-amber-100">
                Disabling compliance controls may reduce your organization's protection against AI risks.
                This action will be logged in the audit trail.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="toggle-reason">
              Reason {toggleAction === "disable" ? "(Required)" : "(Optional)"}
            </Label>
            <Textarea
              id="toggle-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you are toggling this control..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This will be recorded in the audit trail for compliance documentation
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || (toggleAction === "disable" && !reason.trim())}
            >
              {isSubmitting ? "Saving..." : `${toggleAction === "enable" ? "Enable" : "Disable"} Control`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
