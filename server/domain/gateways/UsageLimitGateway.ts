/**
 * Usage Limit Gateway Interface
 * 
 * Defines how the application layer checks tier limits for AI system creation.
 * Infrastructure layer will implement this using Stripe billing service.
 */

export interface UsageLimitCheckResult {
  allowed: boolean;
  message: string;
  current: number;
  limit: number;
}

export interface UsageLimitGateway {
  canAddAISystem(healthSystemId: string): Promise<UsageLimitCheckResult>;
}
