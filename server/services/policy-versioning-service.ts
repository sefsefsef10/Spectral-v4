/**
 * 🔒 POLICY VERSIONING SERVICE - Translation Engine IP Moat
 * 
 * Manages versioned, encrypted compliance mapping policies stored in database.
 * Replaces static lookup tables with dynamic, auditable policy engine.
 * 
 * KEY FEATURES:
 * - Encrypted policy storage (AES-256-GCM)
 * - Semantic versioning (1.0.0, 1.1.0, 2.0.0)
 * - Audit trail for all policy changes
 * - Zero-downtime policy updates
 * - Integrity verification (SHA-256 hashing)
 * 
 * CRITICAL FOR M&A: Defensible IP moat worth $300M+ valuation.
 */

import { db } from '../db';
import { policyVersions, policyChangeLogs, type InsertPolicyVersion, type InsertPolicyChangeLog } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { encryptPolicyLogic, decryptPolicyLogic, generatePolicyHash, verifyPolicyIntegrity } from './policy-encryption';
import { logger } from '../logger';

/**
 * Policy rule logic structure (what gets encrypted)
 */
export interface PolicyRuleLogic {
  frameworks: Array<{
    framework: string; // 'HIPAA', 'NIST_AI_RMF', 'FDA_SaMD'
    controlId: string;
    controlName: string;
    violationType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    requiresReporting: boolean;
    reportingDeadlineDays?: number;
    thresholdLogic?: object; // Dynamic threshold calculations
    remediationSteps?: string[];
  }>;
  metadata?: {
    lastUpdated: string;
    author: string;
    reviewedBy?: string;
    changeReason?: string;
  };
}

export class PolicyVersioningService {
  /**
   * Create new policy version (encrypted)
   */
  async createPolicyVersion(
    eventType: string,
    framework: string,
    version: string,
    ruleLogic: PolicyRuleLogic,
    createdBy: string,
    changeReason: string
  ): Promise<string> {
    try {
      // Encrypt the rule logic
      const encryptedRuleLogic = encryptPolicyLogic(ruleLogic);
      const ruleHash = generatePolicyHash(ruleLogic);
      
      // Deprecate any existing active policy for this event+framework
      await db.update(policyVersions)
        .set({ 
          status: 'deprecated',
          deprecatedDate: new Date()
        })
        .where(and(
          eq(policyVersions.eventType, eventType),
          eq(policyVersions.framework, framework),
          eq(policyVersions.status, 'active')
        ));
      
      // Insert new policy version
      const [newPolicy] = await db.insert(policyVersions).values({
        version,
        eventType,
        framework,
        encryptedRuleLogic,
        ruleHash,
        status: 'active',
        createdBy,
      }).returning();
      
      // Log the policy change
      await db.insert(policyChangeLogs).values({
        policyVersionId: newPolicy.id,
        changeType: 'created',
        newVersion: version,
        changeReason,
        changedBy: createdBy,
        approvedAt: new Date(), // Auto-approve for now (can add approval workflow later)
      });
      
      logger.info({
        policyVersionId: newPolicy.id,
        eventType,
        framework,
        version,
      }, 'Policy version created successfully');
      
      return newPolicy.id;
    } catch (error) {
      logger.error({ error, eventType, framework }, 'Failed to create policy version');
      throw error;
    }
  }
  
  /**
   * Get active policy for event type + framework
   */
  async getActivePolicy(eventType: string, framework: string): Promise<PolicyRuleLogic | null> {
    try {
      const [policy] = await db.select()
        .from(policyVersions)
        .where(and(
          eq(policyVersions.eventType, eventType),
          eq(policyVersions.framework, framework),
          eq(policyVersions.status, 'active')
        ))
        .limit(1);
      
      if (!policy) {
        logger.warn({ eventType, framework }, 'No active policy found');
        return null;
      }
      
      // Decrypt the rule logic
      const ruleLogic = decryptPolicyLogic(policy.encryptedRuleLogic) as PolicyRuleLogic;
      
      // Verify integrity
      const isValid = verifyPolicyIntegrity(ruleLogic, policy.ruleHash);
      if (!isValid) {
        logger.error({ policyVersionId: policy.id }, 'Policy integrity verification failed - possible tampering');
        throw new Error('Policy integrity compromised');
      }
      
      logger.info({
        policyVersionId: policy.id,
        eventType,
        framework,
        version: policy.version,
      }, 'Active policy retrieved and verified');
      
      return ruleLogic;
    } catch (error) {
      logger.error({ error, eventType, framework }, 'Failed to get active policy');
      throw error;
    }
  }
  
  /**
   * Batch seed initial policies from existing static mapping
   * (Migration helper - converts static rules to encrypted DB policies)
   */
  async seedPoliciesFromStaticMapping(
    policies: Array<{
      eventType: string;
      framework: string;
      version: string;
      ruleLogic: PolicyRuleLogic;
    }>,
    seedUserId: string
  ): Promise<number> {
    let seededCount = 0;
    
    for (const policy of policies) {
      try {
        await this.createPolicyVersion(
          policy.eventType,
          policy.framework,
          policy.version,
          policy.ruleLogic,
          seedUserId,
          'Initial policy seed from static mapping'
        );
        seededCount++;
      } catch (error) {
        logger.warn({ error, eventType: policy.eventType }, 'Failed to seed policy (may already exist)');
      }
    }
    
    logger.info({ seededCount, total: policies.length }, 'Policy seeding complete');
    return seededCount;
  }
  
  /**
   * Get policy change history (for M&A due diligence)
   */
  async getPolicyHistory(eventType: string, framework: string): Promise<any[]> {
    const policies = await db.select()
      .from(policyVersions)
      .where(and(
        eq(policyVersions.eventType, eventType),
        eq(policyVersions.framework, framework)
      ))
      .orderBy(policyVersions.createdAt);
    
    return policies.map(p => ({
      version: p.version,
      status: p.status,
      effectiveDate: p.effectiveDate,
      deprecatedDate: p.deprecatedDate,
      ruleHash: p.ruleHash, // Show hash but not decrypted logic (security)
    }));
  }
}

export const policyVersioningService = new PolicyVersioningService();
