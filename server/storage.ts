import { 
  users, 
  userInvitations,
  auditLogs,
  healthSystems,
  vendors,
  vendorApiKeys,
  aiSystems,
  monitoringAlerts,
  predictiveAlerts,
  deployments,
  complianceCertifications,
  complianceTemplates,
  complianceMappings,
  complianceReports,
  aiTelemetryEvents,
  complianceViolations,
  requiredActions,
  backgroundJobs,
  certificationApplications,
  vendorTestResults,
  type User, 
  type InsertUser,
  type UserInvitation,
  type InsertUserInvitation,
  type AuditLog,
  type InsertAuditLog,
  type HealthSystem,
  type InsertHealthSystem,
  type Vendor,
  type InsertVendor,
  type VendorApiKey,
  type InsertVendorApiKey,
  type AISystem,
  type InsertAISystem,
  type MonitoringAlert,
  type InsertMonitoringAlert,
  type PredictiveAlert,
  type InsertPredictiveAlert,
  type Deployment,
  type InsertDeployment,
  type ComplianceCertification,
  type InsertComplianceCertification,
  type ComplianceTemplate,
  type ComplianceMapping,
  type InsertComplianceMapping,
  type ComplianceReport,
  type InsertComplianceReport,
  type AITelemetryEvent,
  type InsertAITelemetryEvent,
  type ComplianceViolation,
  type InsertComplianceViolation,
  type RequiredAction,
  type InsertRequiredAction,
  type BackgroundJob,
  type InsertBackgroundJob,
  type CertificationApplication,
  type InsertCertificationApplication,
  type VendorTestResult,
  type InsertVendorTestResult,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import { CacheService } from "./cache";
import { encryptFields, decryptFields } from "./services/encryption";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  getUsersByOrganization(healthSystemId?: string, vendorId?: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  updateUserLastLogin(id: string): Promise<void>;

  // User Invitation operations
  createUserInvitation(invitation: InsertUserInvitation): Promise<UserInvitation>;
  getUserInvitation(id: string): Promise<UserInvitation | undefined>;
  getUserInvitationByTokenHash(tokenHash: string): Promise<UserInvitation | undefined>;
  getUserInvitationsByOrganization(healthSystemId?: string, vendorId?: string): Promise<UserInvitation[]>;
  acceptUserInvitation(id: string): Promise<void>;
  expireUserInvitation(id: string): Promise<void>;

  // Audit Log operations
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    resourceType?: string;
    healthSystemId?: string;
    vendorId?: string;
    limit?: number;
  }): Promise<AuditLog[]>;

  // Health System operations
  getHealthSystem(id: string): Promise<HealthSystem | undefined>;
  createHealthSystem(healthSystem: InsertHealthSystem): Promise<HealthSystem>;
  updateHealthSystem(id: string, data: Partial<InsertHealthSystem>): Promise<void>;

  // Vendor operations
  getVendor(id: string): Promise<Vendor | undefined>;
  getVendors(): Promise<Vendor[]>;
  getPublicVendors(): Promise<Vendor[]>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, data: Partial<InsertVendor>): Promise<void>;

  // Vendor API Key operations (Partner API)
  createVendorApiKey(apiKey: InsertVendorApiKey): Promise<VendorApiKey>;
  getVendorApiKeyByHash(keyHash: string): Promise<VendorApiKey | undefined>;
  getVendorApiKeys(vendorId: string): Promise<VendorApiKey[]>;
  updateApiKeyLastUsed(id: string): Promise<void>;
  deactivateApiKey(id: string): Promise<void>;

  // AI System operations
  getAISystems(healthSystemId: string): Promise<AISystem[]>;
  getAISystem(id: string): Promise<AISystem | undefined>;
  createAISystem(aiSystem: InsertAISystem): Promise<AISystem>;
  updateAISystem(id: string, aiSystem: Partial<InsertAISystem>): Promise<AISystem | undefined>;
  updateAISystemLastCheck(id: string, lastCheck: Date): Promise<void>;
  deleteAISystem(id: string): Promise<void>;

  // Monitoring Alert operations
  getAlerts(aiSystemId?: string): Promise<MonitoringAlert[]>;
  getUnresolvedAlerts(healthSystemId: string): Promise<MonitoringAlert[]>;
  createAlert(alert: InsertMonitoringAlert): Promise<MonitoringAlert>;
  resolveAlert(id: string): Promise<void>;

  // Predictive Alert operations
  getPredictiveAlerts(aiSystemId: string): Promise<PredictiveAlert[]>;
  getPredictiveAlertsForHealthSystem(healthSystemId: string): Promise<PredictiveAlert[]>;
  createPredictiveAlert(alert: InsertPredictiveAlert): Promise<PredictiveAlert>;
  dismissPredictiveAlert(id: string): Promise<void>;
  actualizePredictiveAlert(id: string): Promise<void>;

  // Deployment operations
  getDeploymentsByVendor(vendorId: string): Promise<Deployment[]>;
  getDeploymentsByHealthSystem(healthSystemId: string): Promise<Deployment[]>;
  createDeployment(deployment: InsertDeployment): Promise<Deployment>;

  // Compliance operations
  getCertifications(vendorId: string): Promise<ComplianceCertification[]>;
  getVendorCertifications(vendorId: string): Promise<ComplianceCertification[]>; // Alias
  createCertification(cert: InsertComplianceCertification): Promise<ComplianceCertification>;
  getComplianceMappingsBySystem(aiSystemId: string): Promise<ComplianceMapping[]>;

  // Compliance Template Library operations
  getComplianceTemplates(filters?: {
    framework?: string;
    category?: string;
    tags?: string[];
    search?: string;
  }): Promise<ComplianceTemplate[]>;
  getComplianceTemplate(id: string): Promise<ComplianceTemplate | undefined>;

  // AI Telemetry operations
  createAITelemetryEvent(event: InsertAITelemetryEvent): Promise<AITelemetryEvent>;
  getAITelemetryEvents(aiSystemId: string): Promise<AITelemetryEvent[]>;
  
  // 🔒 Translation Engine - Compliance Violation operations
  createComplianceViolation(violation: InsertComplianceViolation): Promise<ComplianceViolation>;
  getComplianceViolations(aiSystemId?: string): Promise<ComplianceViolation[]>;
  resolveComplianceViolation(id: string, resolvedBy: string): Promise<void>;
  
  // 🔒 Translation Engine - Required Action operations
  createRequiredAction(action: InsertRequiredAction): Promise<RequiredAction>;
  getRequiredActions(aiSystemId?: string): Promise<RequiredAction[]>;
  getAllPendingActions(): Promise<RequiredAction[]>;
  getRequiredActionsByAssignee(assignee: string): Promise<RequiredAction[]>;
  completeRequiredAction(id: string, completedBy: string, notes?: string): Promise<void>;
  updateRequiredActionStatus(id: string, status: string): Promise<void>;
  
  // Background Job operations
  createBackgroundJob(job: InsertBackgroundJob): Promise<BackgroundJob>;
  getBackgroundJob(id: string): Promise<BackgroundJob | undefined>;
  getBackgroundJobsByType(jobType: string): Promise<BackgroundJob[]>;
  getPendingBackgroundJobs(): Promise<BackgroundJob[]>;
  updateBackgroundJobStatus(id: string, status: string, startedAt?: Date): Promise<void>;
  completeBackgroundJob(id: string, result: string, completedAt: Date): Promise<void>;
  failBackgroundJob(id: string, error: string, completedAt: Date): Promise<void>;
  
  // Certification Application operations
  createCertificationApplication(application: InsertCertificationApplication): Promise<CertificationApplication>;
  getCertificationApplication(id: string): Promise<CertificationApplication | undefined>;
  getCertificationApplicationsByVendor(vendorId: string): Promise<CertificationApplication[]>;
  updateCertificationApplicationStatus(id: string, status: string, automatedChecksPassed?: boolean, automatedChecksResult?: string): Promise<void>;
  reviewCertificationApplication(id: string, status: string, reviewedBy: string, rejectionReason?: string, notes?: string): Promise<void>;
  
  // Vendor Test Result operations
  createVendorTestResult(result: InsertVendorTestResult): Promise<VendorTestResult>;
  getVendorTestResults(applicationId: string): Promise<VendorTestResult[]>;
  getVendorTestResultsByVendor(vendorId: string): Promise<VendorTestResult[]>;
  updateVendorTestResult(id: string, updates: Partial<InsertVendorTestResult>): Promise<void>;
  
  // Helper operations for public trust page
  getAISystemsByVendor(vendorId: string): Promise<AISystem[]>;
  
  // Compliance Report operations
  createComplianceReport(report: InsertComplianceReport): Promise<ComplianceReport>;
  getComplianceReports(healthSystemId: string): Promise<ComplianceReport[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
    return user || undefined;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    return user || undefined;
  }

  async getUsersByOrganization(healthSystemId?: string, vendorId?: string): Promise<User[]> {
    if (healthSystemId) {
      return db.select().from(users).where(eq(users.healthSystemId, healthSystemId)).orderBy(desc(users.createdAt));
    } else if (vendorId) {
      return db.select().from(users).where(eq(users.vendorId, vendorId)).orderBy(desc(users.createdAt));
    }
    return [];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, id));
  }

  // User Invitation operations
  async createUserInvitation(invitation: InsertUserInvitation): Promise<UserInvitation> {
    const [inv] = await db.insert(userInvitations).values(invitation).returning();
    return inv;
  }

  async getUserInvitation(id: string): Promise<UserInvitation | undefined> {
    const [invitation] = await db.select().from(userInvitations).where(eq(userInvitations.id, id));
    return invitation || undefined;
  }

  async getUserInvitationByTokenHash(tokenHash: string): Promise<UserInvitation | undefined> {
    const [invitation] = await db.select().from(userInvitations).where(eq(userInvitations.tokenHash, tokenHash));
    return invitation || undefined;
  }

  async getUserInvitationsByOrganization(healthSystemId?: string, vendorId?: string): Promise<UserInvitation[]> {
    if (healthSystemId) {
      return db.select().from(userInvitations).where(eq(userInvitations.healthSystemId, healthSystemId)).orderBy(desc(userInvitations.createdAt));
    } else if (vendorId) {
      return db.select().from(userInvitations).where(eq(userInvitations.vendorId, vendorId)).orderBy(desc(userInvitations.createdAt));
    }
    // Return all invitations if no organization specified (for token lookup during acceptance)
    return db.select().from(userInvitations).orderBy(desc(userInvitations.createdAt));
  }

  async acceptUserInvitation(id: string): Promise<void> {
    await db.update(userInvitations).set({ 
      status: 'accepted',
      acceptedAt: new Date()
    }).where(eq(userInvitations.id, id));
  }

  async expireUserInvitation(id: string): Promise<void> {
    await db.update(userInvitations).set({ status: 'expired' }).where(eq(userInvitations.id, id));
  }

  // Audit Log operations
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [auditLog] = await db.insert(auditLogs).values(log).returning();
    return auditLog;
  }

  async getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    resourceType?: string;
    healthSystemId?: string;
    vendorId?: string;
    limit?: number;
  }): Promise<AuditLog[]> {
    const conditions = [];
    
    if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters?.resourceType) conditions.push(eq(auditLogs.resourceType, filters.resourceType));
    if (filters?.healthSystemId) conditions.push(eq(auditLogs.healthSystemId, filters.healthSystemId));
    if (filters?.vendorId) conditions.push(eq(auditLogs.vendorId, filters.vendorId));
    
    if (conditions.length > 0) {
      const query = db.select().from(auditLogs)
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt));
      
      if (filters?.limit) {
        return query.limit(filters.limit);
      }
      return query;
    }
    
    const query = db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
    if (filters?.limit) {
      return query.limit(filters.limit);
    }
    return query;
  }

  // Health System operations
  async getHealthSystem(id: string): Promise<HealthSystem | undefined> {
    // Check cache first
    const cached = await CacheService.getHealthSystem(id);
    if (cached) return cached as HealthSystem;
    
    // Cache miss - fetch from database
    const [healthSystem] = await db.select().from(healthSystems).where(eq(healthSystems.id, id));
    
    // Set cache for next time
    if (healthSystem) {
      await CacheService.setHealthSystem(id, healthSystem);
    }
    
    return healthSystem || undefined;
  }

  async createHealthSystem(insertHealthSystem: InsertHealthSystem): Promise<HealthSystem> {
    const [healthSystem] = await db.insert(healthSystems).values(insertHealthSystem).returning();
    return healthSystem;
  }

  async updateHealthSystem(id: string, data: Partial<InsertHealthSystem>): Promise<void> {
    await db.update(healthSystems).set(data).where(eq(healthSystems.id, id));
    // Invalidate cache after update
    await CacheService.invalidateHealthSystem(id);
  }

  // Vendor operations
  async getVendor(id: string): Promise<Vendor | undefined> {
    // Check cache first
    const cached = await CacheService.getVendor(id);
    if (cached) return cached as Vendor;
    
    // Cache miss - fetch from database
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    
    // Set cache for next time
    if (vendor) {
      await CacheService.setVendor(id, vendor);
    }
    
    return vendor || undefined;
  }

  async getVendors(): Promise<Vendor[]> {
    return db.select().from(vendors);
  }

  async getPublicVendors(): Promise<Vendor[]> {
    return db.select().from(vendors).where(eq(vendors.verified, true)).orderBy(desc(vendors.createdAt));
  }

  async createVendor(insertVendor: InsertVendor): Promise<Vendor> {
    const [vendor] = await db.insert(vendors).values(insertVendor).returning();
    return vendor;
  }

  async updateVendor(id: string, data: Partial<InsertVendor>): Promise<void> {
    await db.update(vendors).set(data).where(eq(vendors.id, id));
    // Invalidate cache after update
    await CacheService.invalidateVendor(id);
  }

  // Vendor API Key operations (Partner API)
  async createVendorApiKey(insertApiKey: InsertVendorApiKey): Promise<VendorApiKey> {
    const [apiKey] = await db.insert(vendorApiKeys).values(insertApiKey).returning();
    return apiKey;
  }

  async getVendorApiKeyByHash(keyHash: string): Promise<VendorApiKey | undefined> {
    const [apiKey] = await db
      .select()
      .from(vendorApiKeys)
      .where(
        and(
          eq(vendorApiKeys.keyHash, keyHash),
          eq(vendorApiKeys.active, true)
        )
      );
    return apiKey || undefined;
  }

  async getVendorApiKeys(vendorId: string): Promise<VendorApiKey[]> {
    return db
      .select()
      .from(vendorApiKeys)
      .where(eq(vendorApiKeys.vendorId, vendorId))
      .orderBy(desc(vendorApiKeys.createdAt));
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await db.update(vendorApiKeys).set({ lastUsed: new Date() }).where(eq(vendorApiKeys.id, id));
  }

  async deactivateApiKey(id: string): Promise<void> {
    await db.update(vendorApiKeys).set({ active: false }).where(eq(vendorApiKeys.id, id));
  }

  // AI System operations
  async getAISystems(healthSystemId: string): Promise<AISystem[]> {
    const systems = await db.select().from(aiSystems).where(eq(aiSystems.healthSystemId, healthSystemId));
    
    // Decrypt integration_config for each system
    return systems.map(system => {
      if (system.integrationConfig) {
        system.integrationConfig = decryptFields(system.integrationConfig as Record<string, any>, ['apiKey', 'webhookSecret', 'secretKey']);
      }
      return system;
    });
  }

  async getAISystem(id: string): Promise<AISystem | undefined> {
    // Check cache first
    const cached = await CacheService.getAISystem(id);
    if (cached) {
      // Decrypt integration_config if present
      const system = cached as AISystem;
      if (system.integrationConfig) {
        system.integrationConfig = decryptFields(system.integrationConfig as Record<string, any>, ['apiKey', 'webhookSecret', 'secretKey']);
      }
      return system;
    }
    
    // Cache miss - fetch from database
    const [system] = await db.select().from(aiSystems).where(eq(aiSystems.id, id));
    
    // Decrypt integration_config before returning
    if (system?.integrationConfig) {
      system.integrationConfig = decryptFields(system.integrationConfig as Record<string, any>, ['apiKey', 'webhookSecret', 'secretKey']);
    }
    
    // Set cache for next time (with decrypted data - cache is temporary)
    if (system) {
      await CacheService.setAISystem(id, system);
    }
    
    return system || undefined;
  }

  async createAISystem(insertAISystem: InsertAISystem): Promise<AISystem> {
    // Encrypt integration_config before storing
    const dataToInsert = { ...insertAISystem };
    if (dataToInsert.integrationConfig) {
      dataToInsert.integrationConfig = encryptFields(
        dataToInsert.integrationConfig as Record<string, any>, 
        ['apiKey', 'webhookSecret', 'secretKey']
      ) as any;
    }
    
    const [system] = await db.insert(aiSystems).values(dataToInsert).returning();
    
    // Decrypt before returning to caller
    if (system.integrationConfig) {
      system.integrationConfig = decryptFields(system.integrationConfig as Record<string, any>, ['apiKey', 'webhookSecret', 'secretKey']);
    }
    
    return system;
  }

  async updateAISystem(id: string, updateData: Partial<InsertAISystem>): Promise<AISystem | undefined> {
    // Encrypt integration_config if being updated
    const dataToUpdate = { ...updateData };
    if (dataToUpdate.integrationConfig) {
      dataToUpdate.integrationConfig = encryptFields(
        dataToUpdate.integrationConfig as Record<string, any>, 
        ['apiKey', 'webhookSecret', 'secretKey']
      ) as any;
    }
    
    const [system] = await db
      .update(aiSystems)
      .set(dataToUpdate)
      .where(eq(aiSystems.id, id))
      .returning();
    
    // Invalidate cache after update
    await CacheService.invalidateAISystem(id);
    
    // Decrypt before returning to caller
    if (system?.integrationConfig) {
      system.integrationConfig = decryptFields(system.integrationConfig as Record<string, any>, ['apiKey', 'webhookSecret', 'secretKey']);
    }
    
    return system || undefined;
  }

  async updateAISystemLastCheck(id: string, lastCheck: Date): Promise<void> {
    await db.update(aiSystems).set({ lastCheck }).where(eq(aiSystems.id, id));
    // Invalidate cache after update
    await CacheService.invalidateAISystem(id);
  }

  async deleteAISystem(id: string): Promise<void> {
    await db.delete(aiSystems).where(eq(aiSystems.id, id));
    // Invalidate cache after delete
    await CacheService.invalidateAISystem(id);
  }

  // Monitoring Alert operations
  async getAlerts(aiSystemId?: string): Promise<MonitoringAlert[]> {
    if (aiSystemId) {
      return db
        .select()
        .from(monitoringAlerts)
        .where(eq(monitoringAlerts.aiSystemId, aiSystemId))
        .orderBy(desc(monitoringAlerts.createdAt));
    }
    return db.select().from(monitoringAlerts).orderBy(desc(monitoringAlerts.createdAt));
  }

  async getUnresolvedAlerts(healthSystemId: string): Promise<MonitoringAlert[]> {
    const systems = await this.getAISystems(healthSystemId);
    const systemIds = systems.map(s => s.id);
    
    if (systemIds.length === 0) return [];
    
    return db
      .select()
      .from(monitoringAlerts)
      .where(
        and(
          eq(monitoringAlerts.resolved, false)
        )
      )
      .orderBy(desc(monitoringAlerts.createdAt));
  }

  async createAlert(insertAlert: InsertMonitoringAlert): Promise<MonitoringAlert> {
    const [alert] = await db.insert(monitoringAlerts).values(insertAlert).returning();
    return alert;
  }

  async resolveAlert(id: string): Promise<void> {
    await db.update(monitoringAlerts).set({ resolved: true }).where(eq(monitoringAlerts.id, id));
  }

  // Predictive Alert operations
  async getPredictiveAlerts(aiSystemId: string): Promise<PredictiveAlert[]> {
    return db
      .select()
      .from(predictiveAlerts)
      .where(
        and(
          eq(predictiveAlerts.aiSystemId, aiSystemId),
          eq(predictiveAlerts.dismissed, false)
        )
      )
      .orderBy(desc(predictiveAlerts.createdAt));
  }

  async getPredictiveAlertsForHealthSystem(healthSystemId: string): Promise<PredictiveAlert[]> {
    const systems = await this.getAISystems(healthSystemId);
    const systemIds = systems.map(s => s.id);
    
    if (systemIds.length === 0) return [];
    
    // Get all active predictive alerts for these systems
    const alerts: PredictiveAlert[] = [];
    for (const systemId of systemIds) {
      const systemAlerts = await this.getPredictiveAlerts(systemId);
      alerts.push(...systemAlerts);
    }

    return alerts;
  }

  async createPredictiveAlert(insertAlert: InsertPredictiveAlert): Promise<PredictiveAlert> {
    const [alert] = await db.insert(predictiveAlerts).values(insertAlert).returning();
    return alert;
  }

  async dismissPredictiveAlert(id: string): Promise<void> {
    await db.update(predictiveAlerts).set({ dismissed: true }).where(eq(predictiveAlerts.id, id));
  }

  async actualizePredictiveAlert(id: string): Promise<void> {
    await db.update(predictiveAlerts).set({ actualizedAt: new Date() }).where(eq(predictiveAlerts.id, id));
  }

  // Deployment operations
  async getDeploymentsByVendor(vendorId: string): Promise<Deployment[]> {
    return db.select().from(deployments).where(eq(deployments.vendorId, vendorId));
  }

  async getDeploymentsByHealthSystem(healthSystemId: string): Promise<Deployment[]> {
    return db.select().from(deployments).where(eq(deployments.healthSystemId, healthSystemId));
  }

  async createDeployment(insertDeployment: InsertDeployment): Promise<Deployment> {
    const [deployment] = await db.insert(deployments).values(insertDeployment).returning();
    return deployment;
  }

  // Compliance operations
  async getCertifications(vendorId: string): Promise<ComplianceCertification[]> {
    return db.select().from(complianceCertifications).where(eq(complianceCertifications.vendorId, vendorId));
  }

  async getVendorCertifications(vendorId: string): Promise<ComplianceCertification[]> {
    return this.getCertifications(vendorId);
  }

  async createCertification(insertCert: InsertComplianceCertification): Promise<ComplianceCertification> {
    const [cert] = await db.insert(complianceCertifications).values(insertCert).returning();
    return cert;
  }

  async getComplianceMappingsBySystem(aiSystemId: string): Promise<ComplianceMapping[]> {
    return db.select().from(complianceMappings).where(eq(complianceMappings.aiSystemId, aiSystemId));
  }

  // Compliance Template Library operations
  async getComplianceTemplates(filters?: {
    framework?: string;
    category?: string;
    tags?: string[];
    search?: string;
  }): Promise<ComplianceTemplate[]> {
    let templates = await db.select().from(complianceTemplates);
    
    if (!filters) {
      return templates;
    }
    
    // Apply filters
    if (filters.framework) {
      templates = templates.filter(t => t.framework === filters.framework);
    }
    if (filters.category) {
      templates = templates.filter(t => t.category === filters.category);
    }
    if (filters.tags && filters.tags.length > 0) {
      templates = templates.filter(t => 
        t.tags?.some(tag => filters.tags!.includes(tag))
      );
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(searchLower) || 
        t.description.toLowerCase().includes(searchLower) ||
        t.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    return templates;
  }

  async getComplianceTemplate(id: string): Promise<ComplianceTemplate | undefined> {
    const results = await db.select()
      .from(complianceTemplates)
      .where(eq(complianceTemplates.id, id))
      .limit(1);
    return results[0];
  }

  // AI Telemetry operations
  async createAITelemetryEvent(insertEvent: InsertAITelemetryEvent): Promise<AITelemetryEvent> {
    const [event] = await db.insert(aiTelemetryEvents).values(insertEvent).returning();
    return event;
  }

  async getAITelemetryEvents(aiSystemId: string): Promise<AITelemetryEvent[]> {
    return db.select().from(aiTelemetryEvents)
      .where(eq(aiTelemetryEvents.aiSystemId, aiSystemId))
      .orderBy(desc(aiTelemetryEvents.createdAt));
  }
  
  // 🔒 Translation Engine - Compliance Violation operations
  async createComplianceViolation(insertViolation: InsertComplianceViolation): Promise<ComplianceViolation> {
    const [violation] = await db.insert(complianceViolations).values(insertViolation).returning();
    return violation;
  }
  
  async getComplianceViolations(aiSystemId?: string): Promise<ComplianceViolation[]> {
    if (aiSystemId) {
      return db.select().from(complianceViolations)
        .where(eq(complianceViolations.aiSystemId, aiSystemId))
        .orderBy(desc(complianceViolations.createdAt));
    }
    return db.select().from(complianceViolations).orderBy(desc(complianceViolations.createdAt));
  }
  
  async resolveComplianceViolation(id: string, resolvedBy: string): Promise<void> {
    await db.update(complianceViolations)
      .set({ 
        resolved: true, 
        resolvedAt: new Date(),
        resolvedBy,
      })
      .where(eq(complianceViolations.id, id));
  }
  
  // 🔒 Translation Engine - Required Action operations
  async createRequiredAction(insertAction: InsertRequiredAction): Promise<RequiredAction> {
    const [action] = await db.insert(requiredActions).values(insertAction).returning();
    return action;
  }
  
  async getRequiredActions(aiSystemId?: string): Promise<RequiredAction[]> {
    if (aiSystemId) {
      return db.select().from(requiredActions)
        .where(eq(requiredActions.aiSystemId, aiSystemId))
        .orderBy(desc(requiredActions.createdAt));
    }
    return db.select().from(requiredActions).orderBy(desc(requiredActions.createdAt));
  }
  
  async getRequiredActionsByAssignee(assignee: string): Promise<RequiredAction[]> {
    return db.select().from(requiredActions)
      .where(eq(requiredActions.assignee, assignee))
      .orderBy(desc(requiredActions.createdAt));
  }
  
  async completeRequiredAction(id: string, completedBy: string, notes?: string): Promise<void> {
    await db.update(requiredActions)
      .set({ 
        status: "completed",
        completedAt: new Date(),
        completedBy,
        notes,
      })
      .where(eq(requiredActions.id, id));
  }
  
  async getAllPendingActions(): Promise<RequiredAction[]> {
    return db.select().from(requiredActions)
      .where(eq(requiredActions.status, "pending"))
      .orderBy(desc(requiredActions.createdAt));
  }
  
  async updateRequiredActionStatus(id: string, status: string): Promise<void> {
    const updates: any = { status };
    if (status === "completed") {
      updates.completedAt = new Date();
    }
    await db.update(requiredActions).set(updates).where(eq(requiredActions.id, id));
  }
  
  // Background Job operations
  async createBackgroundJob(insertJob: InsertBackgroundJob): Promise<BackgroundJob> {
    const [job] = await db.insert(backgroundJobs).values(insertJob).returning();
    return job;
  }
  
  async getBackgroundJob(id: string): Promise<BackgroundJob | undefined> {
    const [job] = await db.select().from(backgroundJobs).where(eq(backgroundJobs.id, id));
    return job || undefined;
  }
  
  async getBackgroundJobsByType(jobType: string): Promise<BackgroundJob[]> {
    return db.select().from(backgroundJobs)
      .where(eq(backgroundJobs.jobType, jobType))
      .orderBy(desc(backgroundJobs.createdAt));
  }
  
  async getPendingBackgroundJobs(): Promise<BackgroundJob[]> {
    return db.select().from(backgroundJobs)
      .where(eq(backgroundJobs.status, "pending"))
      .orderBy(desc(backgroundJobs.createdAt));
  }
  
  async updateBackgroundJobStatus(id: string, status: string, startedAt?: Date): Promise<void> {
    const updates: any = { status };
    if (startedAt) {
      updates.startedAt = startedAt;
    }
    await db.update(backgroundJobs)
      .set(updates)
      .where(eq(backgroundJobs.id, id));
  }
  
  async completeBackgroundJob(id: string, result: string, completedAt: Date): Promise<void> {
    await db.update(backgroundJobs)
      .set({ 
        status: "completed",
        result,
        completedAt,
      })
      .where(eq(backgroundJobs.id, id));
  }
  
  async failBackgroundJob(id: string, error: string, completedAt: Date): Promise<void> {
    await db.update(backgroundJobs)
      .set({ 
        status: "failed",
        error,
        completedAt,
      })
      .where(eq(backgroundJobs.id, id));
  }
  
  // Certification Application operations
  async createCertificationApplication(insertApplication: InsertCertificationApplication): Promise<CertificationApplication> {
    const [application] = await db.insert(certificationApplications).values(insertApplication).returning();
    return application;
  }
  
  async getCertificationApplication(id: string): Promise<CertificationApplication | undefined> {
    const [application] = await db.select().from(certificationApplications).where(eq(certificationApplications.id, id));
    return application || undefined;
  }
  
  async getCertificationApplicationsByVendor(vendorId: string): Promise<CertificationApplication[]> {
    return db.select().from(certificationApplications)
      .where(eq(certificationApplications.vendorId, vendorId))
      .orderBy(desc(certificationApplications.submittedAt));
  }
  
  async updateCertificationApplicationStatus(id: string, status: string, automatedChecksPassed?: boolean, automatedChecksResult?: string): Promise<void> {
    const updates: any = { status };
    if (automatedChecksPassed !== undefined) {
      updates.automatedChecksPassed = automatedChecksPassed;
    }
    if (automatedChecksResult) {
      updates.automatedChecksResult = automatedChecksResult;
    }
    await db.update(certificationApplications)
      .set(updates)
      .where(eq(certificationApplications.id, id));
  }
  
  async reviewCertificationApplication(id: string, status: string, reviewedBy: string, rejectionReason?: string, notes?: string): Promise<void> {
    const updates: any = {
      status,
      reviewedBy,
      reviewedAt: new Date(),
    };
    if (rejectionReason) {
      updates.rejectionReason = rejectionReason;
    }
    if (notes) {
      updates.notes = notes;
    }
    await db.update(certificationApplications)
      .set(updates)
      .where(eq(certificationApplications.id, id));
  }
  
  // Vendor Test Result operations
  async createVendorTestResult(insertResult: InsertVendorTestResult): Promise<VendorTestResult> {
    const [result] = await db.insert(vendorTestResults).values(insertResult).returning();
    return result;
  }
  
  async getVendorTestResults(applicationId: string): Promise<VendorTestResult[]> {
    return db.select().from(vendorTestResults)
      .where(eq(vendorTestResults.applicationId, applicationId))
      .orderBy(desc(vendorTestResults.createdAt));
  }
  
  async getVendorTestResultsByVendor(vendorId: string): Promise<VendorTestResult[]> {
    return db.select().from(vendorTestResults)
      .where(eq(vendorTestResults.vendorId, vendorId))
      .orderBy(desc(vendorTestResults.createdAt));
  }
  
  async updateVendorTestResult(id: string, updates: Partial<InsertVendorTestResult>): Promise<void> {
    await db.update(vendorTestResults)
      .set(updates)
      .where(eq(vendorTestResults.id, id));
  }
  
  // Helper operations for public trust page
  async getAISystemsByVendor(vendorId: string): Promise<AISystem[]> {
    return db.select().from(aiSystems).where(eq(aiSystems.vendorId, vendorId));
  }
  
  // Compliance Report operations
  async createComplianceReport(insertReport: InsertComplianceReport): Promise<ComplianceReport> {
    const [report] = await db.insert(complianceReports).values(insertReport).returning();
    return report;
  }
  
  async getComplianceReports(healthSystemId: string): Promise<ComplianceReport[]> {
    return db.select().from(complianceReports)
      .where(eq(complianceReports.healthSystemId, healthSystemId))
      .orderBy(desc(complianceReports.generatedAt));
  }
}

export const storage = new DatabaseStorage();
