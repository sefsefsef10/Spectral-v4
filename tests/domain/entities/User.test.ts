/**
 * DOMAIN TESTS: User Entity
 */

import { describe, it, expect } from 'vitest';
import { User } from '../../../server/domain/entities/User';

describe('User Domain Entity', () => {
  const validProps = {
    email: 'john.doe@hospital.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'analyst' as const,
    healthSystemId: 'hs-123',
  };

  describe('Creation & Validation', () => {
    it('should create valid user', () => {
      const user = User.create(validProps);
      expect(user.email).toBe('john.doe@hospital.com');
      expect(user.status).toBe('pending_verification');
      expect(user.failedLoginAttempts).toBe(0);
    });

    it('should reject invalid email', () => {
      expect(() => User.create({ ...validProps, email: 'invalid-email' })).toThrow('Invalid email format');
    });

    it('should reject empty first name', () => {
      expect(() => User.create({ ...validProps, firstName: '' })).toThrow('First name is required');
    });

    it('should reject invalid role', () => {
      expect(() => User.create({ ...validProps, role: 'invalid' as any })).toThrow('Invalid role');
    });
  });

  describe('Password Policies', () => {
    it('should validate strong password', () => {
      const result = User.validatePasswordComplexity('SecureP@ss123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak password', () => {
      const result = User.validatePasswordComplexity('weak');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require password change after 90 days', () => {
      const user = User.fromPersistence({
        id: 'user-123',
        ...validProps,
        status: 'active',
        passwordChangedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
        createdAt: new Date(),
      });
      expect(user.mustChangePasswordDueToAge()).toBe(true);
    });

    it('should not require password change within 90 days', () => {
      const user = User.fromPersistence({
        id: 'user-123',
        ...validProps,
        status: 'active',
        passwordChangedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        createdAt: new Date(),
      });
      expect(user.mustChangePasswordDueToAge()).toBe(false);
    });
  });

  describe('Authentication & Security', () => {
    it('should record successful login', () => {
      const user = User.create(validProps);
      user.recordSuccessfulLogin();
      expect(user.lastLoginAt).toBeInstanceOf(Date);
      expect(user.failedLoginAttempts).toBe(0);
    });

    it('should lock account after 5 failed login attempts', () => {
      const user = User.create(validProps);
      for (let i = 0; i < 5; i++) {
        user.recordFailedLoginAttempt();
      }
      expect(user.isAccountLocked()).toBe(true);
      expect(user.accountLockedUntil).toBeInstanceOf(Date);
    });

    it('should unlock account after 30 minutes', () => {
      const user = User.fromPersistence({
        id: 'user-123',
        ...validProps,
        status: 'active',
        failedLoginAttempts: 5,
        accountLockedUntil: new Date(Date.now() - 31 * 60 * 1000), // 31 minutes ago
        createdAt: new Date(),
      });
      expect(user.isAccountLocked()).toBe(false);
    });
  });

  describe('User Lifecycle', () => {
    it('should activate pending user', () => {
      const user = User.create(validProps);
      user.activate();
      expect(user.status).toBe('active');
    });

    it('should verify pending user', () => {
      const user = User.create(validProps);
      user.verify();
      expect(user.status).toBe('active');
    });

    it('should deactivate user', () => {
      const user = User.create(validProps);
      user.activate();
      user.deactivate();
      expect(user.status).toBe('inactive');
    });

    it('should suspend user', () => {
      const user = User.create(validProps);
      user.activate();
      user.suspend('Policy violation');
      expect(user.status).toBe('suspended');
    });
  });

  describe('Role Management', () => {
    it('should update user role', () => {
      const user = User.create(validProps);
      user.updateRole('admin', 'super-admin-123');
      expect(user.role).toBe('admin');
    });

    it('should compare role levels', () => {
      const admin = User.create({ ...validProps, role: 'admin' });
      const viewer = User.create({ ...validProps, role: 'viewer', email: 'viewer@hospital.com' });
      expect(admin.hasHigherRoleThan(viewer)).toBe(true);
      expect(viewer.hasHigherRoleThan(admin)).toBe(false);
    });

    it('should get correct role level', () => {
      const superAdmin = User.create({ ...validProps, role: 'super_admin' });
      const viewer = User.create({ ...validProps, role: 'viewer', email: 'viewer@hospital.com' });
      expect(superAdmin.getRoleLevel()).toBe(5);
      expect(viewer.getRoleLevel()).toBe(1);
    });
  });

  describe('Permissions (RBAC)', () => {
    it('should grant super admin all permissions', () => {
      const superAdmin = User.create({ ...validProps, role: 'super_admin' });
      expect(superAdmin.hasPermission('alerts', 'delete')).toBe(true);
      expect(superAdmin.hasPermission('reports', 'create')).toBe(true);
    });

    it('should grant admin full access within health system', () => {
      const admin = User.create({ ...validProps, role: 'admin' });
      expect(admin.hasPermission('ai_systems', 'create')).toBe(true);
      expect(admin.hasPermission('ai_systems', 'delete')).toBe(true);
    });

    it('should limit viewer to read-only', () => {
      const viewer = User.create({ ...validProps, role: 'viewer' });
      expect(viewer.hasPermission('reports', 'read')).toBe(true);
      expect(viewer.hasPermission('reports', 'delete')).toBe(false);
    });

    it('should allow super admin to access all health systems', () => {
      const superAdmin = User.create({ ...validProps, role: 'super_admin' });
      expect(superAdmin.canAccessHealthSystem('hs-123')).toBe(true);
      expect(superAdmin.canAccessHealthSystem('hs-456')).toBe(true);
    });

    it('should restrict regular users to their health system', () => {
      const analyst = User.create({ ...validProps, role: 'analyst' });
      expect(analyst.canAccessHealthSystem('hs-123')).toBe(true);
      expect(analyst.canAccessHealthSystem('hs-456')).toBe(false);
    });
  });

  describe('Profile Management', () => {
    it('should update profile information', () => {
      const user = User.create(validProps);
      user.updateProfile({ firstName: 'Jane', lastName: 'Smith' });
      expect(user.firstName).toBe('Jane');
      expect(user.lastName).toBe('Smith');
    });

    it('should get full name', () => {
      const user = User.create(validProps);
      expect(user.getFullName()).toBe('John Doe');
    });

    it('should reject invalid email in profile update', () => {
      const user = User.create(validProps);
      expect(() => user.updateProfile({ email: 'invalid' })).toThrow('Invalid email format');
    });
  });
});
