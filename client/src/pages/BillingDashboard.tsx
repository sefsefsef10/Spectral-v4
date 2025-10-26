import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CreditCard, Receipt, TrendingUp, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SubscriptionManagement } from '@/components/billing/SubscriptionManagement';
import { InvoiceHistory } from '@/components/billing/InvoiceHistory';
import { UsageDashboard } from '@/components/billing/UsageDashboard';
import { useAuth } from '@/lib/auth';

interface BillingAccount {
  id: string;
  stripeCustomerId: string | null;
  billingEmail: string;
  paymentMethodLast4: string | null;
  paymentMethodBrand: string | null;
}

interface Subscription {
  id: string;
  status: string;
  planTier: string;
  planPrice: string;
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface UpcomingInvoice {
  periodStart: string;
  periodEnd: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
}

export default function BillingDashboard() {
  const { user } = useAuth();

  const { data: subscription, isLoading: subLoading } = useQuery<Subscription>({
    queryKey: ['subscription'],
    queryFn: async () => {
      const res = await fetch('/api/billing/subscription', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch subscription');
      return res.json();
    },
  });

  const { data: upcomingInvoice, isLoading: invoiceLoading } = useQuery<UpcomingInvoice>({
    queryKey: ['upcoming-invoice'],
    queryFn: async () => {
      const res = await fetch('/api/billing/invoices/upcoming', {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to fetch upcoming invoice');
      }
      return res.json();
    },
    enabled: !!subscription,
  });

  if (subLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No active subscription found. Please contact your administrator to set up billing.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const periodStart = new Date(subscription.currentPeriodStart);
  const periodEnd = new Date(subscription.currentPeriodEnd);
  const daysRemaining = Math.ceil(
    (periodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing & Subscriptions</h1>
        <p className="text-muted-foreground">
          Manage your subscription, view invoices, and track usage
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{subscription.planTier}</div>
            <p className="text-xs text-muted-foreground">
              ${parseFloat(subscription.planPrice).toFixed(2)}/{subscription.currency === 'usd' ? 'month' : subscription.currency}
            </p>
            <div className="mt-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  subscription.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : subscription.status === 'past_due'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {subscription.status}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Billing Period</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{daysRemaining} days</div>
            <p className="text-xs text-muted-foreground">
              Remaining in current period
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {periodStart.toLocaleDateString()} - {periodEnd.toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Invoice</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {invoiceLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : upcomingInvoice ? (
              <>
                <div className="text-2xl font-bold">
                  ${upcomingInvoice.total.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Due {new Date(upcomingInvoice.periodEnd).toLocaleDateString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {upcomingInvoice.lineItems.length} line item(s)
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming invoice</p>
            )}
          </CardContent>
        </Card>
      </div>

      {subscription.cancelAtPeriodEnd && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your subscription will be cancelled at the end of the current billing period on{' '}
            {periodEnd.toLocaleDateString()}.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="subscription" className="space-y-6">
        <TabsList>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="usage">Usage & Metering</TabsTrigger>
        </TabsList>

        <TabsContent value="subscription">
          <SubscriptionManagement subscription={subscription} />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoiceHistory />
        </TabsContent>

        <TabsContent value="usage">
          <UsageDashboard subscriptionId={subscription.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
