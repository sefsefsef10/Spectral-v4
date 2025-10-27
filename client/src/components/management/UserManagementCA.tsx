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
import { UserPlus, Shield, Trash2, RefreshCw } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

const registerUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain uppercase, lowercase, and number"
  ),
  role: z.enum(["viewer", "analyst", "admin", "executive", "super_admin"]),
  healthSystemId: z.string().min(1, "Health system ID is required"),
});

type RegisterUserForm = z.infer<typeof registerUserSchema>;

interface User {
  id: string;
  email: string;
  role: string;
  healthSystemId: string;
  isActive: boolean;
  failedLoginAttempts: number;
  accountLockedUntil?: string | null;
  passwordExpiresAt: string;
  lastLoginAt?: string | null;
  createdAt: string;
}

export default function UserManagementCA() {
  const { toast } = useToast();
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);

  const { data: users = [], isLoading, refetch } = useQuery<User[]>({
    queryKey: ["ca-users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users");
      return response;
    },
  });

  const registerUserMutation = useMutation({
    mutationFn: async (data: RegisterUserForm) => {
      return await apiRequest("POST", "/api/users/register", data);
    },
    onSuccess: () => {
      toast({ title: "✓ User registered successfully" });
      queryClient.invalidateQueries({ queryKey: ["ca-users"] });
      setRegisterDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to register user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      return await apiRequest("PUT", `/api/users/${userId}/role`, { newRole });
    },
    onSuccess: () => {
      toast({ title: "✓ User role updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["ca-users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deactivateUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      toast({ title: "✓ User deactivated successfully" });
      queryClient.invalidateQueries({ queryKey: ["ca-users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to deactivate user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<RegisterUserForm>({
    resolver: zodResolver(registerUserSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "viewer",
      healthSystemId: "",
    },
  });

  const onRegisterSubmit = (data: RegisterUserForm) => {
    registerUserMutation.mutate(data);
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    if (role === "super_admin" || role === "admin") return "default";
    if (role === "executive") return "secondary";
    return "outline";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>User Management (Clean Architecture)</CardTitle>
            <CardDescription>
              Register users, update roles, and manage account status
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Register User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register New User</DialogTitle>
                  <DialogDescription>
                    Create a new user account with specified role and health system
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input placeholder="user@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                              <SelectItem value="analyst">Analyst - Can analyze data</SelectItem>
                              <SelectItem value="admin">Admin - Full management</SelectItem>
                              <SelectItem value="executive">Executive - Strategic view</SelectItem>
                              <SelectItem value="super_admin">Super Admin - All health systems</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="healthSystemId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Health System ID</FormLabel>
                          <FormControl>
                            <Input placeholder="hs-12345" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setRegisterDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={registerUserMutation.isPending}>
                        {registerUserMutation.isPending ? "Registering..." : "Register User"}
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
          <p className="text-muted-foreground">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="text-muted-foreground">No users found</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium">{user.email}</p>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      <Shield className="w-3 h-3 mr-1" />
                      {user.role}
                    </Badge>
                    {!user.isActive && <Badge variant="destructive">Deactivated</Badge>}
                    {user.accountLockedUntil && new Date(user.accountLockedUntil) > new Date() && (
                      <Badge variant="destructive">Locked</Badge>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                    <span>Health System: {user.healthSystemId}</span>
                    <span>Failed Logins: {user.failedLoginAttempts}</span>
                    {user.lastLoginAt && (
                      <span>Last Login: {new Date(user.lastLoginAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={user.role}
                    onValueChange={(newRole) =>
                      updateRoleMutation.mutate({ userId: user.id, newRole })
                    }
                    disabled={!user.isActive}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="analyst">Analyst</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="executive">Executive</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  {user.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deactivateUserMutation.mutate(user.id)}
                      disabled={deactivateUserMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
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
