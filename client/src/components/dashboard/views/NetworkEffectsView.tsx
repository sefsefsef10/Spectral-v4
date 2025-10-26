/**
 * 📊 NETWORK EFFECTS DASHBOARD - Health System Side
 * Shows health systems the power and growth of the Spectral network
 * Demonstrates ROI through network size and vendor adoption
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Building2, TrendingUp, Award, Network, Users, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface NetworkSnapshot {
  snapshotDate: Date;
  totalHealthSystems: number;
  activeHealthSystems: number;
  totalVendors: number;
  certifiedVendors: number;
  totalAcceptances: number;
  spectralStandardAdopters: number;
  networkDensity: number;
  averageAcceptanceRate: number;
  newHealthSystemsThisWeek: number;
  newVendorsThisWeek: number;
  newCertificationsThisWeek: number;
}

interface NetworkEffectsScore {
  score: number;
  breakdown: {
    densityScore: number;
    adoptionScore: number;
    growthScore: number;
    standardizationScore: number;
  };
}

export default function NetworkEffectsView() {
  const { data: networkSnapshot } = useQuery<NetworkSnapshot>({
    queryKey: ["/api/network-metrics/latest"],
  });

  const { data: networkScore } = useQuery<NetworkEffectsScore>({
    queryKey: ["/api/network-metrics/effects-score"],
  });

  const { data: topVendors = [] } = useQuery<Array<{name: string; category: string; certificationTier: string}>>({
    queryKey: ["/api/vendors/public"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Spectral Network</h1>
        <p className="text-muted-foreground">See the power of the growing Spectral ecosystem</p>
      </div>

      {/* Network Health Score */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" />
            Network Effects Score
          </CardTitle>
          <CardDescription>Measures the strength and maturity of the Spectral network</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 mb-6">
            <div className="text-6xl font-bold text-primary">
              {networkScore?.score.toFixed(0) || 0}
            </div>
            <div className="flex-1">
              <Progress value={networkScore?.score || 0} className="h-3" />
              <div className="text-sm text-muted-foreground mt-2">
                {networkScore && networkScore.score < 25 && "Early Stage - Be an early adopter"}
                {networkScore && networkScore.score >= 25 && networkScore.score < 50 && "Growing - Network gaining momentum"}
                {networkScore && networkScore.score >= 50 && networkScore.score < 75 && "Established - Strong network effects"}
                {networkScore && networkScore.score >= 75 && "Dominant - Industry standard"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 bg-background rounded-lg">
              <div className="text-2xl font-bold">{networkScore?.breakdown.densityScore.toFixed(0) || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Density</div>
            </div>
            <div className="text-center p-3 bg-background rounded-lg">
              <div className="text-2xl font-bold">{networkScore?.breakdown.adoptionScore.toFixed(0) || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Adoption</div>
            </div>
            <div className="text-center p-3 bg-background rounded-lg">
              <div className="text-2xl font-bold">{networkScore?.breakdown.growthScore.toFixed(0) || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Growth</div>
            </div>
            <div className="text-center p-3 bg-background rounded-lg">
              <div className="text-2xl font-bold">{networkScore?.breakdown.standardizationScore.toFixed(0) || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Standard</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Network Size Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">Health Systems</div>
          </div>
          <div className="text-3xl font-bold">{networkSnapshot?.totalHealthSystems || 0}</div>
          <div className="text-xs text-green-600 mt-1">+{networkSnapshot?.newHealthSystemsThisWeek || 0} this week</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">Certified Vendors</div>
          </div>
          <div className="text-3xl font-bold">{networkSnapshot?.certifiedVendors || 0}</div>
          <div className="text-xs text-green-600 mt-1">+{networkSnapshot?.newVendorsThisWeek || 0} this week</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Network className="w-5 h-5 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">Network Density</div>
          </div>
          <div className="text-3xl font-bold">
            {networkSnapshot?.networkDensity ? (networkSnapshot.networkDensity * 100).toFixed(1) : 0}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {networkSnapshot?.totalAcceptances || 0} connections
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-5 h-5 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">Standard Adopters</div>
          </div>
          <div className="text-3xl font-bold">{networkSnapshot?.spectralStandardAdopters || 0}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {networkSnapshot && networkSnapshot.totalHealthSystems > 0
              ? ((networkSnapshot.spectralStandardAdopters / networkSnapshot.totalHealthSystems) * 100).toFixed(0)
              : 0}% of network
          </div>
        </Card>
      </div>

      {/* Certified Vendors Available */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              {networkSnapshot?.certifiedVendors || 0} Spectral Certified Vendors
            </span>
            <Button variant="outline" size="sm">View All Vendors</Button>
          </CardTitle>
          <CardDescription>
            Pre-vetted AI vendors ready for procurement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {topVendors.slice(0, 6).map((vendor: {name: string; category: string; certificationTier: string}, i: number) => (
              <div key={i} className="p-4 border rounded-lg hover-elevate">
                <div className="font-medium mb-1">{vendor.name}</div>
                <div className="text-sm text-muted-foreground mb-2">{vendor.category}</div>
                <Badge variant={
                  vendor.certificationTier === 'Trusted' ? 'default' :
                  vendor.certificationTier === 'Certified' ? 'secondary' : 'outline'
                }>
                  {vendor.certificationTier}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ROI Value Proposition */}
      <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Your Network ROI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-background rounded-lg">
              <div className="text-3xl font-bold text-green-600">40%</div>
              <div className="text-sm text-muted-foreground mt-1">Faster procurement</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <div className="text-3xl font-bold text-green-600">60%</div>
              <div className="text-sm text-muted-foreground mt-1">Less due diligence time</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <div className="text-3xl font-bold text-green-600">{networkSnapshot?.certifiedVendors || 0}</div>
              <div className="text-sm text-muted-foreground mt-1">Pre-vetted vendors</div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-3">
              <strong>Network Effect:</strong> As more health systems adopt Spectral, more vendors get certified.
              Your procurement process gets easier and faster over time.
            </p>
            <Button variant="default" className="w-full">
              Adopt Spectral Standard for Your Organization
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
