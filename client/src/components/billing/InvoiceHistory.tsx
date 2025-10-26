import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Loader2, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  subtotal: string;
  tax: string;
  total: string;
  currency: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

export function InvoiceHistory() {
  const { toast } = useToast();

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await fetch('/api/billing/invoices', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch invoices');
      return res.json();
    },
  });

  const downloadInvoice = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}/download`, {
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('Failed to download invoice');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Invoice Downloaded',
        description: `${invoiceNumber}.pdf downloaded successfully`,
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download invoice. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'open':
        return 'bg-blue-100 text-blue-700';
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'void':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>View and download your past invoices</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
          <p className="text-sm text-muted-foreground">
            Your invoices will appear here once they are generated
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice History</CardTitle>
        <CardDescription>
          View and download your past invoices ({invoices.length} total)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-semibold">{invoice.invoiceNumber}</h4>
                  <Badge className={getStatusColor(invoice.status)}>
                    {invoice.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {new Date(invoice.periodStart).toLocaleDateString()} -{' '}
                      {new Date(invoice.periodEnd).toLocaleDateString()}
                    </span>
                  </div>
                  {invoice.paidAt && (
                    <span>
                      Paid: {new Date(invoice.paidAt).toLocaleDateString()}
                    </span>
                  )}
                  {invoice.dueDate && !invoice.paidAt && (
                    <span>
                      Due: {new Date(invoice.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {invoice.lineItems.length} line item(s)
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xl font-bold">
                    ${parseFloat(invoice.total).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase">
                    {invoice.currency}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadInvoice(invoice.id, invoice.invoiceNumber)}
                  disabled={invoice.status === 'draft'}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
