import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Copy, Check, ExternalLink, Code, Eye } from "lucide-react";
import { useState } from "react";

export default function VendorBadgeManager() {
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  const vendorId = user?.vendorId;
  const baseUrl = window.location.origin;

  const { data: badgeData } = useQuery({
    queryKey: ["/api/public/vendors", vendorId, "badge"],
    enabled: !!vendorId,
  });

  const embedCode = vendorId
    ? `<!-- Spectral Certification Badge -->
<div id="spectral-badge"></div>
<script src="${baseUrl}/api/public/vendors/${vendorId}/badge.js"></script>`
    : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTierColor = (tier: string) => {
    const normalizedTier = tier?.toLowerCase();
    switch (normalizedTier) {
      case "trusted":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "certified":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "verified":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Certification Badge</h1>
        <p className="text-muted-foreground">
          Showcase your Spectral certification on your website to build trust with healthcare customers
        </p>
      </div>

      {badgeData && (
        <>
          {/* Badge Preview */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Badge Preview
              </CardTitle>
              <CardDescription>
                This is how your certification badge will appear on your website
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-8 bg-muted/30 rounded-lg">
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 shadow-sm cursor-pointer hover:shadow-md transition-all"
                  style={{
                    backgroundColor:
                      badgeData.certificationTier?.toLowerCase() === "trusted"
                        ? "#9333ea"
                        : badgeData.certificationTier?.toLowerCase() === "certified"
                        ? "#3b82f6"
                        : "#10b981",
                    borderColor:
                      badgeData.certificationTier?.toLowerCase() === "trusted"
                        ? "#7c3aed"
                        : badgeData.certificationTier?.toLowerCase() === "certified"
                        ? "#2563eb"
                        : "#059669",
                    color: "#ffffff",
                  }}
                >
                  <Shield className="w-5 h-5" />
                  <div className="flex flex-col gap-0.5">
                    <div className="font-semibold text-sm leading-none">
                      {badgeData.certificationTier ? (badgeData.certificationTier.charAt(0).toUpperCase() + badgeData.certificationTier.slice(1)) : 'Verified'} by Spectral
                    </div>
                    <div className="text-xs opacity-90 leading-none">
                      Healthcare AI Governance
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex gap-2 mb-2">
                  <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm text-blue-900 dark:text-blue-100">
                      Your Current Certification
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      <Badge variant="outline" className={getTierColor(badgeData.certificationTier || 'verified')}>
                        {badgeData.certificationTier ? (badgeData.certificationTier.charAt(0).toUpperCase() + badgeData.certificationTier.slice(1)) : 'Verified'}
                      </Badge>
                      <span className="ml-2 text-xs">
                        {badgeData.verified ? "Verified ✓" : "Pending Verification"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Embed Code */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5" />
                Embed Code
              </CardTitle>
              <CardDescription>
                Copy this code and paste it into your website's HTML
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto border">
                  <code>{embedCode}</code>
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Code
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong>Installation:</strong>
                </p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Copy the code above</li>
                  <li>Paste it into your website's HTML where you want the badge to appear</li>
                  <li>The badge will automatically update when your certification status changes</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle>Badge Features</CardTitle>
              <CardDescription>
                Why use the Spectral certification badge
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium mb-1">Build Trust</div>
                    <div className="text-sm text-muted-foreground">
                      Show healthcare customers your commitment to compliance and safety
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ExternalLink className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium mb-1">Drive Traffic</div>
                    <div className="text-sm text-muted-foreground">
                      Badge links to your public trust page with full certification details
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Check className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium mb-1">Auto-Updates</div>
                    <div className="text-sm text-muted-foreground">
                      Badge automatically reflects your current certification tier
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Code className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium mb-1">Easy Integration</div>
                    <div className="text-sm text-muted-foreground">
                      Simple copy-paste installation, no technical expertise required
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-primary mt-0.5" />
                  <div className="text-sm">
                    <strong>Pro Tip:</strong> Place your badge on your homepage, product pages, or
                    in your footer to maximize visibility and build credibility with prospective
                    healthcare customers.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
