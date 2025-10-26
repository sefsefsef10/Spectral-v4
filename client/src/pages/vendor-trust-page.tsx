import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle2, AlertCircle, ExternalLink, Award, Building2, FileCheck } from "lucide-react";

type TrustPageData = {
  vendor: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    certificationTier: string | null;
    verified: boolean;
    logoUrl: string | null;
    website: string | null;
  };
  certifications: Array<{
    tier?: string;
    type: string;
    status: string;
    verifiedDate: string | null;
    automatedScore?: number | null;
  }>;
  aiSystems: Array<{
    id: string;
    name: string;
    department: string;
    riskLevel: string;
    status: string;
    complianceRate: number;
    totalControls: number;
    compliantControls: number;
  }>;
  statistics: {
    totalSystems: number;
    verifiedSystems: number;
    averageComplianceRate: number;
    certificationsCount: number;
  };
};

export default function VendorTrustPage() {
  const params = useParams<{ vendorId: string }>();
  const vendorId = params.vendorId;

  const { data, isLoading, error } = useQuery<TrustPageData>({
    queryKey: ['/api/public/vendors', vendorId, 'trust-page'],
    enabled: !!vendorId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center" data-testid="loading-trust-page">
          <Shield className="w-16 h-16 mx-auto mb-4 animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading trust page...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Trust Page Not Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This vendor trust page could not be found or is not publicly available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { vendor, certifications, aiSystems, statistics } = data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12" data-testid="trust-page-header">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="w-12 h-12 text-primary" />
            {vendor.verified && (
              <Badge variant="default" className="text-base px-4 py-1" data-testid="badge-verified">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Spectral Verified
              </Badge>
            )}
          </div>
          <h1 className="text-4xl font-bold mb-2" data-testid="text-vendor-name">
            {vendor.name}
          </h1>
          <p className="text-xl text-muted-foreground">
            {vendor.description || "Healthcare AI Provider"}
          </p>
          {vendor.website && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              asChild
              data-testid="button-visit-website"
            >
              <a href={vendor.website} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Visit Website
              </a>
            </Button>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card data-testid="card-stat-systems">
            <CardHeader className="pb-2">
              <CardDescription>AI Systems</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-total-systems">
                {statistics.totalSystems}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-verified">
            <CardHeader className="pb-2">
              <CardDescription>Verified Systems</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary" data-testid="text-verified-systems">
                {statistics.verifiedSystems}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-certifications">
            <CardHeader className="pb-2">
              <CardDescription>Certifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary" data-testid="text-certifications-count">
                {statistics.certificationsCount}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-compliance">
            <CardHeader className="pb-2">
              <CardDescription>Avg Compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-avg-compliance">
                {statistics.averageComplianceRate}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Certifications */}
        <Card className="mb-8" data-testid="card-certifications">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Compliance Certifications
            </CardTitle>
            <CardDescription>
              Verified compliance with healthcare regulatory frameworks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {certifications.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No certifications yet
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {certifications.map((cert, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    data-testid={`cert-${idx}`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileCheck className="w-5 h-5 text-primary" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-medium">{cert.type}</div>
                          {cert.tier && (
                            <Badge variant="outline" className="text-xs">
                              {cert.tier}
                            </Badge>
                          )}
                        </div>
                        {cert.verifiedDate && (
                          <div className="text-sm text-muted-foreground">
                            Verified {new Date(cert.verifiedDate).toLocaleDateString()}
                          </div>
                        )}
                        {(cert.automatedScore !== undefined && cert.automatedScore !== null) && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Compliance Score: {cert.automatedScore}/100
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant={cert.status === 'verified' ? 'default' : 'secondary'}>
                      {cert.status === 'verified' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {cert.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Systems */}
        <Card data-testid="card-ai-systems">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Deployed AI Systems
            </CardTitle>
            <CardDescription>
              AI systems currently deployed in healthcare organizations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {aiSystems.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No deployed systems yet
              </p>
            ) : (
              <div className="space-y-4">
                {aiSystems.map((system) => (
                  <div
                    key={system.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    data-testid={`system-${system.id}`}
                  >
                    <div className="flex-1">
                      <div className="font-medium mb-1">{system.name}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{system.department}</span>
                        <span>•</span>
                        <Badge variant={system.status === 'verified' ? 'default' : 'secondary'} className="text-xs">
                          {system.status}
                        </Badge>
                        <span>•</span>
                        <span className="capitalize">{system.riskLevel} Risk</span>
                      </div>
                    </div>
                    {system.totalControls > 0 && (
                      <div className="text-right">
                        <div className="text-2xl font-bold">{system.complianceRate}%</div>
                        <div className="text-xs text-muted-foreground">
                          {system.compliantControls}/{system.totalControls} controls
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            This trust page is verified by Spectral AI Governance Platform
          </p>
          <p className="mt-2">
            Certification status and compliance data are continuously monitored
          </p>
        </div>
      </div>
    </div>
  );
}
