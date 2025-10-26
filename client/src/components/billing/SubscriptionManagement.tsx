import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowUpCircle, XCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

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

interface SubscriptionManagementProps {
  subscription: Subscription;
}

const PLAN_FEATURES = {
  starter: [
    'Up to 10 AI systems',
    'Basic compliance monitoring',
    'Monthly reports',
    'Email support',
  ],
  professional: [
    'Up to 50 AI systems',
    'Advanced compliance monitoring',
    'Weekly reports + alerts',
    'Priority email support',
    'Automated vendor certification',
    'State law compliance',
  ],
  enterprise: [
    'Unlimited AI systems',
    'Full compliance suite',
    'Real-time monitoring & alerts',
    '24/7 priority support',
    'Advanced certification workflows',
    'Custom integrations',
    'Dedicated success manager',
    'SLA guarantees',
  ],
};

export function SubscriptionManagement({ subscription }: SubscriptionManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/billing/subscriptions/${subscription.id}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to cancel subscription');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast({
        title: 'Subscription Cancelled',
        description: 'Your subscription will end at the end of the current billing period.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to cancel subscription. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/billing/subscriptions/${subscription.id}/reactivate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to reactivate subscription');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast({
        title: 'Subscription Reactivated',
        description: 'Your subscription will continue after the current period.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to reactivate subscription. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const currentTier = subscription.planTier as keyof typeof PLAN_FEATURES;
  const features = PLAN_FEATURES[currentTier] || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Subscription</CardTitle>
          <CardDescription>
            Your active plan and included features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold capitalize">{subscription.planTier} Plan</h3>
              <p className="text-muted-foreground">
                ${parseFloat(subscription.planPrice).toFixed(2)}/month
              </p>
            </div>
            <Badge
              variant={subscription.status === 'active' ? 'default' : 'secondary'}
              className="capitalize"
            >
              {subscription.status}
            </Badge>
          </div>

          <div className="space-y-2 mb-6">
            <h4 className="font-semibold text-sm">Included Features:</h4>
            <ul className="space-y-2">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2">
            {!subscription.cancelAtPeriodEnd ? (
              <>
                <Button variant="outline" disabled>
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Subscription'}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => reactivateMutation.mutate()}
                disabled={reactivateMutation.isPending}
              >
                {reactivateMutation.isPending ? 'Reactivating...' : 'Reactivate Subscription'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing Details</CardTitle>
          <CardDescription>
            Current billing period and renewal information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Period Start:</span>
              <span className="font-medium">
                {new Date(subscription.currentPeriodStart).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Period End:</span>
              <span className="font-medium">
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Next Renewal:</span>
              <span className="font-medium">
                {subscription.cancelAtPeriodEnd
                  ? 'Not scheduled (cancelled)'
                  : new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Method:</span>
              <span className="font-medium">Not configured</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
