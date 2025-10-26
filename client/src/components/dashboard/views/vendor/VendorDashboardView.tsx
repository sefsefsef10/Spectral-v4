import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Award, TrendingUp, Building2, FileCheck, AlertCircle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Vendor } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";

interface VendorAnalytics {
  certificationApplications: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    underReview: number;
  };
  aiSystems: {
    total: number;
    verified: number;
    averageComplianceRate: number;
    byRiskLevel: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
  };
  deployments: {
    total: number;
    uniqueHealthSystems: number;
    active: number;
  };
  topSystems: Array<{
    id: string;
    name: string;
    complianceRate: number;
    status: string;
    riskLevel: string;
  }>;
}

export default function VendorDashboardView() {
  const { user } = useAuth();

  const vendorId = user?.vendorId || "";

  const { data: vendor } = useQuery<Vendor>({
    queryKey: [`/api/vendors/${vendorId}`],
    enabled: !!vendorId,
  });

  const { data: analytics } = useQuery<VendorAnalytics>({
    queryKey: [`/api/vendors/${vendorId}/analytics`],
    enabled: !!vendorId,
  });

  if (!vendor || !analytics) {
    return <div className="p-6">Loading vendor data...</div>;
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Vendor Dashboard</h1>
          <p className="text-muted-foreground">{vendor.name}</p>
        </div>
        {vendor.verified && (
          <Badge variant="secondary" className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Spectral Verified
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="text-3xl font-bold" data-testid="metric-health-systems">{analytics.deployments.uniqueHealthSystems}</div>
          </div>
          <div className="text-sm text-muted-foreground">Health Systems Using Your AI</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold" data-testid="metric-deployments">{analytics.deployments.active}</div>
          </div>
          <div className="text-sm text-muted-foreground">Active Deployments</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold" data-testid="metric-compliance">{analytics.aiSystems.averageComplianceRate}%</div>
          </div>
          <div className="text-sm text-muted-foreground">Average Compliance Score</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-3xl font-bold" data-testid="metric-certifications">{analytics.certificationApplications.approved}</div>
          </div>
          <div className="text-sm text-muted-foreground">Approved Certifications</div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Certification Applications</h2>
            <Link href="/dashboard?view=certification" data-testid="link-apply-certification">
              <Button size="sm" variant="outline">Apply for Certification</Button>
            </Link>
          </div>
          {analytics.certificationApplications.total === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No certification applications yet
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium">Approved</span>
                </div>
                <Badge variant="default" data-testid="badge-approved-count">{analytics.certificationApplications.approved}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-medium">Pending</span>
                </div>
                <Badge variant="secondary" data-testid="badge-pending-count">{analytics.certificationApplications.pending}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <span className="text-sm font-medium">Under Review</span>
                </div>
                <Badge variant="outline" data-testid="badge-review-count">{analytics.certificationApplications.underReview}</Badge>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Top AI Systems by Compliance</h2>
          {analytics.topSystems.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No AI systems deployed yet
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.topSystems.map((system) => (
                <div key={system.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{system.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {system.riskLevel.charAt(0).toUpperCase() + system.riskLevel.slice(1)} Risk
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={system.complianceRate >= 80 ? 'default' : system.complianceRate >= 60 ? 'secondary' : 'outline'}>
                      {system.complianceRate}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6 bg-primary/5 border-primary">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold mb-2">Fast-Track More Deals</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Share your Trust Page with prospects to skip 6-month security reviews
            </p>
            <Link href="/dashboard?view=trust-page">
              <Button data-testid="button-view-trust-page">View Trust Page</Button>
            </Link>
          </div>
          <Award className="w-16 h-16 text-primary/20" />
        </div>
      </Card>
    </div>
  );
}
