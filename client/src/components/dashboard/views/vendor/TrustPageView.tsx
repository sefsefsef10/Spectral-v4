import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { Vendor, ComplianceCertification } from "@shared/schema";
import { useAuth } from "@/lib/auth";

export default function TrustPageView() {
  const { toast } = useToast();
  const { user } = useAuth();

  const vendorId = user?.vendorId || "";

  const { data: vendor } = useQuery<Vendor>({
    queryKey: [`/api/vendors/${vendorId}`],
    enabled: !!vendorId,
  });

  const { data: certifications = [] } = useQuery<ComplianceCertification[]>({
    queryKey: ["/api/certifications"],
    enabled: !!user,
  });

  const trustPageUrl = vendorId ? `${window.location.origin}/trust/${vendorId}` : "";

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(trustPageUrl);
    toast({
      title: "URL Copied",
      description: "Trust page URL copied to clipboard",
    });
  };

  const handleViewPublic = () => {
    if (trustPageUrl) {
      window.open(trustPageUrl, '_blank');
    }
  };

  if (!vendor) {
    return <div className="p-6">Loading vendor data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Trust Page</h1>
          <p className="text-muted-foreground">Public verification page for prospects and customers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCopyUrl} data-testid="button-copy-url">
            <Copy className="w-4 h-4 mr-2" />
            Copy URL
          </Button>
          <Button onClick={handleViewPublic} data-testid="button-view-public">
            <ExternalLink className="w-4 h-4 mr-2" />
            View Public Page
          </Button>
        </div>
      </div>

      <Card className="p-6 bg-muted/50">
        <div className="flex items-center gap-3 mb-4">
          {vendor.verified && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Spectral Verified
            </Badge>
          )}
          <span className="text-sm text-muted-foreground font-mono">
            {trustPageUrl}
          </span>
        </div>
        <h2 className="text-2xl font-bold mb-2">{vendor.name}</h2>
        <p className="text-muted-foreground mb-4">
          Spectral Verified AI healthcare vendor
        </p>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Compliance Certifications</h3>
        {certifications.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No certifications yet
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {certifications.map((cert) => (
              <div key={cert.id} className="flex items-center gap-3 p-4 border rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <div>
                  <div className="font-medium">{cert.type}</div>
                  <div className="text-sm text-muted-foreground">
                    {cert.verifiedDate ? new Date(cert.verifiedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : cert.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Security Testing Results</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm">PHI Leakage Testing</span>
            </div>
            <span className="text-sm font-medium">Passed</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm">Bias & Fairness Testing</span>
            </div>
            <span className="text-sm font-medium">Passed</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm">Model Drift Monitoring</span>
            </div>
            <span className="text-sm font-medium">Active</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm">Penetration Testing</span>
            </div>
            <span className="text-sm font-medium">Passed</span>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Available Documentation</h3>
        <div className="grid gap-2">
          {[
            { name: "Security Architecture Whitepaper", type: "PDF" },
            { name: "Clinical Validation Study", type: "PDF" },
            { name: "Bias Testing Methodology", type: "PDF" },
            { name: "HIPAA Business Associate Agreement (BAA)", type: "Template" },
            { name: "Data Processing Agreement (DPA)", type: "Template" },
          ].map((doc, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover-elevate">
              <div className="flex items-center gap-2">
                <span>📄</span>
                <div>
                  <div className="text-sm font-medium">{doc.name}</div>
                  <div className="text-xs text-muted-foreground">{doc.type}</div>
                </div>
              </div>
              <Button variant="outline" size="sm" data-testid={`button-download-${i}`}>
                Download
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
