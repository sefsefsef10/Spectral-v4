import { db } from '../../db';
import {
  billingAccounts,
  subscriptions,
  invoices,
  usageMeters,
  usageEvents,
  type Invoice,
} from '../../../shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { logger } from '../../logger';

export interface UsageAggregation {
  meterId: string;
  meterType: string;
  totalUnits: number;
  unitPrice: number;
  totalAmount: number;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  meterId?: string;
}

export interface GeneratedInvoice {
  invoiceId: string;
  billingAccountId: string;
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  dueDate: Date;
}

export class AutomatedInvoicingService {
  private readonly TAX_RATE = 0.0;

  async generateMonthlyInvoices(billingMonth: Date): Promise<GeneratedInvoice[]> {
    const startOfMonth = new Date(billingMonth.getFullYear(), billingMonth.getMonth(), 1);
    const endOfMonth = new Date(billingMonth.getFullYear(), billingMonth.getMonth() + 1, 0, 23, 59, 59, 999);

    logger.info('Starting monthly invoice generation', {
      billingMonth: billingMonth.toISOString(),
      periodStart: startOfMonth.toISOString(),
      periodEnd: endOfMonth.toISOString(),
    });

    const activeSubscriptions = await db
      .select({
        subscription: subscriptions,
        account: billingAccounts,
      })
      .from(subscriptions)
      .innerJoin(billingAccounts, eq(subscriptions.billingAccountId, billingAccounts.id))
      .where(
        and(
          eq(subscriptions.status, 'active'),
          lte(subscriptions.currentPeriodStart, endOfMonth),
          gte(subscriptions.currentPeriodEnd, startOfMonth)
        )
      );

    logger.info(`Found ${activeSubscriptions.length} active subscription(s) for billing`);

    const generatedInvoices: GeneratedInvoice[] = [];

    for (const { subscription, account } of activeSubscriptions) {
      try {
        const invoice = await this.generateInvoiceForSubscription(
          subscription,
          account.id,
          startOfMonth,
          endOfMonth
        );
        generatedInvoices.push(invoice);
      } catch (error) {
        logger.error('Failed to generate invoice for subscription', {
          subscriptionId: subscription.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info(`Generated ${generatedInvoices.length} invoice(s)`);
    return generatedInvoices;
  }

  private async generateInvoiceForSubscription(
    subscription: typeof subscriptions.$inferSelect,
    billingAccountId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<GeneratedInvoice> {
    // Check if invoice already exists for this period (idempotency check)
    const existingInvoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.subscriptionId, subscription.id),
        eq(invoices.periodStart, periodStart),
        eq(invoices.periodEnd, periodEnd)
      ),
    });

    if (existingInvoice) {
      // If invoice is finalized, skip re-generation
      if (existingInvoice.status !== 'draft') {
        logger.info('Invoice already exists and is finalized, skipping', {
          invoiceId: existingInvoice.id,
          status: existingInvoice.status,
        });
        
        return {
          invoiceId: existingInvoice.id,
          billingAccountId,
          subscriptionId: subscription.id,
          periodStart,
          periodEnd,
          lineItems: (existingInvoice.lineItems as InvoiceLineItem[]) || [],
          subtotal: parseFloat(existingInvoice.subtotal),
          tax: parseFloat(existingInvoice.tax),
          total: parseFloat(existingInvoice.total),
          dueDate: existingInvoice.dueDate!,
        };
      }

      // If draft exists, update it with latest usage (idempotent update)
      logger.info('Updating existing draft invoice with latest usage', {
        invoiceId: existingInvoice.id,
      });
    }

    // Calculate line items (for new invoice or draft update)
    const lineItems: InvoiceLineItem[] = [];

    lineItems.push({
      description: `${subscription.planTier} Plan - Monthly Subscription`,
      quantity: 1,
      unitPrice: parseFloat(subscription.planPrice),
      amount: parseFloat(subscription.planPrice),
    });

    const usageLineItems = await this.aggregateUsageForPeriod(
      subscription.id,
      periodStart,
      periodEnd
    );
    lineItems.push(...usageLineItems);

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const tax = subtotal * this.TAX_RATE;
    const total = subtotal + tax;

    const dueDate = new Date(periodEnd);
    dueDate.setDate(dueDate.getDate() + 14);

    let invoice: Invoice;

    if (existingInvoice) {
      // Update existing draft
      const [updated] = await db
        .update(invoices)
        .set({
          subtotal: subtotal.toString(),
          tax: tax.toString(),
          total: total.toString(),
          lineItems: lineItems as any,
          amountDue: Math.round(total * 100), // Convert to cents
        })
        .where(eq(invoices.id, existingInvoice.id))
        .returning();

      invoice = updated;

      logger.info('Draft invoice updated', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        total,
        lineItemCount: lineItems.length,
      });
    } else {
      // Create new invoice
      const invoiceNumber = this.generateInvoiceNumber(periodStart);

      const [created] = await db
        .insert(invoices)
        .values({
          billingAccountId,
          subscriptionId: subscription.id,
          invoiceNumber,
          status: 'draft',
          periodStart,
          periodEnd,
          subtotal: subtotal.toString(),
          tax: tax.toString(),
          total: total.toString(),
          currency: subscription.currency,
          amountDue: Math.round(total * 100), // Convert to cents
          dueDate,
          lineItems: lineItems as any,
        })
        .returning();

      invoice = created;

      logger.info('New invoice created', {
        invoiceId: invoice.id,
        invoiceNumber,
        total,
        lineItemCount: lineItems.length,
      });
    }

    return {
      invoiceId: invoice.id,
      billingAccountId,
      subscriptionId: subscription.id,
      periodStart,
      periodEnd,
      lineItems,
      subtotal,
      tax,
      total,
      dueDate,
    };
  }

  private async aggregateUsageForPeriod(
    subscriptionId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<InvoiceLineItem[]> {
    const meters = await db
      .select()
      .from(usageMeters)
      .where(eq(usageMeters.subscriptionId, subscriptionId));

    const lineItems: InvoiceLineItem[] = [];

    for (const meter of meters) {
      const aggregation = await this.aggregateUsageForMeter(meter.id, periodStart, periodEnd);

      if (aggregation.totalUnits > 0) {
        lineItems.push({
          description: this.getUsageDescription(meter.meterType, aggregation.totalUnits),
          quantity: aggregation.totalUnits,
          unitPrice: aggregation.unitPrice,
          amount: aggregation.totalAmount,
          meterId: meter.id,
        });
      }
    }

    return lineItems;
  }

  private async aggregateUsageForMeter(
    meterId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<UsageAggregation> {
    const meter = await db.query.usageMeters.findFirst({
      where: eq(usageMeters.id, meterId),
    });

    if (!meter) {
      throw new Error(`Usage meter not found: ${meterId}`);
    }

    const events = await db
      .select()
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.meterId, meterId),
          gte(usageEvents.timestamp, periodStart),
          lte(usageEvents.timestamp, periodEnd)
        )
      );

    const totalUnits = events.reduce((sum, event) => sum + event.quantity, 0);
    const unitPrice = parseFloat(meter.unitPrice);
    const totalAmount = totalUnits * unitPrice;

    logger.info('Aggregated usage for meter', {
      meterId,
      meterType: meter.meterType,
      eventCount: events.length,
      totalUnits,
      totalAmount,
    });

    return {
      meterId,
      meterType: meter.meterType,
      totalUnits,
      unitPrice,
      totalAmount,
    };
  }

  private getUsageDescription(meterType: string, quantity: number): string {
    const descriptions: Record<string, string> = {
      ai_systems_monitored: `${quantity} AI System(s) Monitored`,
      compliance_checks_run: `${quantity} Compliance Check(s)`,
      alerts_generated: `${quantity} Alert(s) Generated`,
      reports_generated: `${quantity} Report(s) Generated`,
      api_calls: `${quantity} API Call(s)`,
      vendor_certifications: `${quantity} Vendor Certification(s)`,
    };

    return descriptions[meterType] || `${meterType}: ${quantity} unit(s)`;
  }

  private generateInvoiceNumber(periodStart: Date): string {
    const year = periodStart.getFullYear();
    const month = (periodStart.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `INV-${year}${month}-${random}`;
  }

  async finalizeInvoice(invoiceId: string): Promise<Invoice> {
    const [invoice] = await db
      .update(invoices)
      .set({
        status: 'open',
        finalizedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId))
      .returning();

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    logger.info('Invoice finalized', {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
    });

    return invoice;
  }

  async markInvoicePaid(invoiceId: string, paymentIntentId?: string): Promise<Invoice> {
    const [invoice] = await db
      .update(invoices)
      .set({
        status: 'paid',
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntentId || null,
      })
      .where(eq(invoices.id, invoiceId))
      .returning();

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    logger.info('Invoice marked as paid', {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      paymentIntentId,
    });

    return invoice;
  }

  async voidInvoice(invoiceId: string, reason?: string): Promise<Invoice> {
    const [invoice] = await db
      .update(invoices)
      .set({
        status: 'void',
        voidedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId))
      .returning();

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    logger.info('Invoice voided', {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      reason,
    });

    return invoice;
  }

  async getUpcomingInvoicePreview(subscriptionId: string): Promise<{
    lineItems: InvoiceLineItem[];
    subtotal: number;
    tax: number;
    total: number;
  }> {
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, subscriptionId),
    });

    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const now = new Date();
    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.currentPeriodEnd;

    const lineItems: InvoiceLineItem[] = [];

    lineItems.push({
      description: `${subscription.planTier} Plan - Monthly Subscription`,
      quantity: 1,
      unitPrice: parseFloat(subscription.planPrice),
      amount: parseFloat(subscription.planPrice),
    });

    const usageLineItems = await this.aggregateUsageForPeriod(
      subscription.id,
      periodStart,
      now
    );
    lineItems.push(...usageLineItems);

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const tax = subtotal * this.TAX_RATE;
    const total = subtotal + tax;

    return {
      lineItems,
      subtotal,
      tax,
      total,
    };
  }

  async getInvoicesByBillingAccount(
    billingAccountId: string,
    limit = 50
  ): Promise<Invoice[]> {
    return db
      .select()
      .from(invoices)
      .where(eq(invoices.billingAccountId, billingAccountId))
      .orderBy(desc(invoices.createdAt))
      .limit(limit);
  }

  async getOverdueInvoices(): Promise<Invoice[]> {
    const now = new Date();
    return db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.status, 'open'),
          lte(invoices.dueDate, now)
        )
      )
      .orderBy(invoices.dueDate);
  }
}

export const automatedInvoicingService = new AutomatedInvoicingService();
