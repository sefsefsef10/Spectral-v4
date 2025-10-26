/**
 * Scoring Pipeline Health Monitoring
 * 
 * Monitors the health of all scoring services and surfaces degraded states
 * automatically before M&A due diligence demos.
 * 
 * Critical for acquisition readiness: Technical DD teams need visibility into
 * when scoring data is stale/missing so they don't discover it during demos.
 */

import { logger } from "../../logger";
import { storage } from "../../storage";

export interface ScoringHealthStatus {
  healthy: boolean;
  services: {
    phiRisk: ServiceHealth;
    clinicalSafety: ServiceHealth;
    compliance: ServiceHealth;
    operational: ServiceHealth;
  };
  degradedServices: number;
  criticalIssues: string[];
  lastChecked: Date;
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'failed';
  telemetryAge: number; // hours
  eventCount: number;
  dataQuality: 'fresh' | 'stale' | 'missing';
  lastUpdate: Date | null;
  issues: string[];
}

/**
 * Check health of a specific scoring service
 */
async function checkServiceHealth(
  aiSystemId: string,
  serviceName: 'phi-risk' | 'clinical-safety' | 'compliance' | 'operational'
): Promise<ServiceHealth> {
  try {
    const events = await storage.getAITelemetryEvents(aiSystemId);
    
    if (events.length === 0) {
      return {
        status: 'degraded',
        telemetryAge: Infinity,
        eventCount: 0,
        dataQuality: 'missing',
        lastUpdate: null,
        issues: ['No telemetry data available'],
      };
    }

    // Find most recent event
    const sortedEvents = events.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latestEvent = sortedEvents[0];
    const lastUpdate = new Date(latestEvent.createdAt);
    
    // Calculate telemetry age in hours
    const ageMs = Date.now() - lastUpdate.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'failed' = 'healthy';
    let dataQuality: 'fresh' | 'stale' | 'missing' = 'fresh';
    
    // Check for stale data (>7 days)
    if (ageHours > 168) { // 7 days
      issues.push(`Telemetry is ${Math.round(ageHours / 24)} days old`);
      dataQuality = 'stale';
      status = 'degraded';
    }
    
    // Check for very old data (>30 days)
    if (ageHours > 720) { // 30 days
      issues.push(`Critical: Telemetry is ${Math.round(ageHours / 24)} days old - system may be inactive`);
      dataQuality = 'missing';
      status = 'failed';
    }
    
    // Check event count thresholds
    const recentEvents = events.filter((e: any) => {
      const eventAge = Date.now() - new Date(e.createdAt).getTime();
      return eventAge < (7 * 24 * 60 * 60 * 1000); // Last 7 days
    });
    
    if (recentEvents.length < 10) {
      issues.push(`Low event volume: ${recentEvents.length} events in last 7 days`);
      if (status === 'healthy') status = 'degraded';
    }
    
    return {
      status,
      telemetryAge: ageHours,
      eventCount: events.length,
      dataQuality,
      lastUpdate,
      issues,
    };
  } catch (error) {
    logger.error({ error, aiSystemId, serviceName }, 'Failed to check service health');
    return {
      status: 'failed',
      telemetryAge: Infinity,
      eventCount: 0,
      dataQuality: 'missing',
      lastUpdate: null,
      issues: ['Health check failed - unable to assess service'],
    };
  }
}

/**
 * Check overall scoring pipeline health
 */
export async function checkScoringHealth(aiSystemId: string): Promise<ScoringHealthStatus> {
  try {
    // Check all scoring services in parallel
    const [phiRisk, clinicalSafety, compliance, operational] = await Promise.all([
      checkServiceHealth(aiSystemId, 'phi-risk'),
      checkServiceHealth(aiSystemId, 'clinical-safety'),
      checkServiceHealth(aiSystemId, 'compliance'),
      checkServiceHealth(aiSystemId, 'operational'),
    ]);

    const services = { phiRisk, clinicalSafety, compliance, operational };
    
    // Count degraded services
    const degradedServices = Object.values(services).filter(
      s => s.status === 'degraded' || s.status === 'failed'
    ).length;
    
    // Collect critical issues
    const criticalIssues: string[] = [];
    Object.entries(services).forEach(([name, health]) => {
      if (health.status === 'failed') {
        criticalIssues.push(`${name}: ${health.issues.join(', ')}`);
      }
    });
    
    const healthy = degradedServices === 0;
    
    // Log warning if any service is unhealthy
    if (!healthy) {
      logger.warn({
        aiSystemId,
        degradedServices,
        criticalIssues,
      }, 'Scoring pipeline health degraded - grades may be unreliable');
    }
    
    return {
      healthy,
      services,
      degradedServices,
      criticalIssues,
      lastChecked: new Date(),
    };
  } catch (error) {
    logger.error({ error, aiSystemId }, 'Failed to check scoring health');
    throw error;
  }
}

/**
 * Check portfolio-wide scoring health
 */
export async function checkPortfolioScoringHealth(healthSystemId: string): Promise<{
  healthy: boolean;
  totalSystems: number;
  healthySystems: number;
  degradedSystems: number;
  failedSystems: number;
  criticalIssues: string[];
}> {
  try {
    const systems = await storage.getAISystems(healthSystemId);
    
    if (systems.length === 0) {
      return {
        healthy: true,
        totalSystems: 0,
        healthySystems: 0,
        degradedSystems: 0,
        failedSystems: 0,
        criticalIssues: [],
      };
    }
    
    // Check health for each system
    const healthChecks = await Promise.all(
      systems.map((sys: any) => checkScoringHealth(sys.id))
    );
    
    const healthySystems = healthChecks.filter(h => h.healthy).length;
    const degradedSystems = healthChecks.filter(h => !h.healthy && h.degradedServices > 0).length;
    const failedSystems = healthChecks.filter(h => h.criticalIssues.length > 0).length;
    
    // Collect all critical issues
    const criticalIssues = healthChecks
      .flatMap(h => h.criticalIssues)
      .slice(0, 10); // Limit to top 10
    
    const healthy = degradedSystems === 0 && failedSystems === 0;
    
    if (!healthy) {
      logger.warn({
        healthSystemId,
        totalSystems: systems.length,
        healthySystems,
        degradedSystems,
        failedSystems,
      }, 'Portfolio scoring health degraded');
    }
    
    return {
      healthy,
      totalSystems: systems.length,
      healthySystems,
      degradedSystems,
      failedSystems,
      criticalIssues,
    };
  } catch (error) {
    logger.error({ error, healthSystemId }, 'Failed to check portfolio scoring health');
    throw error;
  }
}
