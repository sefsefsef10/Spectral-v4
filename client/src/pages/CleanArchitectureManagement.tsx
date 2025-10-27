import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Bell, Rocket } from "lucide-react";
import UserManagementCA from "@/components/management/UserManagementCA";
import AlertManagementCA from "@/components/management/AlertManagementCA";
import DeploymentManagementCA from "@/components/management/DeploymentManagementCA";

export default function CleanArchitectureManagement() {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Platform Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage users, alerts, and deployments using Clean Architecture APIs
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Alert Management
          </TabsTrigger>
          <TabsTrigger value="deployments" className="flex items-center gap-2">
            <Rocket className="w-4 h-4" />
            Deployment Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <UserManagementCA />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <AlertManagementCA />
        </TabsContent>

        <TabsContent value="deployments" className="space-y-4">
          <DeploymentManagementCA />
        </TabsContent>
      </Tabs>
    </div>
  );
}
