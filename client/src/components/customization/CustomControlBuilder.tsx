/**
 * 🏗️ CUSTOM CONTROL BUILDER
 * 
 * Enterprise tier: Create organization-specific compliance policies
 * Requires Spectral admin approval before activation
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, Info, AlertTriangle } from "lucide-react";

const customControlSchema = z.object({
  controlName: z.string().min(3, "Control name must be at least 3 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  severity: z.enum(["critical", "high", "medium", "low"]),
  mappedEventTypes: z.string().min(1, "At least one event type is required"),
  requiresReporting: z.boolean().default(false),
  reportingDeadlineDays: z.number().optional(),
  detectionLogic: z.string().optional(),
  remediationSteps: z.string().optional(),
});

type CustomControlFormData = z.infer<typeof customControlSchema>;

interface CustomControlBuilderProps {
  onSuccess: () => void;
}

export function CustomControlBuilder({ onSuccess }: CustomControlBuilderProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requiresReporting, setRequiresReporting] = useState(false);

  const form = useForm<CustomControlFormData>({
    resolver: zodResolver(customControlSchema),
    defaultValues: {
      controlName: "",
      description: "",
      severity: "medium",
      mappedEventTypes: "",
      requiresReporting: false,
      detectionLogic: "",
      remediationSteps: "",
    },
  });

  const onSubmit = async (data: CustomControlFormData) => {
    try {
      setIsSubmitting(true);

      // Parse mapped event types and remediation steps
      const payload = {
        ...data,
        mappedEventTypes: data.mappedEventTypes.split(",").map(s => s.trim()),
        remediationSteps: data.remediationSteps 
          ? data.remediationSteps.split("\n").filter(s => s.trim())
          : undefined,
      };

      const response = await fetch("/api/customization/custom-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create custom control");
      }

      toast({
        title: "Custom control submitted for approval",
        description: "Your custom policy has been submitted to Spectral for review",
      });

      form.reset();
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create custom control",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <CardTitle>Create Custom Compliance Control</CardTitle>
        </div>
        <CardDescription>
          Extend the Translation Engine with organization-specific policies
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Enterprise Tier Feature:</strong> Create custom compliance controls that are unique to your organization.
            All custom controls require Spectral admin approval before activation.
          </AlertDescription>
        </Alert>

        <Alert className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900 dark:text-amber-100">
            Custom controls undergo a review process to ensure they don't conflict with regulatory requirements (HIPAA, FDA, NIST).
            Approval typically takes 1-3 business days.
          </AlertDescription>
        </Alert>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="controlName">Control Name *</Label>
            <Input
              id="controlName"
              placeholder="e.g., Internal Clinical Review Requirement"
              {...form.register("controlName")}
            />
            {form.formState.errors.controlName && (
              <p className="text-sm text-destructive">{form.formState.errors.controlName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Detailed explanation of this compliance requirement and why it's needed..."
              rows={4}
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="severity">Severity Level *</Label>
              <Select 
                value={form.watch("severity")} 
                onValueChange={(value) => form.setValue("severity", value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">
                    <Badge variant="destructive">Critical</Badge>
                  </SelectItem>
                  <SelectItem value="high">
                    <Badge className="bg-orange-500">High</Badge>
                  </SelectItem>
                  <SelectItem value="medium">
                    <Badge className="bg-yellow-500">Medium</Badge>
                  </SelectItem>
                  <SelectItem value="low">
                    <Badge variant="secondary">Low</Badge>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reportingDeadlineDays">Reporting Deadline (Days)</Label>
              <Input
                id="reportingDeadlineDays"
                type="number"
                placeholder="e.g., 30"
                {...form.register("reportingDeadlineDays", { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">
                If violation requires reporting, deadline in days
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mappedEventTypes">Mapped Event Types *</Label>
            <Input
              id="mappedEventTypes"
              placeholder="e.g., clinical_decision, diagnosis_suggestion, treatment_recommendation"
              {...form.register("mappedEventTypes")}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list of AI telemetry event types this control applies to
            </p>
            {form.formState.errors.mappedEventTypes && (
              <p className="text-sm text-destructive">{form.formState.errors.mappedEventTypes.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="detectionLogic">Detection Logic (Optional)</Label>
            <Textarea
              id="detectionLogic"
              placeholder="Describe how violations of this control should be detected..."
              rows={3}
              {...form.register("detectionLogic")}
            />
            <p className="text-xs text-muted-foreground">
              Explain the criteria for detecting violations (helps Spectral configure automated detection)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="remediationSteps">Remediation Steps (Optional)</Label>
            <Textarea
              id="remediationSteps"
              placeholder="Step 1: Contact clinical team&#10;Step 2: Review decision with supervisor&#10;Step 3: Document outcome"
              rows={4}
              {...form.register("remediationSteps")}
            />
            <p className="text-xs text-muted-foreground">
              One step per line - shown to users when violations occur
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              disabled={isSubmitting}
            >
              Clear
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit for Approval"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
