/**
 * INFRASTRUCTURE LAYER: User Repository
 * Maps User domain entity to database persistence
 */

import { eq, and } from 'drizzle-orm';
import { User, type UserRole } from '../../domain/entities/User';
import type { UserRepository } from '../../application/user-management/RegisterUserUseCase';
import { db } from '../../storage';
import { users } from '../../../shared/schema';

export class DrizzleUserRepository implements UserRepository {
  async save(user: User): Promise<void> {
    const data = this.toDatabase(user);
    
    if (await this.findById(user.id!)) {
      await db
        .update(users)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id!));
    } else {
      await db.insert(users).values(data);
    }
  }

  async saveWithPassword(user: User, passwordHash: string): Promise<void> {
    const data = this.toDatabase(user);
    
    await db.insert(users).values({
      ...data,
      password: passwordHash,
    });
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return row ? this.toDomain(row) : null;
  }

  private toDatabase(user: User): any {
    return {
      id: user.id,
      username: user.email.split('@')[0], // Generate username from email
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      healthSystemId: user.healthSystemId,
      createdBy: user.createdBy,
      failedLoginAttempts: user.failedLoginAttempts,
      accountLockedUntil: user.accountLockedUntil,
      passwordExpiresAt: user.passwordExpiresAt,
      passwordChangedAt: user.passwordChangedAt,
      deactivatedAt: user.deactivatedAt,
      createdAt: user.createdAt,
    };
  }

  private toDomain(row: any): User {
    return User.fromPersistence({
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role as UserRole,
      status: row.status,
      healthSystemId: row.healthSystemId,
      createdBy: row.createdBy,
      failedLoginAttempts: row.failedLoginAttempts,
      accountLockedUntil: row.accountLockedUntil,
      passwordExpiresAt: row.passwordExpiresAt,
      passwordChangedAt: row.passwordChangedAt,
      deactivatedAt: row.deactivatedAt,
      createdAt: row.createdAt,
    });
  }
}
