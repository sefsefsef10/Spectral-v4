import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Activity, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface UsageMeter {
  id: string;
  meterType: string;
  unitPrice: string;
  description: string | null;
}

interface UsageEvent {
  id: string;
  meterId: string;
  quantity: number;
  timestamp: string;
  metadata: any;
}

interface UsageAggregation {
  meterId: string;
  meterType: string;
  totalUnits: number;
  unitPrice: number;
  totalCost: number;
  events: UsageEvent[];
}

interface UsageDashboardProps {
  subscriptionId: string;
}

export function UsageDashboard({ subscriptionId }: UsageDashboardProps) {
  const { data: meters, isLoading: metersLoading } = useQuery<UsageMeter[]>({
    queryKey: ['usage-meters', subscriptionId],
    queryFn: async () => {
      const res = await fetch(`/api/billing/usage-meters?subscriptionId=${subscriptionId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch usage meters');
      return res.json();
    },
  });

  const { data: usage, isLoading: usageLoading } = useQuery<UsageAggregation[]>({
    queryKey: ['usage-events', subscriptionId],
    queryFn: async () => {
      const res = await fetch(`/api/billing/usage-events?subscriptionId=${subscriptionId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch usage events');
      return res.json();
    },
    enabled: !!meters && meters.length > 0,
  });

  if (metersLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!meters || meters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage & Metering</CardTitle>
          <CardDescription>Track your consumption-based usage</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Activity className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No usage meters configured</h3>
          <p className="text-sm text-muted-foreground">
            Your plan includes fixed pricing with no usage-based charges
          </p>
        </CardContent>
      </Card>
    );
  }

  const getMeterLabel = (meterType: string) => {
    switch (meterType) {
      case 'api_calls':
        return 'API Calls';
      case 'ai_systems_monitored':
        return 'AI Systems Monitored';
      case 'compliance_scans':
        return 'Compliance Scans';
      case 'report_generations':
        return 'Report Generations';
      case 'vendor_certifications':
        return 'Vendor Certifications';
      default:
        return meterType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }
  };

  const totalUsageCost = usage?.reduce((sum, u) => sum + u.totalCost, 0) || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Usage Summary</CardTitle>
          <CardDescription>
            Current billing period consumption-based charges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Total Usage Charges</span>
              <span className="text-2xl font-bold">${totalUsageCost.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This will be added to your next invoice
            </p>
          </div>

          <div className="space-y-4">
            {meters.map((meter) => {
              const meterUsage = usage?.find((u) => u.meterId === meter.id);
              const totalUnits = meterUsage?.totalUnits || 0;
              const cost = meterUsage?.totalCost || 0;

              return (
                <div key={meter.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-semibold">{getMeterLabel(meter.meterType)}</h4>
                      <p className="text-xs text-muted-foreground">
                        ${parseFloat(meter.unitPrice).toFixed(4)} per unit
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">${cost.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{totalUnits} units</div>
                    </div>
                  </div>
                  
                  {meterUsage && meterUsage.events.length > 0 && (
                    <div className="mt-4">
                      <div className="h-[150px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={meterUsage.events
                              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                              .map((event, idx) => ({
                                name: new Date(event.timestamp).toLocaleDateString(),
                                value: event.quantity,
                                cumulative: meterUsage.events
                                  .slice(0, idx + 1)
                                  .reduce((sum, e) => sum + e.quantity, 0),
                              }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" fontSize={10} />
                            <YAxis fontSize={10} />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="cumulative"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Cumulative usage over time
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
