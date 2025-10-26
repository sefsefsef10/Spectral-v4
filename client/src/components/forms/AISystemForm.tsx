import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAISystemSchema, type InsertAISystem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type AISystemFormProps = {
  onSubmit: (data: InsertAISystem) => void;
  onCancel: () => void;
  defaultValues?: Partial<InsertAISystem>;
  isLoading?: boolean;
  healthSystemId?: string;
};

const DEPARTMENTS = [
  "Emergency",
  "Radiology",
  "Cardiology",
  "Clinical",
  "Pathology",
  "Operations",
  "IT",
  "Administration",
];

const RISK_LEVELS = ["Low", "Medium", "High", "Critical"];
const STATUSES = ["Compliant", "Drift", "At Risk", "Failed"];

export function AISystemForm({ onSubmit, onCancel, defaultValues, isLoading, healthSystemId }: AISystemFormProps) {
  const form = useForm<InsertAISystem>({
    resolver: zodResolver(insertAISystemSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      department: defaultValues?.department || "Clinical",
      riskLevel: defaultValues?.riskLevel || "Medium",
      status: defaultValues?.status || "Compliant",
      // Send empty string for healthSystemId - backend will override with session value
      healthSystemId: defaultValues?.healthSystemId || healthSystemId || "",
      vendorId: defaultValues?.vendorId || null,
      // Don't send lastCheck if not provided - backend will handle it
      lastCheck: defaultValues?.lastCheck || null,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>AI System Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="e.g., Epic Ambient AI"
                  data-testid="input-system-name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="department"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Department</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                data-testid="select-department"
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="riskLevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Risk Level</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                data-testid="select-risk-level"
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select risk level" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {RISK_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Compliance Status</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                data-testid="select-status"
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 justify-end pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            data-testid="button-submit"
          >
            {isLoading ? "Saving..." : defaultValues ? "Update System" : "Create System"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
