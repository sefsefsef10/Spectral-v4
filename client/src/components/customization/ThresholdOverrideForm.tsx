/**
 * 🎯 THRESHOLD OVERRIDE FORM
 * 
 * Growth tier: Tune compliance detection thresholds
 * Example: Adjust PHI detection confidence from 85% to 90%
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
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Info } from "lucide-react";

const thresholdSchema = z.object({
  eventType: z.string().min(1, "Event type is required"),
  customThreshold: z.string().min(1, "Threshold value is required"),
  thresholdUnit: z.string().optional(),
  overrideReason: z.string().min(10, "Please provide a detailed reason (min 10 characters)"),
  aiSystemId: z.string().optional(),
});

type ThresholdFormData = z.infer<typeof thresholdSchema>;

interface ThresholdOverrideFormProps {
  onSuccess: () => void;
}

const COMMON_EVENT_TYPES = [
  { value: "phi_exposure", label: "PHI Exposure Detection", unit: "%" },
  { value: "bias_detection", label: "Bias Detection", unit: "%" },
  { value: "hallucination_rate", label: "Hallucination Rate", unit: "%" },
  { value: "response_time", label: "Response Time", unit: "ms" },
  { value: "error_rate", label: "Error Rate", unit: "%" },
  { value: "token_usage", label: "Token Usage", unit: "tokens" },
];

export function ThresholdOverrideForm({ onSuccess }: ThresholdOverrideFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<string>("");

  const form = useForm<ThresholdFormData>({
    resolver: zodResolver(thresholdSchema),
    defaultValues: {
      eventType: "",
      customThreshold: "",
      thresholdUnit: "",
      overrideReason: "",
      aiSystemId: "",
    },
  });

  const onSubmit = async (data: ThresholdFormData) => {
    try {
      setIsSubmitting(true);

      const response = await fetch("/api/customization/threshold-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create threshold override");
      }

      toast({
        title: "Threshold override created",
        description: "Your customization has been saved successfully",
      });

      form.reset();
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create threshold override",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEventTypeChange = (value: string) => {
    setSelectedEventType(value);
    form.setValue("eventType", value);
    
    // Auto-fill unit if it's a common event type
    const eventConfig = COMMON_EVENT_TYPES.find(e => e.value === value);
    if (eventConfig) {
      form.setValue("thresholdUnit", eventConfig.unit);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          <CardTitle>Create Threshold Override</CardTitle>
        </div>
        <CardDescription>
          Customize compliance detection thresholds to match your organization's risk tolerance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Growth Tier Feature:</strong> Fine-tune how the Translation Engine detects compliance violations.
            For example, increase PHI detection sensitivity from 85% to 90% for stricter protection.
          </AlertDescription>
        </Alert>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="eventType">Event Type *</Label>
            <Select value={selectedEventType} onValueChange={handleEventTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select event type to customize" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_EVENT_TYPES.map((event) => (
                  <SelectItem key={event.value} value={event.value}>
                    {event.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom Event Type</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.eventType && (
              <p className="text-sm text-destructive">{form.formState.errors.eventType.message}</p>
            )}
          </div>

          {selectedEventType === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="customEventType">Custom Event Type</Label>
              <Input
                id="customEventType"
                placeholder="e.g., custom_metric_name"
                {...form.register("eventType")}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customThreshold">Threshold Value *</Label>
              <Input
                id="customThreshold"
                placeholder="e.g., 90"
                {...form.register("customThreshold")}
              />
              {form.formState.errors.customThreshold && (
                <p className="text-sm text-destructive">{form.formState.errors.customThreshold.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="thresholdUnit">Unit</Label>
              <Input
                id="thresholdUnit"
                placeholder="e.g., %, ms, count"
                {...form.register("thresholdUnit")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aiSystemId">AI System (Optional)</Label>
            <Input
              id="aiSystemId"
              placeholder="Leave blank for organization-wide override"
              {...form.register("aiSystemId")}
            />
            <p className="text-xs text-muted-foreground">
              Apply this threshold to a specific AI system, or leave blank to apply organization-wide
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="overrideReason">Justification *</Label>
            <Textarea
              id="overrideReason"
              placeholder="Explain why this threshold adjustment is necessary for your organization..."
              rows={4}
              {...form.register("overrideReason")}
            />
            {form.formState.errors.overrideReason && (
              <p className="text-sm text-destructive">{form.formState.errors.overrideReason.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Required for audit trail and compliance documentation
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
              {isSubmitting ? "Creating..." : "Create Override"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
