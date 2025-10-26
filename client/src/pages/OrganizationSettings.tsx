import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Building2, Save } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

const organizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  description: z.string().optional(),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

interface Organization {
  id: string;
  name: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  settings?: string;
  type: 'health-system' | 'vendor';
}

export default function OrganizationSettings() {
  const { toast } = useToast();
  
  const { data: organization, isLoading } = useQuery<Organization>({
    queryKey: ["/api/organization"],
  });

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    values: {
      name: organization?.name || "",
      description: organization?.description || "",
      website: organization?.website || "",
      logoUrl: organization?.logoUrl || "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: OrganizationFormData) => {
      return apiRequest("PATCH", "/api/organization", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization"] });
      toast({
        title: "Settings saved",
        description: "Your organization settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update organization settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: OrganizationFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <p className="text-center text-muted-foreground">Loading organization settings...</p>
      </div>
    );
  }

  const isVendor = organization?.type === 'vendor';

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold mb-2" data-testid="text-org-settings-title">Organization Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization profile and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization Profile
          </CardTitle>
          <CardDescription>
            Update your organization details and branding
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Enter organization name"
                        data-testid="input-org-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Brief description of your organization"
                        rows={3}
                        data-testid="input-org-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isVendor && (
                <>
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="url"
                            placeholder="https://example.com"
                            data-testid="input-org-website"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="logoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Logo URL</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="url"
                            placeholder="https://example.com/logo.png"
                            data-testid="input-org-logo"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <div className="flex justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => form.reset()}
                  data-testid="button-reset"
                >
                  Reset
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  data-testid="button-save"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
