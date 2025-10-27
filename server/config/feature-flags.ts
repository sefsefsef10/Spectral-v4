/**
 * Feature flags for gradual rollout of new features
 * 
 * This allows us to:
 * - Deploy code without exposing it to users
 * - Test in production with a subset of users
 * - Roll back instantly without code changes
 * - A/B test different implementations
 */

export interface FeatureFlags {
  // Clean Architecture Billing System
  // Phase 3: Refactored subscription management with domain-driven design
  useCleanArchitectureBilling: boolean;
  
  // Future flags:
  // useCleanArchitecturePolicies: boolean;
  // useCleanArchitectureAISystems: boolean;
}

/**
 * Default feature flags (development environment)
 */
const defaultFlags: FeatureFlags = {
  // Temporarily disabled until import paths are fixed
  useCleanArchitectureBilling: false,
};

/**
 * Production feature flags (override via environment variables)
 */
const productionFlags: FeatureFlags = {
  useCleanArchitectureBilling: process.env.FEATURE_CLEAN_BILLING === 'true',
};

/**
 * Get current feature flags based on environment
 */
export function getFeatureFlags(): FeatureFlags {
  const isProd = process.env.NODE_ENV === 'production';
  return isProd ? productionFlags : defaultFlags;
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[feature];
}

/**
 * Feature flag middleware for Express routes
 * Returns 503 Service Unavailable if feature is disabled
 */
export function requireFeature(feature: keyof FeatureFlags) {
  return (req: any, res: any, next: any) => {
    if (isFeatureEnabled(feature)) {
      next();
    } else {
      res.status(503).json({
        error: 'Feature not available',
        message: `The ${feature} feature is currently disabled`,
      });
    }
  };
}
