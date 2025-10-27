/**
 * APPLICATION LAYER USE CASE: Deactivate User
 */

import { User } from '../../domain/entities/User';
import type { IUserRepository } from '../../domain/repositories/IUserRepository';

export interface DeactivateUserInput {
  userId: string;
  deactivatedBy: string;
}

export interface DeactivateUserResult {
  userId: string;
  status: string;
  deactivatedAt: Date;
}

export class DeactivateUserUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(input: DeactivateUserInput): Promise<DeactivateUserResult> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new Error(`User not found: ${input.userId}`);
    }

    const deactivator = await this.userRepository.findById(input.deactivatedBy);
    if (!deactivator) {
      throw new Error('Deactivator not found');
    }

    if (!deactivator.hasPermission('users', 'delete')) {
      throw new Error('Insufficient permissions to deactivate user');
    }

    user.deactivate();
    await this.userRepository.save(user);

    return {
      userId: user.id!,
      status: user.status,
      deactivatedAt: user.updatedAt!,
    };
  }
}
