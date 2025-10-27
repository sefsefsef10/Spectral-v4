/**
 * DOMAIN ENTITY: User
 * 
 * Encapsulates business logic for user management, authentication, and authorization.
 * Handles user lifecycle, role-based access control (RBAC), and security policies.
 * 
 * Clean Architecture: This entity contains PURE business logic with NO external dependencies.
 */

export type UserRole = 'viewer' | 'analyst' | 'admin' | 'executive' | 'super_admin';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';

export interface UserPermission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

export interface UserProps {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  healthSystemId: string;
  permissions?: UserPermission[];
  lastLoginAt?: Date;
  failedLoginAttempts?: number;
  accountLockedUntil?: Date;
  passwordChangedAt?: Date;
  mustChangePassword?: boolean;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
}

/**
 * User Domain Entity
 * 
 * Business Rules:
 * 1. Users must have valid email addresses (RFC 5322 compliant)
 * 2. Passwords must meet complexity requirements (8+ chars, uppercase, lowercase, number, special)
 * 3. Account locks after 5 failed login attempts for 30 minutes
 * 4. Super admins can access all resources across all health systems
 * 5. Regular users are scoped to their health system only
 * 6. Password must be changed every 90 days for compliance
 * 7. New users start in 'pending_verification' status
 */
export class User {
  private constructor(private props: UserProps) {}

  // ============================================================
  // FACTORY METHODS
  // ============================================================

  /**
   * Create a new User with business validation
   */
  static create(
    props: Omit<UserProps, 'id' | 'status' | 'createdAt' | 'failedLoginAttempts'>
  ): User {
    // Validation: Email
    if (!User.isValidEmail(props.email)) {
      throw new Error('Invalid email format');
    }

    // Validation: Name
    if (!props.firstName?.trim() || props.firstName.length > 100) {
      throw new Error('First name is required and must not exceed 100 characters');
    }
    if (!props.lastName?.trim() || props.lastName.length > 100) {
      throw new Error('Last name is required and must not exceed 100 characters');
    }

    // Validation: Role
    const validRoles: UserRole[] = ['viewer', 'analyst', 'admin', 'executive', 'super_admin'];
    if (!validRoles.includes(props.role)) {
      throw new Error(`Invalid role: ${props.role}`);
    }

    // Validation: Health System
    if (!props.healthSystemId?.trim()) {
      throw new Error('Health system ID is required');
    }

    return new User({
      ...props,
      status: 'pending_verification',
      createdAt: new Date(),
      failedLoginAttempts: 0,
    });
  }

  /**
   * Reconstruct User from database (for repositories)
   */
  static fromPersistence(props: UserProps): User {
    if (!props.id) {
      throw new Error('User ID is required when reconstructing from persistence');
    }
    return new User(props);
  }

  // ============================================================
  // BUSINESS LOGIC: Email Validation
  // ============================================================

  private static isValidEmail(email: string): boolean {
    if (!email || email.length > 254) {
      return false;
    }

    // RFC 5322 simplified validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  }

  // ============================================================
  // BUSINESS LOGIC: Password Policies
  // ============================================================

  /**
   * Validate password complexity
   * Business Rule: 8+ chars, uppercase, lowercase, number, special character
   */
  static validatePasswordComplexity(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!password || password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if password needs to be changed (90-day policy)
   */
  mustChangePasswordDueToAge(): boolean {
    if (this.props.mustChangePassword) {
      return true;
    }

    if (!this.props.passwordChangedAt) {
      return true; // Never changed, must change
    }

    const now = new Date();
    const ageMs = now.getTime() - this.props.passwordChangedAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    return ageDays > 90;
  }

  /**
   * Record password change
   */
  recordPasswordChange(): void {
    this.props.passwordChangedAt = new Date();
    this.props.mustChangePassword = false;
    this.props.updatedAt = new Date();
  }

  // ============================================================
  // BUSINESS LOGIC: Authentication & Security
  // ============================================================

  /**
   * Record successful login
   */
  recordSuccessfulLogin(): void {
    this.props.lastLoginAt = new Date();
    this.props.failedLoginAttempts = 0;
    this.props.accountLockedUntil = undefined;
    this.props.updatedAt = new Date();
  }

  /**
   * Record failed login attempt
   * Business Rule: Lock account after 5 failed attempts for 30 minutes
   */
  recordFailedLoginAttempt(): void {
    this.props.failedLoginAttempts = (this.props.failedLoginAttempts || 0) + 1;
    this.props.updatedAt = new Date();

    if (this.props.failedLoginAttempts >= 5) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + 30);
      this.props.accountLockedUntil = lockUntil;
    }
  }

  /**
   * Check if account is currently locked
   */
  isAccountLocked(): boolean {
    if (!this.props.accountLockedUntil) {
      return false;
    }

    const now = new Date();
    if (now < this.props.accountLockedUntil) {
      return true; // Still locked
    }

    // Lock expired, clear it
    this.props.accountLockedUntil = undefined;
    this.props.failedLoginAttempts = 0;
    return false;
  }

  // ============================================================
  // BUSINESS LOGIC: User Lifecycle
  // ============================================================

  /**
   * Activate user account
   */
  activate(): void {
    if (this.props.status === 'active') {
      throw new Error('User is already active');
    }
    this.props.status = 'active';
    this.props.updatedAt = new Date();
  }

  /**
   * Deactivate user account
   */
  deactivate(): void {
    if (this.props.status === 'inactive') {
      throw new Error('User is already inactive');
    }
    this.props.status = 'inactive';
    this.props.updatedAt = new Date();
  }

  /**
   * Suspend user account
   */
  suspend(reason?: string): void {
    if (this.props.status === 'suspended') {
      throw new Error('User is already suspended');
    }
    this.props.status = 'suspended';
    this.props.updatedAt = new Date();
  }

  /**
   * Verify user account (complete registration)
   */
  verify(): void {
    if (this.props.status !== 'pending_verification') {
      throw new Error('Only pending users can be verified');
    }
    this.props.status = 'active';
    this.props.updatedAt = new Date();
  }

  // ============================================================
  // BUSINESS LOGIC: Role Management
  // ============================================================

  /**
   * Update user role
   */
  updateRole(newRole: UserRole, updatedBy: string): void {
    const validRoles: UserRole[] = ['viewer', 'analyst', 'admin', 'executive', 'super_admin'];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid role: ${newRole}`);
    }

    this.props.role = newRole;
    this.props.updatedAt = new Date();
  }

  /**
   * Get role hierarchy level (for permission checks)
   */
  getRoleLevel(): number {
    const levels: Record<UserRole, number> = {
      viewer: 1,
      analyst: 2,
      admin: 3,
      executive: 4,
      super_admin: 5,
    };
    return levels[this.props.role];
  }

  /**
   * Check if user has higher role than another user
   */
  hasHigherRoleThan(otherUser: User): boolean {
    return this.getRoleLevel() > otherUser.getRoleLevel();
  }

  // ============================================================
  // BUSINESS LOGIC: Permissions (RBAC)
  // ============================================================

  /**
   * Check if user has permission for a specific resource and action
   */
  hasPermission(resource: string, action: 'create' | 'read' | 'update' | 'delete'): boolean {
    // Super admins have all permissions
    if (this.props.role === 'super_admin') {
      return true;
    }

    // Check explicit permissions
    if (this.props.permissions) {
      const permission = this.props.permissions.find(p => p.resource === resource);
      if (permission && permission.actions.includes(action)) {
        return true;
      }
    }

    // Role-based default permissions
    return this.getDefaultPermissionsByRole(resource, action);
  }

  /**
   * Get default permissions based on role
   */
  private getDefaultPermissionsByRole(resource: string, action: 'create' | 'read' | 'update' | 'delete'): boolean {
    switch (this.props.role) {
      case 'executive':
        return action === 'read'; // Executives can read all, but not modify
      case 'admin':
        return true; // Admins have full access within their health system
      case 'analyst':
        return action === 'read' || action === 'create'; // Analysts can read and create reports/alerts
      case 'viewer':
        return action === 'read'; // Viewers can only read
      default:
        return false;
    }
  }

  /**
   * Check if user can access a specific health system
   */
  canAccessHealthSystem(healthSystemId: string): boolean {
    // Super admins can access all health systems
    if (this.props.role === 'super_admin') {
      return true;
    }

    // Regular users can only access their own health system
    return this.props.healthSystemId === healthSystemId;
  }

  // ============================================================
  // BUSINESS LOGIC: Profile Management
  // ============================================================

  /**
   * Update user profile information
   */
  updateProfile(updates: { firstName?: string; lastName?: string; email?: string }): void {
    if (updates.email) {
      if (!User.isValidEmail(updates.email)) {
        throw new Error('Invalid email format');
      }
      this.props.email = updates.email;
    }

    if (updates.firstName !== undefined) {
      if (!updates.firstName.trim() || updates.firstName.length > 100) {
        throw new Error('First name is required and must not exceed 100 characters');
      }
      this.props.firstName = updates.firstName;
    }

    if (updates.lastName !== undefined) {
      if (!updates.lastName.trim() || updates.lastName.length > 100) {
        throw new Error('Last name is required and must not exceed 100 characters');
      }
      this.props.lastName = updates.lastName;
    }

    this.props.updatedAt = new Date();
  }

  /**
   * Get user's full name
   */
  getFullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`;
  }

  // ============================================================
  // INTERNAL ID MANAGEMENT
  // ============================================================

  /**
   * Set the ID after persistence (called by repository)
   * @internal
   */
  _setId(id: string): void {
    if (this.props.id) {
      throw new Error('Cannot set ID on a user that already has one');
    }
    this.props.id = id;
  }

  // ============================================================
  // GETTERS
  // ============================================================

  get id(): string | undefined {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get firstName(): string {
    return this.props.firstName;
  }

  get lastName(): string {
    return this.props.lastName;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get healthSystemId(): string {
    return this.props.healthSystemId;
  }

  get permissions(): UserPermission[] | undefined {
    return this.props.permissions;
  }

  get lastLoginAt(): Date | undefined {
    return this.props.lastLoginAt;
  }

  get failedLoginAttempts(): number | undefined {
    return this.props.failedLoginAttempts;
  }

  get accountLockedUntil(): Date | undefined {
    return this.props.accountLockedUntil;
  }

  get passwordChangedAt(): Date | undefined {
    return this.props.passwordChangedAt;
  }

  get mustChangePassword(): boolean | undefined {
    return this.props.mustChangePassword;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get createdBy(): string | undefined {
    return this.props.createdBy;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  /**
   * Get a deep copy of all properties (for snapshots/auditing)
   */
  toSnapshot(): Readonly<UserProps> {
    return Object.freeze({
      ...this.props,
      permissions: this.props.permissions ? [...this.props.permissions] : undefined,
    });
  }
}
