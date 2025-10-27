/**
 * Stripe Billing Usage Limit Gateway
 * 
 * Infrastructure layer implementation wrapping stripe-billing service.
 * Isolates external billing service calls from domain logic.
 */

import { UsageLimitGateway, UsageLimitCheckResult } from '../../domain/gateways/UsageLimitGateway';
import { stripeBillingService } from '../../services/stripe-billing';

export class StripeBillingUsageLimitGateway implements UsageLimitGateway {
  async canAddAISystem(healthSystemId: string): Promise<UsageLimitCheckResult> {
    return stripeBillingService.canAddAISystem(healthSystemId);
  }
}
