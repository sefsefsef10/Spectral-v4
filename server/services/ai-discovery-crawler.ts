/**
 * 🔍 AI DISCOVERY CRAWLER - Phase 4 Business Model
 * 
 * Automated discovery of AI systems across healthcare infrastructure
 * Helps health systems build complete AI inventory
 */

import { db } from "../db";
import {
  aiDiscoveryJobs,
  aiSystems,
  healthSystems,
} from "../../shared/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "../logger";

export interface DiscoveryJobRequest {
  healthSystemId: string;
  discoveryType: 'ehr_scan' | 'vendor_survey' | 'api_crawler' | 'manual_import';
  dataSource?: string;
  createdBy: string;
}

export interface DiscoveryJob {
  id: string;
  healthSystemId: string;
  discoveryType: string;
  dataSource?: string | null;
  status: string;
  aiSystemsFound: number;
  aiSystemsNew: number;
  aiSystemsUpdated: number;
  results?: any;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdBy: string;
  createdAt: Date;
}

export interface DiscoveredAISystem {
  name: string;
  department: string;
  vendor?: string;
  category?: string;
  description?: string;
  discoverySource: string;
  confidence: number; // 0-1 score of how confident we are this is an AI system
}

export class AIDiscoveryCrawler {
  /**
   * Start a new discovery job
   */
  async startDiscovery(request: DiscoveryJobRequest): Promise<DiscoveryJob> {
    logger.info({
      healthSystemId: request.healthSystemId,
      discoveryType: request.discoveryType,
    }, "Starting AI discovery job");

    const created = await db
      .insert(aiDiscoveryJobs)
      .values({
        healthSystemId: request.healthSystemId,
        discoveryType: request.discoveryType,
        dataSource: request.dataSource,
        status: 'pending',
        aiSystemsFound: 0,
        aiSystemsNew: 0,
        aiSystemsUpdated: 0,
        createdBy: request.createdBy,
      })
      .returning();

    const job = this.formatJob(created[0]);

    // Execute discovery async (in production, would be background job)
    this.executeDiscovery(job.id).catch(error => {
      logger.error({
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, "Discovery job failed");
    });

    return job;
  }

  /**
   * Execute discovery job
   */
  private async executeDiscovery(jobId: string): Promise<void> {
    // Update status to running
    await db
      .update(aiDiscoveryJobs)
      .set({
        status: 'running',
        startedAt: new Date(),
      })
      .where(eq(aiDiscoveryJobs.id, jobId));

    try {
      const job = await db
        .select()
        .from(aiDiscoveryJobs)
        .where(eq(aiDiscoveryJobs.id, jobId))
        .limit(1);

      if (job.length === 0) {
        throw new Error("Job not found");
      }

      const discoveryJob = job[0];
      let discovered: DiscoveredAISystem[] = [];

      // Execute discovery based on type
      switch (discoveryJob.discoveryType) {
        case 'ehr_scan':
          discovered = await this.scanEHRIntegrations(discoveryJob.healthSystemId);
          break;
        case 'vendor_survey':
          discovered = await this.scanVendorSurveys(discoveryJob.healthSystemId);
          break;
        case 'api_crawler':
          discovered = await this.crawlAPIEndpoints(discoveryJob.dataSource || '');
          break;
        case 'manual_import':
          discovered = await this.processManualImport(discoveryJob.dataSource || '');
          break;
        default:
          logger.warn({ type: discoveryJob.discoveryType }, "Unknown discovery type");
      }

      // Filter high-confidence discoveries
      const highConfidence = discovered.filter(d => d.confidence >= 0.7);

      // Match against existing AI systems
      const existing = await db
        .select()
        .from(aiSystems)
        .where(eq(aiSystems.healthSystemId, discoveryJob.healthSystemId));

      const existingNames = new Set(existing.map(s => s.name.toLowerCase()));

      let newCount = 0;
      let updatedCount = 0;

      // Create or update AI systems
      for (const system of highConfidence) {
        if (existingNames.has(system.name.toLowerCase())) {
          // System already exists - could update metadata
          updatedCount++;
        } else {
          // New system - create it
          await db.insert(aiSystems).values({
            healthSystemId: discoveryJob.healthSystemId,
            name: system.name,
            department: system.department,
            riskLevel: 'medium', // Default risk level
            status: 'pending_review', // Requires human review
            integrationConfig: JSON.stringify({
              discoverySource: system.discoverySource,
              confidence: system.confidence,
              vendor: system.vendor,
              category: system.category,
            }),
          });
          newCount++;
        }
      }

      // Update job with results
      await db
        .update(aiDiscoveryJobs)
        .set({
          status: 'completed',
          aiSystemsFound: discovered.length,
          aiSystemsNew: newCount,
          aiSystemsUpdated: updatedCount,
          results: JSON.stringify({
            discovered: highConfidence.map(d => ({
              name: d.name,
              department: d.department,
              vendor: d.vendor,
              confidence: d.confidence,
            })),
          }),
          completedAt: new Date(),
        })
        .where(eq(aiDiscoveryJobs.id, jobId));

      logger.info({
        jobId,
        found: discovered.length,
        new: newCount,
        updated: updatedCount,
      }, "Discovery job completed successfully");
    } catch (error) {
      // Mark job as failed
      await db
        .update(aiDiscoveryJobs)
        .set({
          status: 'failed',
          completedAt: new Date(),
        })
        .where(eq(aiDiscoveryJobs.id, jobId));

      throw error;
    }
  }

  /**
   * Scan EHR integrations for AI systems
   * Connects to Epic/Cerner/Athenahealth FHIR APIs
   */
  private async scanEHRIntegrations(healthSystemId: string): Promise<DiscoveredAISystem[]> {
    logger.info({ healthSystemId }, "Scanning EHR integrations");

    const discovered: DiscoveredAISystem[] = [];

    try {
      // Get Epic FHIR credentials from provider_connections
      const { epicFHIRService } = await import("./epic-fhir-service");
      const { db } = await import("../db");
      const { providerConnections } = await import("../../shared/schema");
      const { eq, and } = await import("drizzle-orm");

      // SECURITY: Use and() to combine predicates properly - .where() chains overwrite each other in Drizzle
      const [connection] = await db
        .select()
        .from(providerConnections)
        .where(and(
          eq(providerConnections.healthSystemId, healthSystemId),
          eq(providerConnections.providerType, 'epic_fhir'),
          eq(providerConnections.connectionStatus, 'active')
        ));

      if (connection && connection.credentials) {
        // Decrypt credentials
        const { decryptFields } = await import("../encryption");
        const decrypted = decryptFields(
          { credentials: connection.credentials },
          ['credentials']
        );
        const creds = JSON.parse(decrypted.credentials);

        // Query Epic FHIR Device API
        const epicDevices = await epicFHIRService.discoverAISystems({
          clientId: creds.clientId,
          privateKey: creds.privateKey,
          tokenUrl: creds.tokenUrl || 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
          fhirBaseUrl: creds.fhirBaseUrl || 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
        });

        discovered.push(...epicDevices);
        logger.info({ 
          healthSystemId, 
          count: epicDevices.length 
        }, "Epic FHIR discovery complete");
      } else {
        logger.info({ healthSystemId }, "No active Epic FHIR connection found");
      }

      // Future: Add Cerner, Athenahealth support here
      // Similar pattern: check for provider_connections, decrypt, query FHIR API

      return discovered;
    } catch (error) {
      logger.error({ err: error, healthSystemId }, "EHR integration scan failed");
      
      // Fallback to empty array if FHIR discovery fails
      // Don't block entire discovery job due to FHIR errors
      return [];
    }
  }

  /**
   * Scan vendor survey responses
   */
  private async scanVendorSurveys(healthSystemId: string): Promise<DiscoveredAISystem[]> {
    logger.info({ healthSystemId }, "Scanning vendor surveys");

    // Mock discovery - in production, would parse survey responses
    const mockDiscovered: DiscoveredAISystem[] = [
      {
        name: "Patient Flow Optimizer",
        department: "Operations",
        vendor: "LeanTaaS",
        category: "Operations Optimization",
        description: "AI-driven patient flow and capacity planning",
        discoverySource: "Vendor Survey Response",
        confidence: 0.8,
      },
      {
        name: "Revenue Cycle AI",
        department: "Finance",
        vendor: "Change Healthcare",
        category: "Revenue Cycle",
        description: "AI for claims processing and denial management",
        discoverySource: "Vendor Survey Response",
        confidence: 0.75,
      },
    ];

    return mockDiscovered;
  }

  /**
   * Crawl API endpoints for AI services
   */
  private async crawlAPIEndpoints(baseUrl: string): Promise<DiscoveredAISystem[]> {
    logger.info({ baseUrl }, "Crawling API endpoints");

    // Mock discovery - in production, would crawl API documentation
    const mockDiscovered: DiscoveredAISystem[] = [
      {
        name: "API AI Service (Detected)",
        department: "IT",
        category: "API Service",
        description: "AI service detected via API crawl",
        discoverySource: `API Crawler: ${baseUrl}`,
        confidence: 0.65,
      },
    ];

    return mockDiscovered;
  }

  /**
   * Process manual import (CSV/Excel)
   */
  private async processManualImport(importData: string): Promise<DiscoveredAISystem[]> {
    logger.info("Processing manual import");

    // Mock - in production, would parse CSV/Excel
    // For now, return empty array
    return [];
  }

  /**
   * Get all discovery jobs for a health system
   */
  async getJobs(healthSystemId: string): Promise<DiscoveryJob[]> {
    const results = await db
      .select()
      .from(aiDiscoveryJobs)
      .where(eq(aiDiscoveryJobs.healthSystemId, healthSystemId))
      .orderBy(desc(aiDiscoveryJobs.createdAt));

    return results.map(j => this.formatJob(j));
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<DiscoveryJob | null> {
    const results = await db
      .select()
      .from(aiDiscoveryJobs)
      .where(eq(aiDiscoveryJobs.id, jobId))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return this.formatJob(results[0]);
  }

  /**
   * Get discovery statistics
   */
  async getDiscoveryStats(healthSystemId: string): Promise<{
    totalJobs: number;
    completedJobs: number;
    totalSystemsFound: number;
    totalSystemsAdded: number;
    averageConfidence: number;
    bySource: Record<string, number>;
  }> {
    const jobs = await this.getJobs(healthSystemId);

    const completed = jobs.filter(j => j.status === 'completed');
    const totalSystemsFound = completed.reduce((sum, j) => sum + j.aiSystemsFound, 0);
    const totalSystemsAdded = completed.reduce((sum, j) => sum + j.aiSystemsNew, 0);

    const bySource: Record<string, number> = {};
    jobs.forEach(j => {
      bySource[j.discoveryType] = (bySource[j.discoveryType] || 0) + 1;
    });

    return {
      totalJobs: jobs.length,
      completedJobs: completed.length,
      totalSystemsFound,
      totalSystemsAdded,
      averageConfidence: 0.82, // Mock - would calculate from results
      bySource,
    };
  }

  /**
   * Format job for output
   */
  private formatJob(job: any): DiscoveryJob {
    return {
      id: job.id,
      healthSystemId: job.healthSystemId,
      discoveryType: job.discoveryType,
      dataSource: job.dataSource,
      status: job.status,
      aiSystemsFound: job.aiSystemsFound,
      aiSystemsNew: job.aiSystemsNew,
      aiSystemsUpdated: job.aiSystemsUpdated,
      results: typeof job.results === 'string' ? JSON.parse(job.results) : job.results,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdBy: job.createdBy,
      createdAt: job.createdAt,
    };
  }

  /**
   * Classify AI system category from description
   * ML-based classification would be used in production
   */
  private classifyAICategory(description: string): string {
    const desc = description.toLowerCase();

    if (desc.includes('clinical') || desc.includes('diagnosis')) return 'Clinical Decision Support';
    if (desc.includes('imaging') || desc.includes('radiology')) return 'Medical Imaging';
    if (desc.includes('sepsis') || desc.includes('risk score')) return 'Risk Prediction';
    if (desc.includes('revenue') || desc.includes('billing')) return 'Revenue Cycle';
    if (desc.includes('flow') || desc.includes('capacity')) return 'Operations Optimization';
    if (desc.includes('documentation')) return 'Administrative';

    return 'Other';
  }

  /**
   * Calculate confidence score for discovered system
   * In production, would use ML model
   */
  private calculateConfidence(source: string, metadata: any): number {
    // Higher confidence for official sources
    if (source.includes('Epic') || source.includes('Cerner')) return 0.9;
    if (source.includes('Vendor Survey')) return 0.8;
    if (source.includes('API')) return 0.7;

    return 0.6;
  }
}

export const aiDiscoveryCrawler = new AIDiscoveryCrawler();
