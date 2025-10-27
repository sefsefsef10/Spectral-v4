/**
 * APPLICATION LAYER USE CASE: Validate Permissions
 */

import { User } from '../../domain/entities/User';
import type { IUserRepository } from '../../domain/repositories/IUserRepository';

export interface ValidatePermissionsInput {
  userId: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete';
  healthSystemId?: string;
}

export interface ValidatePermissionsResult {
  hasPermission: boolean;
  canAccessHealthSystem: boolean;
  userRole: string;
}

export class ValidatePermissionsUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(input: ValidatePermissionsInput): Promise<ValidatePermissionsResult> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new Error(`User not found: ${input.userId}`);
    }

    const hasPermission = user.hasPermission(input.resource, input.action);
    const canAccessHealthSystem = input.healthSystemId
      ? user.canAccessHealthSystem(input.healthSystemId)
      : true;

    return {
      hasPermission,
      canAccessHealthSystem,
      userRole: user.role,
    };
  }
}
