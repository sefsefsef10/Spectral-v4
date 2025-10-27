/**
 * 💰 CUSTOMIZATION VIEW
 * 
 * Tiered Translation Engine customization interface
 * - Foundation: Read-only view
 * - Growth: Threshold tuning + control toggles
 * - Enterprise: Custom controls with approval workflow
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, TrendingUp, Shield, Sparkles, Lock, CheckCircle2, Clock, XCircle } from "lucide-react";
import { ThresholdOverrideForm } from "@/components/customization/ThresholdOverrideForm";
import { CustomControlBuilder } from "@/components/customization/CustomControlBuilder";
import { ControlToggleManager } from "@/components/customization/ControlToggleManager";
import { CustomizationAuditLog } from "@/components/customization/CustomizationAuditLog";
import { useToast } from "@/hooks/use-toast";

type SubscriptionTier = 'starter' | 'growth' | 'enterprise';

interface TierPermissions {
  tier: SubscriptionTier;
  permissions: {
    canCustomizeThresholds: boolean;
    canToggleControls: boolean;
    canCreateCustomControls: boolean;
  };
}

interface Customization {
  thresholdOverrides: any[];
  controlToggles: any[];
  customControls: any[];
}

export function CustomizationView() {
  const { toast } = useToast();
  const [tierPermissions, setTierPermissions] = useState<TierPermissions | null>(null);
  const [customizations, setCustomizations] = useState<Customization | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [permsRes, customRes] = await Promise.all([
        fetch("/api/customization/tier-permissions", { credentials: "include" }),
        fetch("/api/customization/overview", { credentials: "include" }),
      ]);

      if (permsRes.ok) {
        const perms = await permsRes.json();
        setTierPermissions(perms);
      }

      if (customRes.ok) {
        const custom = await customRes.json();
        setCustomizations(custom);
      }
    } catch (error) {
      console.error("Failed to load customization data:", error);
      toast({
        title: "Error",
        description: "Failed to load customization settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTierBadge = (tier: SubscriptionTier) => {
    const config = {
      starter: { label: "Foundation", color: "bg-gray-500" },
      growth: { label: "Growth", color: "bg-blue-500" },
      enterprise: { label: "Enterprise", color: "bg-purple-500" },
    };
    const { label, color } = config[tier];
    return <Badge className={color}>{label}</Badge>;
  };

  const getTierUpgradeMessage = (tier: SubscriptionTier) => {
    if (tier === 'starter') {
      return {
        title: "Unlock Translation Engine Customization",
        description: "Upgrade to Growth ($200K/year) to tune compliance thresholds and toggle controls, or Enterprise ($400K/year) for custom policy extensions.",
        icon: Lock,
      };
    }
    if (tier === 'growth') {
      return {
        title: "Unlock Custom Compliance Controls",
        description: "Upgrade to Enterprise ($400K/year) to create organization-specific policies that extend the Translation Engine.",
        icon: Sparkles,
      };
    }
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!tierPermissions || !customizations) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load customization settings. Please refresh the page.
        </AlertDescription>
      </Alert>
    );
  }

  const upgradeMessage = getTierUpgradeMessage(tierPermissions.tier);
  const { permissions } = tierPermissions;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Translation Engine Customization</h1>
            {getTierBadge(tierPermissions.tier)}
          </div>
          <p className="text-muted-foreground">
            Personalize compliance detection rules, thresholds, and policies to match your organization's requirements
          </p>
        </div>
      </div>

      {/* Upgrade CTA */}
      {upgradeMessage && (
        <Alert className="border-purple-500/50 bg-purple-50 dark:bg-purple-950/20">
          <upgradeMessage.icon className="h-5 w-5 text-purple-600" />
          <div className="ml-2">
            <div className="font-semibold text-purple-900 dark:text-purple-100">
              {upgradeMessage.title}
            </div>
            <AlertDescription className="text-purple-800 dark:text-purple-200">
              {upgradeMessage.description}
            </AlertDescription>
          </div>
          <Button className="ml-auto" variant="default">
            Contact Sales
          </Button>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Threshold Overrides</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customizations.thresholdOverrides.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {permissions.canCustomizeThresholds ? "Active customizations" : "Upgrade to Growth tier"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Control Toggles</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customizations.controlToggles.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {permissions.canToggleControls ? "Active toggles" : "Upgrade to Growth tier"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custom Controls</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customizations.customControls.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {permissions.canCreateCustomControls ? "Organization-specific policies" : "Upgrade to Enterprise tier"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="thresholds" disabled={!permissions.canCustomizeThresholds}>
            Thresholds
          </TabsTrigger>
          <TabsTrigger value="toggles" disabled={!permissions.canToggleControls}>
            Control Toggles
          </TabsTrigger>
          <TabsTrigger value="custom" disabled={!permissions.canCreateCustomControls}>
            Custom Controls
          </TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Customizations</CardTitle>
              <CardDescription>
                Summary of all Translation Engine customizations for your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Threshold Overrides */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Threshold Overrides ({customizations.thresholdOverrides.length})
                </h3>
                {customizations.thresholdOverrides.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No threshold overrides configured</p>
                ) : (
                  <div className="space-y-2">
                    {customizations.thresholdOverrides.map((override) => (
                      <div key={override.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{override.eventType}</div>
                          <div className="text-sm text-muted-foreground">
                            Threshold: {override.customThreshold} {override.thresholdUnit}
                          </div>
                        </div>
                        <Badge variant={override.approvalStatus === 'approved' ? 'default' : 'secondary'}>
                          {override.approvalStatus === 'approved' ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : (
                            <Clock className="h-3 w-3 mr-1" />
                          )}
                          {override.approvalStatus}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Control Toggles */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Control Toggles ({customizations.controlToggles.length})
                </h3>
                {customizations.controlToggles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No control toggles configured</p>
                ) : (
                  <div className="space-y-2">
                    {customizations.controlToggles.map((toggle) => (
                      <div key={toggle.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{toggle.controlId}</div>
                          {toggle.disableReason && (
                            <div className="text-sm text-muted-foreground">{toggle.disableReason}</div>
                          )}
                        </div>
                        <Badge variant={toggle.enabled ? 'default' : 'secondary'}>
                          {toggle.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Controls */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Custom Controls ({customizations.customControls.length})
                </h3>
                {customizations.customControls.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No custom controls created</p>
                ) : (
                  <div className="space-y-2">
                    {customizations.customControls.map((control) => (
                      <div key={control.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{control.controlName}</div>
                          <div className="text-sm text-muted-foreground">{control.description}</div>
                        </div>
                        <Badge variant={control.status === 'approved' ? 'default' : control.status === 'rejected' ? 'destructive' : 'secondary'}>
                          {control.status === 'approved' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {control.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                          {control.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                          {control.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="thresholds">
          <ThresholdOverrideForm onSuccess={loadData} />
        </TabsContent>

        <TabsContent value="toggles">
          <ControlToggleManager customizations={customizations} onSuccess={loadData} />
        </TabsContent>

        <TabsContent value="custom">
          <CustomControlBuilder onSuccess={loadData} />
        </TabsContent>

        <TabsContent value="audit">
          <CustomizationAuditLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
