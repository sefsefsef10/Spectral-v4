/**
 * APPLICATION LAYER USE CASE: Update User Role
 */

import { User, type UserRole } from '../../domain/entities/User';

export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
}

export interface UpdateUserRoleInput {
  userId: string;
  newRole: UserRole;
  updatedBy: string;
}

export interface UpdateUserRoleResult {
  userId: string;
  newRole: UserRole;
  updatedAt: Date;
}

export class UpdateUserRoleUseCase {
  constructor(private userRepository: UserRepository) {}

  async execute(input: UpdateUserRoleInput): Promise<UpdateUserRoleResult> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new Error(`User not found: ${input.userId}`);
    }

    const updater = await this.userRepository.findById(input.updatedBy);
    if (!updater) {
      throw new Error('Updater not found');
    }

    if (!updater.hasHigherRoleThan(user) && updater.role !== 'super_admin') {
      throw new Error('Insufficient permissions to update user role');
    }

    user.updateRole(input.newRole, input.updatedBy);
    await this.userRepository.save(user);

    return {
      userId: user.id!,
      newRole: user.role,
      updatedAt: user.updatedAt!,
    };
  }
}
