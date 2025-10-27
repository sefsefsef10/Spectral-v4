/**
 * APPLICATION LAYER USE CASE: Register User
 */

import { User, type UserRole } from '../../domain/entities/User';

export interface UserRepository {
  save(user: User): Promise<void>;
  saveWithPassword(user: User, passwordHash: string): Promise<void>;
  findByEmail(email: string): Promise<User | null>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
}

export interface RegisterUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  healthSystemId: string;
  createdBy?: string;
}

export interface RegisterUserResult {
  userId: string;
  email: string;
  status: string;
}

export class RegisterUserUseCase {
  constructor(
    private userRepository: UserRepository,
    private passwordHasher: PasswordHasher
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserResult> {
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    const passwordValidation = User.validatePasswordComplexity(input.password);
    if (!passwordValidation.valid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = User.create({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      healthSystemId: input.healthSystemId,
      createdBy: input.createdBy,
    });

    await this.userRepository.saveWithPassword(user, passwordHash);

    return {
      userId: user.id!,
      email: user.email,
      status: user.status,
    };
  }
}
