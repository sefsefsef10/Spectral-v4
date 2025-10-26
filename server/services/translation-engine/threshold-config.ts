/**
 * Translation Engine - Configurable Thresholds
 * 
 * Per-organization threshold configuration for compliance violations.
 * Allows health systems to customize sensitivity based on their risk tolerance.
 */

import { logger } from "../../logger";
import { storage } from "../../storage";

/**
 * Default thresholds used if not overridden by health system
 */
export const DEFAULT_THRESHOLDS = {
  // Drift/Performance
  drift: {
    accuracyDropMedium: 0.05, // 5% accuracy drop triggers medium severity
    accuracyDropHigh: 0.10, // 10% triggers high severity
    accuracyDropFDA: 0.10, // 10% triggers FDA reporting
  },
  
  // Bias/Fairness
  bias: {
    varianceMedium: 0.05, // 5% demographic variance
    varianceHigh: 0.10, // 10% variance
    varianceNYC: 0.04, // NYC Local Law 144 threshold
  },
  
  // Latency
  latency: {
    increaseMedium: 0.15, // 15% latency increase
    increaseHigh: 0.30, // 30% increase
  },
  
  // Error Rate
  error: {
    rateMedium: 0.01, // 1% error rate
    rateHigh: 0.05, // 5% error rate
    rateFDA: 0.02, // 2% triggers FDA reporting
  }
} as const;

export type ThresholdConfig = typeof DEFAULT_THRESHOLDS;

/**
 * Cache for threshold configurations (in production, use Redis)
 * Key: healthSystemId, Value: ThresholdConfig
 */
const thresholdCache = new Map<string, ThresholdConfig>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

/**
 * Get threshold configuration for a health system
 * 
 * Loads from database settings and caches for performance.
 * Falls back to defaults if no custom configuration exists.
 */
export async function getThresholds(healthSystemId: string): Promise<ThresholdConfig> {
  // Check cache first
  const cached = thresholdCache.get(healthSystemId);
  const cacheTime = cacheTimestamps.get(healthSystemId);
  
  if (cached && cacheTime && (Date.now() - cacheTime < CACHE_TTL_MS)) {
    return cached;
  }
  
  try {
    // Load health system settings
    const healthSystem = await storage.getHealthSystem(healthSystemId);
    
    if (!healthSystem || !healthSystem.settings) {
      // No custom config, use defaults
      thresholdCache.set(healthSystemId, DEFAULT_THRESHOLDS);
      cacheTimestamps.set(healthSystemId, Date.now());
      return DEFAULT_THRESHOLDS;
    }
    
    // Parse settings (stored as JSONB)
    const settings = typeof healthSystem.settings === 'string' 
      ? JSON.parse(healthSystem.settings) 
      : healthSystem.settings;
    
    // Merge custom thresholds with defaults
    const customThresholds = settings.complianceThresholds || {};
    const merged: ThresholdConfig = {
      drift: { ...DEFAULT_THRESHOLDS.drift, ...customThresholds.drift },
      bias: { ...DEFAULT_THRESHOLDS.bias, ...customThresholds.bias },
      latency: { ...DEFAULT_THRESHOLDS.latency, ...customThresholds.latency },
      error: { ...DEFAULT_THRESHOLDS.error, ...customThresholds.error },
    };
    
    // Cache the result
    thresholdCache.set(healthSystemId, merged);
    cacheTimestamps.set(healthSystemId, Date.now());
    
    logger.debug({ 
      healthSystemId, 
      hasCustomThresholds: !!settings.complianceThresholds 
    }, 'Loaded threshold configuration');
    
    return merged;
  } catch (error) {
    logger.error({ err: error, healthSystemId }, 'Failed to load thresholds, using defaults');
    return DEFAULT_THRESHOLDS;
  }
}

/**
 * Clear cache for a specific health system (call after updating settings)
 */
export function clearThresholdCache(healthSystemId?: string): void {
  if (healthSystemId) {
    thresholdCache.delete(healthSystemId);
    cacheTimestamps.delete(healthSystemId);
    logger.debug({ healthSystemId }, 'Cleared threshold cache');
  } else {
    // Clear entire cache
    thresholdCache.clear();
    cacheTimestamps.clear();
    logger.debug('Cleared all threshold caches');
  }
}

/**
 * Validate threshold configuration
 * Ensures all threshold values are positive numbers in valid ranges
 */
export function validateThresholds(thresholds: Partial<ThresholdConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Helper to validate numeric threshold
  const validateNumber = (value: any, name: string, min: number, max: number) => {
    if (typeof value !== 'number') {
      errors.push(`${name} must be a number`);
    } else if (value < min || value > max) {
      errors.push(`${name} must be between ${min} and ${max}`);
    }
  };
  
  // Validate drift thresholds
  if (thresholds.drift) {
    if (thresholds.drift.accuracyDropMedium !== undefined) {
      validateNumber(thresholds.drift.accuracyDropMedium, 'drift.accuracyDropMedium', 0.01, 0.5);
    }
    if (thresholds.drift.accuracyDropHigh !== undefined) {
      validateNumber(thresholds.drift.accuracyDropHigh, 'drift.accuracyDropHigh', 0.01, 0.5);
    }
    if (thresholds.drift.accuracyDropFDA !== undefined) {
      validateNumber(thresholds.drift.accuracyDropFDA, 'drift.accuracyDropFDA', 0.01, 0.5);
    }
  }
  
  // Validate bias thresholds
  if (thresholds.bias) {
    if (thresholds.bias.varianceMedium !== undefined) {
      validateNumber(thresholds.bias.varianceMedium, 'bias.varianceMedium', 0.01, 0.5);
    }
    if (thresholds.bias.varianceHigh !== undefined) {
      validateNumber(thresholds.bias.varianceHigh, 'bias.varianceHigh', 0.01, 0.5);
    }
    if (thresholds.bias.varianceNYC !== undefined) {
      validateNumber(thresholds.bias.varianceNYC, 'bias.varianceNYC', 0.01, 0.5);
    }
  }
  
  // Validate latency thresholds
  if (thresholds.latency) {
    if (thresholds.latency.increaseMedium !== undefined) {
      validateNumber(thresholds.latency.increaseMedium, 'latency.increaseMedium', 0.01, 2.0);
    }
    if (thresholds.latency.increaseHigh !== undefined) {
      validateNumber(thresholds.latency.increaseHigh, 'latency.increaseHigh', 0.01, 2.0);
    }
  }
  
  // Validate error thresholds
  if (thresholds.error) {
    if (thresholds.error.rateMedium !== undefined) {
      validateNumber(thresholds.error.rateMedium, 'error.rateMedium', 0.001, 0.5);
    }
    if (thresholds.error.rateHigh !== undefined) {
      validateNumber(thresholds.error.rateHigh, 'error.rateHigh', 0.001, 0.5);
    }
    if (thresholds.error.rateFDA !== undefined) {
      validateNumber(thresholds.error.rateFDA, 'error.rateFDA', 0.001, 0.5);
    }
  }
  
  return { valid: errors.length === 0, errors };
}
