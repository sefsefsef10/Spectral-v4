/**
 * APPLICATION LAYER USE CASE: Deactivate User
 */

import { User } from '../../domain/entities/User';

export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
}

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
  constructor(private userRepository: UserRepository) {}

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
