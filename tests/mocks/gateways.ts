/**
 * CENTRALIZED MOCK FACTORIES: Gateway Interfaces
 * Provides type-safe mock implementations for external dependencies
 */

import type { NotificationGateway } from '../../server/application/alert-management/CreateAlertUseCase';
import type { HealthCheckExecutor } from '../../server/application/deployment/ExecuteHealthCheckUseCase';
import type { RollbackExecutor } from '../../server/application/deployment/RollbackDeploymentUseCase';
import type { AuditLogger } from '../../server/application/alert-management/ResolveAlertUseCase';
import type { PasswordHasher } from '../../server/application/user-management/RegisterUserUseCase';
import type { NotificationChannel } from '../../server/domain/entities/Alert';
import type { Alert } from '../../server/domain/entities/Alert';

/**
 * Mock Notification Gateway for testing
 */
export class MockNotificationGateway implements NotificationGateway {
  public sentNotifications: Array<{ channels: NotificationChannel[]; alert: Alert }> = [];

  async send(channels: NotificationChannel[], alert: Alert): Promise<void> {
    this.sentNotifications.push({ channels, alert });
  }

  clear() {
    this.sentNotifications = [];
  }
}

/**
 * Mock Health Check Executor for testing
 */
export class MockHealthCheckExecutor implements HealthCheckExecutor {
  private results: Map<string, { success: boolean; error?: string }> = new Map();

  setResult(endpoint: string, success: boolean, error?: string) {
    this.results.set(endpoint, { success, error });
  }

  async execute(endpoint: string, expectedStatus: number, timeout: number): Promise<{ success: boolean; error?: string }> {
    return this.results.get(endpoint) || { success: true };
  }

  clear() {
    this.results.clear();
  }
}

/**
 * Mock Rollback Executor for testing
 */
export class MockRollbackExecutor implements RollbackExecutor {
  public executedRollbacks: Array<{ aiSystemId: string; toPreviousVersion: boolean }> = [];

  async execute(aiSystemId: string, toPreviousVersion: boolean): Promise<void> {
    this.executedRollbacks.push({ aiSystemId, toPreviousVersion });
  }

  clear() {
    this.executedRollbacks = [];
  }
}

/**
 * Mock Audit Logger for testing
 */
export class MockAuditLogger implements AuditLogger {
  public loggedResolutions: Array<{ alertId: string; userId: string; responseTimeSeconds: number }> = [];

  async logAlertResolution(alertId: string, userId: string, responseTimeSeconds: number): Promise<void> {
    this.loggedResolutions.push({ alertId, userId, responseTimeSeconds });
  }

  clear() {
    this.loggedResolutions = [];
  }
}

/**
 * Mock Password Hasher for testing
 */
export class MockPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed-${password}`;
  }
}
