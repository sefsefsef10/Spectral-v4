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
import { UserPlus, Mail, Shield, Clock, XCircle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

const inviteUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  permissions: z.enum(["admin", "user", "viewer"]),
});

type InviteUserForm = z.infer<typeof inviteUserSchema>;

interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  permissions: string;
  status: string;
  lastLogin?: string | null;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  permissions: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  tokenPrefix: string;
}

export default function UserManagement() {
  const { toast } = useToast();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch invitations
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<Invitation[]>({
    queryKey: ["/api/users/invitations"],
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: async (data: InviteUserForm) => {
      return await apiRequest("POST", "/api/users/invite", data);
    },
    onSuccess: () => {
      toast({ title: "Invitation sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/users/invitations"] });
      setInviteDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to send invitation", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { permissions?: string; status?: string } }) => {
      return await apiRequest("PATCH", `/api/users/${id}`, updates);
    },
    onSuccess: () => {
      toast({ title: "User updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update user", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/users/invitations/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Invitation cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/users/invitations"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to cancel invitation", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const form = useForm<InviteUserForm>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: "",
      permissions: "user",
    },
  });

  const onInviteSubmit = (data: InviteUserForm) => {
    inviteUserMutation.mutate(data);
  };

  const getPermissionBadgeVariant = (permissions: string) => {
    switch (permissions) {
      case "admin":
        return "default";
      case "user":
        return "secondary";
      case "viewer":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    return status === "active" ? "default" : "secondary";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Invite and manage users in your organization
          </p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-invite-user">
              <UserPlus className="w-4 h-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
              <DialogDescription>
                Send an invitation email to add a new user to your organization
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onInviteSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="user@example.com" 
                          {...field} 
                          data-testid="input-invite-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="permissions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permissions</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-permissions">
                            <SelectValue placeholder="Select permissions" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Admin - Full access</SelectItem>
                          <SelectItem value="user">User - Standard access</SelectItem>
                          <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setInviteDialogOpen(false)}
                    data-testid="button-cancel-invite"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={inviteUserMutation.isPending}
                    data-testid="button-send-invite"
                  >
                    {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Users */}
      <Card>
        <CardHeader>
          <CardTitle>Active Users</CardTitle>
          <CardDescription>
            {users.length} {users.length === 1 ? "user" : "users"} in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <p className="text-muted-foreground">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground">No users found</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`user-card-${user.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {user.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium" data-testid={`text-username-${user.id}`}>
                        {user.username}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {user.email}
                      </p>
                      {user.lastLogin && (
                        <p className="text-xs text-muted-foreground">
                          Last login: {formatDistanceToNow(new Date(user.lastLogin), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getPermissionBadgeVariant(user.permissions)}>
                      <Shield className="w-3 h-3 mr-1" />
                      {user.permissions}
                    </Badge>
                    <Badge variant={getStatusBadgeVariant(user.status)}>
                      {user.status}
                    </Badge>
                    <Select
                      value={user.permissions}
                      onValueChange={(value) => updateUserMutation.mutate({ id: user.id, updates: { permissions: value } })}
                    >
                      <SelectTrigger className="w-32" data-testid={`select-user-permissions-${user.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>
            {invitations.filter(inv => inv.status === 'pending').length} pending {invitations.filter(inv => inv.status === 'pending').length === 1 ? "invitation" : "invitations"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitationsLoading ? (
            <p className="text-muted-foreground">Loading invitations...</p>
          ) : invitations.filter(inv => inv.status === 'pending').length === 0 ? (
            <p className="text-muted-foreground">No pending invitations</p>
          ) : (
            <div className="space-y-3">
              {invitations.filter(inv => inv.status === 'pending').map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`invitation-card-${invitation.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-medium" data-testid={`text-invitation-email-${invitation.id}`}>
                        {invitation.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Sent {formatDistanceToNow(new Date(invitation.createdAt), { addSuffix: true })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expires {formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getPermissionBadgeVariant(invitation.permissions)}>
                      <Shield className="w-3 h-3 mr-1" />
                      {invitation.permissions}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelInvitationMutation.mutate(invitation.id)}
                      disabled={cancelInvitationMutation.isPending}
                      data-testid={`button-cancel-invitation-${invitation.id}`}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
