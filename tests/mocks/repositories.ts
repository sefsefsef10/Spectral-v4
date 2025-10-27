/**
 * CENTRALIZED MOCK FACTORIES: Repository Interfaces
 * Provides type-safe in-memory implementations for integration testing
 */

import type { IUserRepository } from '../../server/domain/repositories/IUserRepository';
import type { IDeploymentRepository } from '../../server/domain/repositories/IDeploymentRepository';
import type { IAlertRepository } from '../../server/domain/repositories/IAlertRepository';
import type { IRateLimitPolicyRepository } from '../../server/domain/repositories/IRateLimitPolicyRepository';
import { User } from '../../server/domain/entities/User';
import { Deployment } from '../../server/domain/entities/Deployment';
import { Alert } from '../../server/domain/entities/Alert';
import { RateLimitPolicy } from '../../server/domain/entities/RateLimitPolicy';

/**
 * In-memory User Repository for testing
 */
export class MockUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();
  private passwords: Map<string, string> = new Map();
  private idCounter = 1;

  async save(user: User): Promise<void> {
    if (!user.id) {
      (user as any).props.id = `user-${this.idCounter++}`;
    }
    this.users.set(user.id!, user);
  }

  async saveWithPassword(user: User, hashedPassword: string): Promise<void> {
    if (!user.id) {
      (user as any).props.id = `user-${this.idCounter++}`;
    }
    this.users.set(user.id!, user);
    this.passwords.set(user.id!, hashedPassword);
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async exists(id: string): Promise<boolean> {
    return this.users.has(id);
  }

  clear() {
    this.users.clear();
    this.passwords.clear();
  }
}

/**
 * In-memory Deployment Repository for testing
 */
export class MockDeploymentRepository implements IDeploymentRepository {
  private deployments: Map<string, Deployment> = new Map();
  private idCounter = 1;

  async save(deployment: Deployment): Promise<void> {
    if (!deployment.id) {
      (deployment as any).props.id = `deployment-${this.idCounter++}`;
    }
    this.deployments.set(deployment.id!, deployment);
  }

  async findById(id: string): Promise<Deployment | null> {
    return this.deployments.get(id) || null;
  }

  async findByAiSystemId(aiSystemId: string): Promise<Deployment[]> {
    return Array.from(this.deployments.values()).filter(
      (d) => d.aiSystemId === aiSystemId
    );
  }

  async findAll(): Promise<Deployment[]> {
    return Array.from(this.deployments.values());
  }

  async exists(id: string): Promise<boolean> {
    return this.deployments.has(id);
  }

  clear() {
    this.deployments.clear();
  }
}

/**
 * In-memory Alert Repository for testing
 */
export class MockAlertRepository implements IAlertRepository {
  private alerts: Map<string, Alert> = new Map();
  private idCounter = 1;

  async save(alert: Alert): Promise<void> {
    if (!alert.id) {
      (alert as any).props.id = `alert-${this.idCounter++}`;
    }
    this.alerts.set(alert.id!, alert);
  }

  async findById(id: string): Promise<Alert | null> {
    return this.alerts.get(id) || null;
  }

  async findByAiSystemId(aiSystemId: string): Promise<Alert[]> {
    return Array.from(this.alerts.values()).filter(
      (a) => a.aiSystemId === aiSystemId
    );
  }

  async findByDeduplicationKey(key: string, withinHours: number): Promise<Alert | null> {
    const timeThreshold = new Date(Date.now() - withinHours * 60 * 60 * 1000);
    
    // Parse the deduplication key: "aiSystemId:type:severity"
    const [aiSystemId, type, severity] = key.split(':');
    
    for (const alert of this.alerts.values()) {
      if (
        alert.aiSystemId === aiSystemId &&
        alert.type === type &&
        alert.severity === severity &&
        alert.createdAt >= timeThreshold &&
        alert.status === 'open'
      ) {
        return alert;
      }
    }
    
    return null;
  }

  async findDuplicates(alert: Alert): Promise<Alert[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return Array.from(this.alerts.values()).filter(
      (a) =>
        a.aiSystemId === alert.aiSystemId &&
        a.type === alert.type &&
        a.severity === alert.severity &&
        a.createdAt >= oneHourAgo &&
        a.status === 'open'
    );
  }

  async exists(id: string): Promise<boolean> {
    return this.alerts.has(id);
  }

  clear() {
    this.alerts.clear();
  }
}

/**
 * In-memory Rate Limit Policy Repository for testing
 */
export class MockRateLimitPolicyRepository implements IRateLimitPolicyRepository {
  private policies: Map<string, RateLimitPolicy> = new Map();
  private idCounter = 1;

  async save(policy: RateLimitPolicy): Promise<void> {
    if (!policy.id) {
      (policy as any).props.id = `policy-${this.idCounter++}`;
    }
    this.policies.set(policy.id!, policy);
  }

  async findById(id: string): Promise<RateLimitPolicy | null> {
    return this.policies.get(id) || null;
  }

  async findByApiKey(apiKey: string): Promise<RateLimitPolicy | null> {
    for (const policy of this.policies.values()) {
      if ((policy as any).apiKey === apiKey) {
        return policy;
      }
    }
    return null;
  }

  async findByHealthSystemId(healthSystemId: string): Promise<RateLimitPolicy | null> {
    for (const policy of this.policies.values()) {
      if (policy.healthSystemId === healthSystemId) {
        return policy;
      }
    }
    return null;
  }

  async exists(id: string): Promise<boolean> {
    return this.policies.has(id);
  }

  clear() {
    this.policies.clear();
  }
}
