/**
 * APPLICATION LAYER TESTS: User Management Use Cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RegisterUserUseCase, type UserRepository as RegisterUserRepository, type PasswordHasher } from '../../../server/application/user-management/RegisterUserUseCase';
import { UpdateUserRoleUseCase, type UserRepository as UpdateUserRepository } from '../../../server/application/user-management/UpdateUserRoleUseCase';
import { DeactivateUserUseCase, type UserRepository as DeactivateUserRepository } from '../../../server/application/user-management/DeactivateUserUseCase';
import { ValidatePermissionsUseCase, type UserRepository as ValidateUserRepository } from '../../../server/application/user-management/ValidatePermissionsUseCase';
import { User } from '../../../server/domain/entities/User';

describe('RegisterUserUseCase', () => {
  let mockUserRepository: RegisterUserRepository;
  let mockPasswordHasher: PasswordHasher;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    mockUserRepository = {
      save: vi.fn(),
      saveWithPassword: vi.fn(),
      findByEmail: vi.fn(),
    };
    mockPasswordHasher = {
      hash: vi.fn().mockResolvedValue('hashed-password'),
    };
    useCase = new RegisterUserUseCase(mockUserRepository, mockPasswordHasher);
  });

  it('should register new user successfully', async () => {
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);

    const result = await useCase.execute({
      email: 'john@hospital.com',
      password: 'SecureP@ss123',
      firstName: 'John',
      lastName: 'Doe',
      role: 'analyst',
      healthSystemId: 'hs-123',
    });

    expect(result.email).toBe('john@hospital.com');
    expect(result.status).toBe('pending_verification');
    expect(mockPasswordHasher.hash).toHaveBeenCalledWith('SecureP@ss123');
    expect(mockUserRepository.saveWithPassword).toHaveBeenCalledWith(
      expect.any(Object),
      'hashed-password'
    );
  });

  it('should reject duplicate email', async () => {
    const existingUser = User.create({
      email: 'john@hospital.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'analyst',
      healthSystemId: 'hs-123',
    });
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(existingUser);

    await expect(useCase.execute({
      email: 'john@hospital.com',
      password: 'SecureP@ss123',
      firstName: 'John',
      lastName: 'Doe',
      role: 'analyst',
      healthSystemId: 'hs-123',
    })).rejects.toThrow('Email already registered');
  });

  it('should reject weak password', async () => {
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);

    await expect(useCase.execute({
      email: 'john@hospital.com',
      password: 'weak',
      firstName: 'John',
      lastName: 'Doe',
      role: 'analyst',
      healthSystemId: 'hs-123',
    })).rejects.toThrow('Password validation failed');
  });
});

describe('UpdateUserRoleUseCase', () => {
  let mockUserRepository: UpdateUserRepository;
  let useCase: UpdateUserRoleUseCase;

  beforeEach(() => {
    mockUserRepository = {
      save: vi.fn(),
      findById: vi.fn(),
    };
    useCase = new UpdateUserRoleUseCase(mockUserRepository);
  });

  it('should update user role successfully', async () => {
    const user = User.create({
      email: 'john@hospital.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'analyst',
      healthSystemId: 'hs-123',
    });
    user._setId('user-123');

    const admin = User.create({
      email: 'admin@hospital.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      healthSystemId: 'hs-123',
    });
    admin._setId('admin-456');

    vi.mocked(mockUserRepository.findById)
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(admin);

    const result = await useCase.execute({
      userId: 'user-123',
      newRole: 'executive',
      updatedBy: 'admin-456',
    });

    expect(result.newRole).toBe('executive');
    expect(mockUserRepository.save).toHaveBeenCalledWith(user);
  });

  it('should reject unauthorized role update', async () => {
    const user = User.create({
      email: 'john@hospital.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'admin',
      healthSystemId: 'hs-123',
    });
    user._setId('user-123');

    const analyst = User.create({
      email: 'analyst@hospital.com',
      firstName: 'Analyst',
      lastName: 'User',
      role: 'analyst',
      healthSystemId: 'hs-123',
    });
    analyst._setId('analyst-456');

    vi.mocked(mockUserRepository.findById)
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(analyst);

    await expect(useCase.execute({
      userId: 'user-123',
      newRole: 'executive',
      updatedBy: 'analyst-456',
    })).rejects.toThrow('Insufficient permissions');
  });
});

describe('DeactivateUserUseCase', () => {
  let mockUserRepository: DeactivateUserRepository;
  let useCase: DeactivateUserUseCase;

  beforeEach(() => {
    mockUserRepository = {
      save: vi.fn(),
      findById: vi.fn(),
    };
    useCase = new DeactivateUserUseCase(mockUserRepository);
  });

  it('should deactivate user successfully', async () => {
    const user = User.create({
      email: 'john@hospital.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'analyst',
      healthSystemId: 'hs-123',
    });
    user._setId('user-123');
    user.activate();

    const admin = User.create({
      email: 'admin@hospital.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      healthSystemId: 'hs-123',
    });
    admin._setId('admin-456');

    vi.mocked(mockUserRepository.findById)
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(admin);

    const result = await useCase.execute({
      userId: 'user-123',
      deactivatedBy: 'admin-456',
    });

    expect(result.status).toBe('inactive');
    expect(mockUserRepository.save).toHaveBeenCalledWith(user);
  });
});

describe('ValidatePermissionsUseCase', () => {
  let mockUserRepository: ValidateUserRepository;
  let useCase: ValidatePermissionsUseCase;

  beforeEach(() => {
    mockUserRepository = {
      findById: vi.fn(),
    };
    useCase = new ValidatePermissionsUseCase(mockUserRepository);
  });

  it('should validate permissions successfully', async () => {
    const admin = User.create({
      email: 'admin@hospital.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      healthSystemId: 'hs-123',
    });
    admin._setId('admin-456');

    vi.mocked(mockUserRepository.findById).mockResolvedValue(admin);

    const result = await useCase.execute({
      userId: 'admin-456',
      resource: 'ai_systems',
      action: 'delete',
      healthSystemId: 'hs-123',
    });

    expect(result.hasPermission).toBe(true);
    expect(result.canAccessHealthSystem).toBe(true);
    expect(result.userRole).toBe('admin');
  });

  it('should deny cross-health-system access', async () => {
    const analyst = User.create({
      email: 'analyst@hospital.com',
      firstName: 'Analyst',
      lastName: 'User',
      role: 'analyst',
      healthSystemId: 'hs-123',
    });
    analyst._setId('analyst-456');

    vi.mocked(mockUserRepository.findById).mockResolvedValue(analyst);

    const result = await useCase.execute({
      userId: 'analyst-456',
      resource: 'reports',
      action: 'read',
      healthSystemId: 'hs-999', // Different health system
    });

    expect(result.canAccessHealthSystem).toBe(false);
  });
});
