/**
 * 🔒 POLICY LOADER - Translation Engine IP Moat Integration
 * 
 * Loads encrypted compliance policies from database with caching.
 * Bridges PolicyVersioningService ↔ ComplianceMapping runtime.
 * 
 * CRITICAL FOR M&A: Makes static TypeScript rules into encrypted, versioned database policies.
 */

import { policyVersioningService, type PolicyRuleLogic } from '../policy-versioning-service';
import { logger } from '../../logger';

interface CachedPolicy {
  policy: PolicyRuleLogic;
  lastLoaded: number;
}

interface PolicyCache {
  [eventType: string]: {
    [framework: string]: CachedPolicy;
  };
}

export class PolicyLoader {
  private cache: PolicyCache = {};
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Get policy for specific event type and framework (with caching)
   */
  async getPolicy(eventType: string, framework: string): Promise<PolicyRuleLogic | null> {
    // Check cache first
    const cached = this.cache[eventType]?.[framework];
    if (cached && Date.now() - cached.lastLoaded < this.CACHE_TTL) {
      return cached.policy;
    }
    
    try {
      // Load from database
      const policy = await policyVersioningService.getActivePolicy(eventType, framework);
      
      if (!policy) {
        logger.warn({ eventType, framework }, 'No active policy found - falling back to static rules');
        return null;
      }
      
      // Cache the result
      if (!this.cache[eventType]) {
        this.cache[eventType] = {};
      }
      this.cache[eventType][framework] = {
        policy,
        lastLoaded: Date.now()
      };
      
      logger.debug({ eventType, framework }, 'Policy loaded from database');
      return policy;
    } catch (error) {
      logger.error({ error, eventType, framework }, 'Failed to load policy - falling back to static rules');
      return null;
    }
  }
  
  /**
   * Get all framework policies for an event type
   */
  async getPoliciesForEvent(eventType: string): Promise<Map<string, PolicyRuleLogic>> {
    const frameworks = ['HIPAA', 'NIST_AI_RMF', 'FDA_SaMD', 'ISO_42001'];
    const policies = new Map<string, PolicyRuleLogic>();
    
    for (const framework of frameworks) {
      const policy = await this.getPolicy(eventType, framework);
      if (policy) {
        policies.set(framework, policy);
      }
    }
    
    return policies;
  }
  
  /**
   * Clear cache (for testing or after policy updates)
   */
  clearCache() {
    this.cache = {};
    logger.info('Policy cache cleared');
  }
  
  /**
   * Warm cache by preloading common policies
   */
  async warmCache(eventTypes: string[]) {
    logger.info({ eventTypes }, 'Warming policy cache');
    
    const frameworks = ['HIPAA', 'NIST_AI_RMF', 'FDA_SaMD'];
    const promises = [];
    
    for (const eventType of eventTypes) {
      for (const framework of frameworks) {
        promises.push(this.getPolicy(eventType, framework));
      }
    }
    
    await Promise.all(promises);
    logger.info(`Policy cache warmed: ${promises.length} policies loaded`);
  }
}

export const policyLoader = new PolicyLoader();
