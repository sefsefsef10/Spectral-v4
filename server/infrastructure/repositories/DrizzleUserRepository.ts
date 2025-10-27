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
    if (!user.id) {
      throw new Error('Cannot save user without ID. Use saveWithPassword for new users.');
    }

    const data = this.toDatabase(user);
    
    const existing = await this.findById(user.id);
    if (!existing) {
      throw new Error(`User ${user.id} not found. Use saveWithPassword for new users.`);
    }

    await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  }

  async saveWithPassword(user: User, passwordHash: string): Promise<void> {
    const data = this.toDatabase(user);
    
    // Check if user exists (by ID or email)
    let existing: User | null = null;
    if (user.id) {
      existing = await this.findById(user.id);
    }
    if (!existing) {
      existing = await this.findByEmail(user.email);
    }

    if (existing) {
      // Update existing user
      await db
        .update(users)
        .set({
          ...data,
          password: passwordHash,
          passwordChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id!));
      
      // Update the domain entity ID if it was null
      if (!user.id) {
        user._setId(existing.id!);
      }
    } else {
      // Insert new user
      const [inserted] = await db.insert(users).values({
        ...data,
        password: passwordHash,
        passwordChangedAt: new Date(),
      }).returning({ id: users.id });
      
      // Set the generated ID on the domain entity
      user._setId(inserted.id);
    }
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
      passwordChangedAt: user.passwordChangedAt,
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
      passwordChangedAt: row.passwordChangedAt,
      createdAt: row.createdAt,
    });
  }
}
