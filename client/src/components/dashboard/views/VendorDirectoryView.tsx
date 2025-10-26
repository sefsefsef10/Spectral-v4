import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Vendor } from "@shared/schema";

export default function VendorDirectoryView() {
  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  if (isLoading) {
    return <div className="p-6">Loading vendors...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Vendor Directory</h1>
        <p className="text-muted-foreground">All AI vendors with Spectral Verified certification</p>
      </div>

      <div className="grid gap-4">
        {vendors.map((vendor, index) => (
          <Card key={index} className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-semibold" data-testid={`vendor-name-${index}`}>{vendor.name}</div>
                    {vendor.verified && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Spectral Verified
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Active vendor
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" data-testid={`button-view-vendor-${index}`}>
                  View Details
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
