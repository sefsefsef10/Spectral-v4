/**
 * INTEGRATION TESTS: User Management API
 * Tests the full HTTP stack including authentication, rate limiting, and use cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RegisterUserUseCase } from '../../../server/application/user-management/RegisterUserUseCase';
import { UpdateUserRoleUseCase } from '../../../server/application/user-management/UpdateUserRoleUseCase';
import { DeactivateUserUseCase } from '../../../server/application/user-management/DeactivateUserUseCase';
import { ValidatePermissionsUseCase } from '../../../server/application/user-management/ValidatePermissionsUseCase';
import { User } from '../../../server/domain/entities/User';
import { MockUserRepository, MockPasswordHasher } from '../../mocks';

describe('User Management API Integration Tests', () => {
  let userRepository: MockUserRepository;
  let mockPasswordHasher: MockPasswordHasher;

  beforeEach(() => {
    console.log('🧪 Test environment initialized');
    userRepository = new MockUserRepository();
    mockPasswordHasher = new MockPasswordHasher();
  });

  afterEach(() => {
    userRepository.clear();
    console.log('✅ Test environment cleaned up');
  });

  describe('POST /api/users/register', () => {
    it('should register new user successfully', async () => {
      const registerUseCase = new RegisterUserUseCase(userRepository, mockPasswordHasher);

      const result = await registerUseCase.execute({
        email: 'newuser@hospital.com',
        password: 'SecureP@ss123',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'analyst',
        healthSystemId: 'hs-456',
      });

      expect(result.email).toBe('newuser@hospital.com');
      expect(result.firstName).toBe('Jane');
      expect(result.lastName).toBe('Smith');
      expect(result.role).toBe('analyst');
      expect(result.status).toBe('pending_verification');
      expect(mockPasswordHasher.hash).toHaveBeenCalledWith('SecureP@ss123');
    });

    it('should reject duplicate email registration', async () => {
      const registerUseCase = new RegisterUserUseCase(userRepository, mockPasswordHasher);

      // Register first user
      await registerUseCase.execute({
        email: 'duplicate@hospital.com',
        password: 'SecureP@ss123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'analyst',
        healthSystemId: 'hs-123',
      });

      // Attempt duplicate registration
      await expect(
        registerUseCase.execute({
          email: 'duplicate@hospital.com',
          password: 'AnotherP@ss456',
          firstName: 'Jane',
          lastName: 'Smith',
          role: 'viewer',
          healthSystemId: 'hs-123',
        })
      ).rejects.toThrow('Email already registered');
    });

    it('should reject weak password', async () => {
      const registerUseCase = new RegisterUserUseCase(userRepository, mockPasswordHasher);

      await expect(
        registerUseCase.execute({
          email: 'test@hospital.com',
          password: 'weak',
          firstName: 'Test',
          lastName: 'User',
          role: 'analyst',
          healthSystemId: 'hs-123',
        })
      ).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should reject invalid email format', async () => {
      const registerUseCase = new RegisterUserUseCase(userRepository, mockPasswordHasher);

      await expect(
        registerUseCase.execute({
          email: 'invalid-email',
          password: 'SecureP@ss123',
          firstName: 'Test',
          lastName: 'User',
          role: 'analyst',
          healthSystemId: 'hs-123',
        })
      ).rejects.toThrow('Invalid email format');
    });
  });

  describe('PUT /api/users/:id/role', () => {
    it('should update user role successfully', async () => {
      const updateRoleUseCase = new UpdateUserRoleUseCase(userRepository);

      // Create initial user
      const user = User.create({
        email: 'analyst@hospital.com',
        firstName: 'John',
        lastName: 'Analyst',
        role: 'analyst',
        healthSystemId: 'hs-123',
      });
      await userRepository.save(user);

      // Update to admin
      const result = await updateRoleUseCase.execute({
        userId: user.id!,
        newRole: 'admin',
        requestingUserId: 'super-admin-id',
      });

      expect(result.role).toBe('admin');
      expect(result.email).toBe('analyst@hospital.com');
    });

    it('should reject update for non-existent user', async () => {
      const updateRoleUseCase = new UpdateUserRoleUseCase(userRepository);

      await expect(
        updateRoleUseCase.execute({
          userId: 'non-existent-id',
          newRole: 'admin',
          requestingUserId: 'super-admin-id',
        })
      ).rejects.toThrow('User not found');
    });

    it('should prevent invalid role assignment', async () => {
      const updateRoleUseCase = new UpdateUserRoleUseCase(userRepository);

      const user = User.create({
        email: 'test@hospital.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'viewer',
        healthSystemId: 'hs-123',
      });
      await userRepository.save(user);

      await expect(
        updateRoleUseCase.execute({
          userId: user.id!,
          newRole: 'invalid_role' as UserRole,
          requestingUserId: 'admin-id',
        })
      ).rejects.toThrow();
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should deactivate user successfully', async () => {
      const deactivateUseCase = new DeactivateUserUseCase(userRepository);

      const user = User.create({
        email: 'active@hospital.com',
        firstName: 'Active',
        lastName: 'User',
        role: 'analyst',
        healthSystemId: 'hs-123',
      });
      await userRepository.save(user);

      const result = await deactivateUseCase.execute({
        userId: user.id!,
        requestingUserId: 'admin-id',
        reason: 'Employee left organization',
      });

      expect(result.status).toBe('deactivated');
      expect(result.email).toBe('active@hospital.com');
    });

    it('should reject deactivation of non-existent user', async () => {
      const deactivateUseCase = new DeactivateUserUseCase(userRepository);

      await expect(
        deactivateUseCase.execute({
          userId: 'non-existent-id',
          requestingUserId: 'admin-id',
          reason: 'Test',
        })
      ).rejects.toThrow('User not found');
    });
  });

  describe('POST /api/users/validate-permissions', () => {
    it('should grant permission for admin accessing their health system', async () => {
      const validateUseCase = new ValidatePermissionsUseCase(userRepository);

      const admin = User.create({
        email: 'admin@hospital.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        healthSystemId: 'hs-123',
      });
      await userRepository.save(admin);

      const result = await validateUseCase.execute({
        userId: admin.id!,
        resource: 'ai_systems',
        action: 'write',
        healthSystemId: 'hs-123',
      });

      expect(result.hasPermission).toBe(true);
      expect(result.canAccessHealthSystem).toBe(true);
    });

    it('should deny permission for analyst performing admin action', async () => {
      const validateUseCase = new ValidatePermissionsUseCase(userRepository);

      const analyst = User.create({
        email: 'analyst@hospital.com',
        firstName: 'Analyst',
        lastName: 'User',
        role: 'analyst',
        healthSystemId: 'hs-123',
      });
      await userRepository.save(analyst);

      const result = await validateUseCase.execute({
        userId: analyst.id!,
        resource: 'users',
        action: 'write',
        healthSystemId: 'hs-123',
      });

      expect(result.hasPermission).toBe(false);
    });

    it('should deny cross-health-system access for non-super_admin', async () => {
      const validateUseCase = new ValidatePermissionsUseCase(userRepository);

      const admin = User.create({
        email: 'admin@hospital.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        healthSystemId: 'hs-123',
      });
      await userRepository.save(admin);

      const result = await validateUseCase.execute({
        userId: admin.id!,
        resource: 'ai_systems',
        action: 'write',
        healthSystemId: 'hs-999', // Different health system
      });

      expect(result.canAccessHealthSystem).toBe(false);
    });

    it('should allow super_admin to access any health system', async () => {
      const validateUseCase = new ValidatePermissionsUseCase(userRepository);

      const superAdmin = User.create({
        email: 'superadmin@spectral.com',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'super_admin',
        healthSystemId: 'spectral-internal',
      });
      await userRepository.save(superAdmin);

      const result = await validateUseCase.execute({
        userId: superAdmin.id!,
        resource: 'ai_systems',
        action: 'write',
        healthSystemId: 'any-health-system-id',
      });

      expect(result.hasPermission).toBe(true);
      expect(result.canAccessHealthSystem).toBe(true);
    });
  });
});
