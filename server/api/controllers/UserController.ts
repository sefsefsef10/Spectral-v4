/**
 * API LAYER: User Controller
 * REST endpoints for user management using Clean Architecture use cases
 */

import { Request, Response } from 'express';
import { RegisterUserUseCase } from '../../application/user-management/RegisterUserUseCase';
import { UpdateUserRoleUseCase } from '../../application/user-management/UpdateUserRoleUseCase';
import { DeactivateUserUseCase } from '../../application/user-management/DeactivateUserUseCase';
import { ValidatePermissionsUseCase } from '../../application/user-management/ValidatePermissionsUseCase';
import { DrizzleUserRepository } from '../../infrastructure/repositories/DrizzleUserRepository';
import bcrypt from 'bcryptjs';

// Password hasher implementation
const passwordHasher = {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  },
};

export class UserController {
  /**
   * POST /api/users/register
   * Register a new user with password hashing and RBAC
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, firstName, lastName, role, healthSystemId } = req.body;

      // Validation
      if (!email || !password || !firstName || !lastName || !role || !healthSystemId) {
        res.status(400).json({ 
          error: 'Missing required fields',
          required: ['email', 'password', 'firstName', 'lastName', 'role', 'healthSystemId']
        });
        return;
      }

      // Initialize use case with dependencies
      const userRepository = new DrizzleUserRepository();
      const registerUser = new RegisterUserUseCase(userRepository, passwordHasher);

      // Execute business logic
      const result = await registerUser.execute({
        email,
        password,
        firstName,
        lastName,
        role,
        healthSystemId,
        createdBy: req.user?.id, // From auth middleware
      });

      res.status(201).json({
        success: true,
        user: {
          id: result.userId,
          email: result.email,
          status: result.status,
        },
      });
    } catch (error: any) {
      if (error.message.includes('Email already registered')) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }
      if (error.message.includes('Password validation failed')) {
        res.status(400).json({ error: error.message });
        return;
      }
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * PUT /api/users/:id/role
   * Update user role with permission checks
   */
  static async updateRole(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { newRole } = req.body;

      if (!newRole) {
        res.status(400).json({ error: 'New role is required' });
        return;
      }

      const userRepository = new DrizzleUserRepository();
      const updateUserRole = new UpdateUserRoleUseCase(userRepository);

      const result = await updateUserRole.execute({
        userId: id,
        newRole,
        requestingUserId: req.user?.id!,
      });

      res.json({
        success: true,
        userId: result.userId,
        newRole: result.newRole,
      });
    } catch (error: any) {
      if (error.message.includes('not authorized')) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      console.error('Role update error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * DELETE /api/users/:id
   * Deactivate user (soft delete)
   */
  static async deactivate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const userRepository = new DrizzleUserRepository();
      const deactivateUser = new DeactivateUserUseCase(userRepository);

      const result = await deactivateUser.execute({
        userId: id,
        deactivatedBy: req.user?.id!,
      });

      res.json({
        success: true,
        userId: result.userId,
        deactivatedAt: result.deactivatedAt,
      });
    } catch (error: any) {
      console.error('Deactivation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * POST /api/users/validate-permissions
   * Validate user permissions for a resource
   */
  static async validatePermissions(req: Request, res: Response): Promise<void> {
    try {
      const { userId, resource, action, resourceHealthSystemId } = req.body;

      const userRepository = new DrizzleUserRepository();
      const validatePermissions = new ValidatePermissionsUseCase(userRepository);

      const result = await validatePermissions.execute({
        userId,
        resource,
        action,
        resourceHealthSystemId,
      });

      res.json({
        allowed: result.allowed,
        reason: result.reason,
      });
    } catch (error: any) {
      console.error('Permission validation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
