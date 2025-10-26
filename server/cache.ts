import { Redis } from '@upstash/redis';
import { logger } from './logger';

// Upstash Redis client for caching compliance data
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in environment
let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  logger.info('Redis cache initialized');
} else {
  logger.warn('Redis cache disabled (no credentials)');
}

// Cache TTLs (in seconds)
export const CACHE_TTL = {
  COMPLIANCE_CONTROLS: 60 * 60 * 24, // 24 hours (rarely changes)
  COMPLIANCE_MAPPINGS: 60 * 60, // 1 hour
  HEALTH_SYSTEM: 60 * 15, // 15 minutes
  VENDOR: 60 * 15, // 15 minutes
  AI_SYSTEMS: 60 * 5, // 5 minutes (changes frequently)
  ANALYTICS: 60 * 30, // 30 minutes
} as const;

// Cache key prefixes
const KEYS = {
  COMPLIANCE_CONTROL: (id: string) => `compliance:control:${id}`,
  COMPLIANCE_CONTROLS_ALL: () => 'compliance:controls:all',
  COMPLIANCE_MAPPING: (aiSystemId: string) => `compliance:mapping:${aiSystemId}`,
  HEALTH_SYSTEM: (id: string) => `health_system:${id}`,
  VENDOR: (id: string) => `vendor:${id}`,
  AI_SYSTEM: (id: string) => `ai_system:${id}`,
  ANALYTICS: (healthSystemId: string) => `analytics:${healthSystemId}`,
} as const;

export class CacheService {
  /**
   * Get value from cache
   */
  static async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    
    try {
      const value = await redis.get<T>(key);
      return value;
    } catch (error) {
      logger.error({ err: error, key }, 'Redis get error');
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  static async set(key: string, value: any, ttl: number): Promise<void> {
    if (!redis) return;
    
    try {
      await redis.set(key, value, { ex: ttl });
    } catch (error) {
      logger.error({ err: error, key, ttl }, 'Redis set error');
    }
  }

  /**
   * Set value in cache with TTL only if key doesn't exist (for distributed locking)
   * Returns true if lock acquired, false if already exists
   */
  static async setNX(key: string, value: any, ttl: number): Promise<boolean> {
    if (!redis) return true; // No Redis = no distributed locking needed (single instance)
    
    try {
      const result = await redis.set(key, value, { ex: ttl, nx: true });
      return result === 'OK';
    } catch (error) {
      logger.error({ err: error, key, ttl }, 'Redis setNX error');
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  static async del(key: string): Promise<void> {
    if (!redis) return;
    
    try {
      await redis.del(key);
    } catch (error) {
      logger.error({ err: error, key }, 'Redis del error');
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  static async delPattern(pattern: string): Promise<void> {
    if (!redis) return;
    
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error({ err: error, pattern }, 'Redis delPattern error');
    }
  }

  // Compliance Controls
  static async getComplianceControl(id: string) {
    return this.get(KEYS.COMPLIANCE_CONTROL(id));
  }

  static async setComplianceControl(id: string, control: any) {
    return this.set(KEYS.COMPLIANCE_CONTROL(id), control, CACHE_TTL.COMPLIANCE_CONTROLS);
  }

  static async getAllComplianceControls() {
    return this.get(KEYS.COMPLIANCE_CONTROLS_ALL());
  }

  static async setAllComplianceControls(controls: any[]) {
    return this.set(KEYS.COMPLIANCE_CONTROLS_ALL(), controls, CACHE_TTL.COMPLIANCE_CONTROLS);
  }

  static async invalidateComplianceControls() {
    await this.delPattern('compliance:control:*');
    await this.del(KEYS.COMPLIANCE_CONTROLS_ALL());
  }

  // Compliance Mappings
  static async getComplianceMapping(aiSystemId: string) {
    return this.get(KEYS.COMPLIANCE_MAPPING(aiSystemId));
  }

  static async setComplianceMapping(aiSystemId: string, mappings: any) {
    return this.set(KEYS.COMPLIANCE_MAPPING(aiSystemId), mappings, CACHE_TTL.COMPLIANCE_MAPPINGS);
  }

  static async invalidateComplianceMapping(aiSystemId: string) {
    return this.del(KEYS.COMPLIANCE_MAPPING(aiSystemId));
  }

  // Health Systems
  static async getHealthSystem(id: string) {
    return this.get(KEYS.HEALTH_SYSTEM(id));
  }

  static async setHealthSystem(id: string, healthSystem: any) {
    return this.set(KEYS.HEALTH_SYSTEM(id), healthSystem, CACHE_TTL.HEALTH_SYSTEM);
  }

  static async invalidateHealthSystem(id: string) {
    return this.del(KEYS.HEALTH_SYSTEM(id));
  }

  // Vendors
  static async getVendor(id: string) {
    return this.get(KEYS.VENDOR(id));
  }

  static async setVendor(id: string, vendor: any) {
    return this.set(KEYS.VENDOR(id), vendor, CACHE_TTL.VENDOR);
  }

  static async invalidateVendor(id: string) {
    return this.del(KEYS.VENDOR(id));
  }

  // AI Systems
  static async getAISystem(id: string) {
    return this.get(KEYS.AI_SYSTEM(id));
  }

  static async setAISystem(id: string, aiSystem: any) {
    return this.set(KEYS.AI_SYSTEM(id), aiSystem, CACHE_TTL.AI_SYSTEMS);
  }

  static async invalidateAISystem(id: string) {
    return this.del(KEYS.AI_SYSTEM(id));
  }

  // Analytics
  static async getAnalytics(healthSystemId: string) {
    return this.get(KEYS.ANALYTICS(healthSystemId));
  }

  static async setAnalytics(healthSystemId: string, analytics: any) {
    return this.set(KEYS.ANALYTICS(healthSystemId), analytics, CACHE_TTL.ANALYTICS);
  }

  static async invalidateAnalytics(healthSystemId: string) {
    return this.del(KEYS.ANALYTICS(healthSystemId));
  }
}
