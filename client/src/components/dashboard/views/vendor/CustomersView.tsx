import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Vendor, Deployment, HealthSystem } from "@shared/schema";
import { useAuth } from "@/lib/auth";

export default function CustomersView() {
  const { user } = useAuth();

  const vendorId = user?.vendorId || "";

  const { data: vendor } = useQuery<Vendor>({
    queryKey: [`/api/vendors/${vendorId}`],
    enabled: !!vendorId,
  });

  const { data: deployments = [] } = useQuery<Deployment[]>({
    queryKey: ["/api/deployments"],
    enabled: !!user,
  });

  if (!vendor) {
    return <div className="p-6">Loading customer data...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Customer Deployments</h1>
        <p className="text-muted-foreground">Health systems using your AI platform</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-5 h-5 text-primary" />
            <div className="text-3xl font-bold">{deployments.length}</div>
          </div>
          <div className="text-sm text-muted-foreground">Active Health Systems</div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <div className="text-3xl font-bold">{deployments.length}</div>
          </div>
          <div className="text-sm text-muted-foreground">Total Deployments</div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <div className="text-3xl font-bold">{deployments.length}</div>
          </div>
          <div className="text-sm text-muted-foreground">Active Deployments</div>
        </Card>
      </div>

      {deployments.length === 0 ? (
        <Card className="p-6">
          <div className="text-sm text-muted-foreground text-center py-8">
            No customer deployments yet
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {deployments.map((deployment, index) => (
            <Card key={deployment.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold" data-testid={`customer-name-${index}`}>
                      Health System
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Active since {new Date(deployment.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                <Badge variant="secondary">{deployment.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
