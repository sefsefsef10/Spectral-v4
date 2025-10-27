/**
 * APPLICATION LAYER USE CASE: Create Alert
 * 
 * Orchestrates alert creation, severity calculation, and notification routing.
 * Coordinates domain entities, repositories, and external notification services.
 */

import { Alert, type AlertType, type AlertSeverity, type NotificationChannel } from '../../domain/entities/Alert';

/**
 * Repository interface for alert persistence (adapter pattern)
 */
export interface AlertRepository {
  save(alert: Alert): Promise<void>;
  findByDeduplicationKey(key: string, withinHours: number): Promise<Alert | null>;
}

/**
 * Notification gateway interface (adapter pattern)
 */
export interface NotificationGateway {
  send(channels: NotificationChannel[], alert: Alert): Promise<void>;
}

/**
 * Input data for creating an alert
 */
export interface CreateAlertInput {
  aiSystemId: string;
  healthSystemId: string;
  type: AlertType;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Result of alert creation
 */
export interface CreateAlertResult {
  alertId: string;
  severity: AlertSeverity;
  notificationChannels: NotificationChannel[];
  isDuplicate: boolean;
}

/**
 * CreateAlertUseCase
 * 
 * Business Flow:
 * 1. Calculate severity based on type and metadata
 * 2. Create alert domain entity with validation
 * 3. Check for duplicates (deduplication)
 * 4. Save to repository
 * 5. Route notifications to appropriate channels
 */
export class CreateAlertUseCase {
  constructor(
    private alertRepository: AlertRepository,
    private notificationGateway: NotificationGateway
  ) {}

  async execute(input: CreateAlertInput): Promise<CreateAlertResult> {
    // Step 1: Calculate severity using domain logic
    const severity = Alert.calculateSeverity(input.type, input.metadata);

    // Step 2: Create alert domain entity (validates business rules)
    const alert = Alert.create({
      aiSystemId: input.aiSystemId,
      healthSystemId: input.healthSystemId,
      type: input.type,
      severity,
      message: input.message,
      metadata: input.metadata,
    });

    // Step 3: Check for duplicates (deduplication)
    const deduplicationKey = alert.getDeduplicationKey();
    const existingAlert = await this.alertRepository.findByDeduplicationKey(
      deduplicationKey,
      1 // Within 1 hour
    );

    let isDuplicate = false;
    if (existingAlert && alert.isDuplicateOf(existingAlert)) {
      isDuplicate = true;
      // Don't create duplicate alert or send notifications
      return {
        alertId: existingAlert.id!,
        severity,
        notificationChannels: [],
        isDuplicate,
      };
    }

    // Step 4: Save to repository
    await this.alertRepository.save(alert);

    // Step 5: Route notifications using domain logic
    const notificationChannels = alert.getNotificationChannels();
    
    // Send notifications asynchronously (don't block alert creation)
    this.notificationGateway.send(notificationChannels, alert).catch(error => {
      // Log error but don't fail the use case
      console.error('Failed to send alert notifications:', error);
    });

    return {
      alertId: alert.id!,
      severity,
      notificationChannels,
      isDuplicate,
    };
  }
}
