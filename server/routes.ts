import { logger } from "./logger";
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { hashPassword, verifyPassword, sanitizeUser } from "./auth";
import { getCsrfToken } from "./middleware/csrf";
import { authRateLimit, apiRateLimit, mfaRateLimit, webhookRateLimit } from "./middleware/rate-limit";
import { verifyWebhookSignature } from "./middleware/webhook-signature";
import { generateMFASecret, verifyMFAToken, verifyBackupCode, hashBackupCodes } from "./services/mfa";
import { 
  insertUserSchema,
  insertUserInvitationSchema,
  insertAISystemSchema, 
  insertMonitoringAlertSchema,
  insertPredictiveAlertSchema,
  insertVendorSchema,
  insertHealthSystemSchema,
  insertDeploymentSchema,
  insertComplianceCertificationSchema
} from "@shared/schema";
import {
  langSmithWebhookSchema,
  arizeWebhookSchema,
  langFuseWebhookSchema,
  wandbWebhookSchema,
  epicWebhookSchema,
  cernerWebhookSchema,
  athenahealthWebhookSchema,
  pagerDutyWebhookSchema,
  dataDogWebhookSchema,
  twilioWebhookSchema,
  slackWebhookSchema,
  validateWebhookPayload,
} from "@shared/webhook-schemas";
import { DEMO_HEALTH_SYSTEM_ID, DEMO_VENDOR_VIZAI_ID } from "./constants";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

// Middleware to require authentication
function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

// Middleware to require specific role
function requireRole(role: "health_system" | "vendor") {
  return async (req: Request, res: Response, next: () => void) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== role) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// Middleware to validate tenant ownership for health system resources
async function validateHealthSystemAccess(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  
  // Get healthSystemId from query params or request body
  const healthSystemId = req.query.healthSystemId as string || req.body?.healthSystemId;
  
  if (!healthSystemId) {
    return res.status(400).json({ error: "healthSystemId is required" });
  }
  
  // Validate that the requested healthSystemId matches the user's organization
  if (user.healthSystemId !== healthSystemId) {
    return res.status(403).json({ error: "Access denied: You can only access your own organization's data" });
  }
  
  next();
}

// Middleware to validate tenant ownership for vendor resources
async function validateVendorAccess(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  
  // Get vendorId from query params, route params, or request body
  const vendorId = req.query.vendorId as string || req.params.vendorId || req.body?.vendorId;
  
  if (!vendorId) {
    return res.status(400).json({ error: "vendorId is required" });
  }
  
  // Validate that the requested vendorId matches the user's organization
  if (user.vendorId !== vendorId) {
    return res.status(403).json({ error: "Access denied: You can only access your own organization's data" });
  }
  
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ===== Security Routes =====
  
  // Get CSRF token for authenticated requests
  app.get("/api/csrf-token", getCsrfToken);
  
  // ===== Authentication Routes =====
  
  // Register new user (with rate limiting)
  app.post("/api/auth/register", authRateLimit, async (req, res) => {
    try {
      const schema = z.object({
        username: z.string().min(3),
        password: z.string().min(6),
        email: z.string().email(),
        role: z.enum(["health_system", "vendor"]),
        organizationName: z.string().min(2),
      });
      
      const data = schema.parse(req.body);
      
      // Check if username already exists
      const existing = await storage.getUserByUsername(data.username);
      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(data.password);
      
      // Create organization based on role
      let healthSystemId: string | null = null;
      let vendorId: string | null = null;
      
      if (data.role === "health_system") {
        const healthSystem = await storage.createHealthSystem({
          name: data.organizationName,
        });
        healthSystemId = healthSystem.id;
      } else {
        const vendor = await storage.createVendor({
          name: data.organizationName,
          verified: false,
        });
        vendorId = vendor.id;
      }
      
      // Create user with org association - first user is admin
      const user = await storage.createUser({
        username: data.username,
        password: hashedPassword,
        email: data.email,
        role: data.role,
        permissions: 'admin', // First user for organization is always admin
        healthSystemId,
        vendorId,
      });
      
      // Set session
      req.session.userId = user.id;
      
      res.status(201).json(sanitizeUser(user));
    } catch (error) {
      res.status(400).json({ error: "Invalid registration data" });
    }
  });
  
  // Login (with rate limiting and MFA support)
  app.post("/api/auth/login", authRateLimit, async (req, res) => {
    try {
      const schema = z.object({
        username: z.string(),
        password: z.string(),
        mfaToken: z.string().optional(),
      });
      
      const { username, password, mfaToken } = schema.parse(req.body);
      
      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Verify password
      const valid = await verifyPassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Check if MFA is enabled
      if (user.mfaEnabled && user.mfaSecret) {
        if (!mfaToken) {
          // Password correct but MFA required
          return res.status(200).json({ 
            mfaRequired: true,
            message: "MFA verification required"
          });
        }
        
        // Verify MFA token
        const mfaValid = verifyMFAToken(user.mfaSecret, mfaToken);
        if (!mfaValid) {
          return res.status(401).json({ error: "Invalid MFA token" });
        }
      }
      
      // Update last login
      await storage.updateUserLastLogin(user.id);
      
      // Set session
      req.session.userId = user.id;
      
      res.json(sanitizeUser(user));
    } catch (error) {
      res.status(400).json({ error: "Invalid login data" });
    }
  });
  
  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
  
  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json(sanitizeUser(user));
  });

  // ===== MFA/2FA Routes =====

  // Setup MFA - Generate QR code and backup codes
  app.post("/api/auth/mfa/setup", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.mfaEnabled) {
        return res.status(400).json({ error: "MFA already enabled" });
      }

      // Generate MFA secret and backup codes
      const { secret, qrCodeUrl, backupCodes } = await generateMFASecret(user.email);
      const hashedCodes = await hashBackupCodes(backupCodes);

      // Temporarily store in session for verification
      req.session.pendingMfaSecret = secret;
      req.session.pendingBackupCodes = hashedCodes;

      res.json({
        qrCodeUrl,
        backupCodes, // Show once to user (they must save these)
        secret, // For manual entry if QR doesn't work
      });
    } catch (error) {
      logger.error({ err: error }, "MFA setup error");
      res.status(500).json({ error: "Failed to setup MFA" });
    }
  });

  // Verify and enable MFA
  app.post("/api/auth/mfa/verify-setup", requireAuth, mfaRateLimit, async (req, res) => {
    try {
      const { token } = z.object({ token: z.string() }).parse(req.body);
      const user = await storage.getUser(req.session.userId!);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const pendingSecret = req.session.pendingMfaSecret;
      const pendingBackupCodes = req.session.pendingBackupCodes;

      if (!pendingSecret || !pendingBackupCodes) {
        return res.status(400).json({ error: "MFA setup not initiated" });
      }

      // Verify the token
      const valid = verifyMFAToken(pendingSecret, token);
      if (!valid) {
        return res.status(401).json({ error: "Invalid MFA token" });
      }

      // Enable MFA for user
      await storage.updateUser(user.id, {
        mfaEnabled: true,
        mfaSecret: pendingSecret,
        backupCodes: pendingBackupCodes,
      });

      // Clear pending MFA data from session
      delete req.session.pendingMfaSecret;
      delete req.session.pendingBackupCodes;

      logger.info({ userId: user.id }, "MFA enabled successfully");
      res.json({ success: true, message: "MFA enabled successfully" });
    } catch (error) {
      logger.error({ err: error }, "MFA verification error");
      res.status(500).json({ error: "Failed to verify MFA" });
    }
  });

  // Verify backup code and login
  app.post("/api/auth/mfa/backup", authRateLimit, async (req, res) => {
    try {
      const { username, password, backupCode } = z.object({
        username: z.string(),
        password: z.string(),
        backupCode: z.string(),
      }).parse(req.body);

      // Find and verify user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const validPassword = await verifyPassword(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (!user.mfaEnabled || !user.backupCodes) {
        return res.status(400).json({ error: "MFA not enabled" });
      }

      // Verify backup code
      const { valid, remainingCodes } = await verifyBackupCode(user.backupCodes, backupCode);
      if (!valid) {
        return res.status(401).json({ error: "Invalid backup code" });
      }

      // Update backup codes (remove used one)
      await storage.updateUser(user.id, { backupCodes: remainingCodes });

      // Set session
      req.session.userId = user.id;

      logger.info({ userId: user.id, remainingCodes: remainingCodes.length }, "Backup code used for login");
      res.json({
        ...sanitizeUser(user),
        backupCodesRemaining: remainingCodes.length,
      });
    } catch (error) {
      logger.error({ err: error }, "Backup code verification error");
      res.status(500).json({ error: "Failed to verify backup code" });
    }
  });

  // Disable MFA
  app.post("/api/auth/mfa/disable", requireAuth, async (req, res) => {
    try {
      const { password } = z.object({ password: z.string() }).parse(req.body);
      const user = await storage.getUser(req.session.userId!);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify password for security
      const validPassword = await verifyPassword(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid password" });
      }

      // Disable MFA
      await storage.updateUser(user.id, {
        mfaEnabled: false,
        mfaSecret: null,
        backupCodes: null,
      });

      logger.info({ userId: user.id }, "MFA disabled");
      res.json({ success: true, message: "MFA disabled successfully" });
    } catch (error) {
      logger.error({ err: error }, "MFA disable error");
      res.status(500).json({ error: "Failed to disable MFA" });
    }
  });
  
  // ===== User Management Routes =====
  
  // Get users for organization (admin only)
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Only admins can view user list
      if (currentUser.permissions !== 'admin') {
        return res.status(403).json({ error: "Only admins can view user list" });
      }
      
      const users = await storage.getUsersByOrganization(
        currentUser.healthSystemId || undefined,
        currentUser.vendorId || undefined
      );
      
      // Sanitize user data before returning
      const sanitized = users.map(u => sanitizeUser(u));
      res.json(sanitized);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  
  // Invite new user to organization
  app.post("/api/users/invite", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Only admins can invite users
      if (currentUser.permissions !== 'admin') {
        return res.status(403).json({ error: "Only admins can invite users" });
      }
      
      const schema = z.object({
        email: z.string().email(),
        permissions: z.enum(['admin', 'user', 'viewer']).default('user'),
      });
      
      const data = schema.parse(req.body);
      
      // Check if email already exists as user
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ error: "User with this email already exists" });
      }
      
      // Check if there's already a pending invitation
      const existingInvitations = await storage.getUserInvitationsByOrganization(
        currentUser.healthSystemId || undefined,
        currentUser.vendorId || undefined
      );
      const pendingInvite = existingInvitations.find(inv => inv.email === data.email && inv.status === 'pending');
      if (pendingInvite) {
        return res.status(400).json({ error: "Invitation already sent to this email" });
      }
      
      // Generate invitation token
      const token = `inv_${nanoid(32)}`;
      const tokenHash = await bcrypt.hash(token, 10);
      const tokenPrefix = token.substring(0, 8);
      
      // Create invitation
      const invitation = await storage.createUserInvitation({
        email: data.email,
        role: currentUser.role,
        permissions: data.permissions,
        healthSystemId: currentUser.healthSystemId,
        vendorId: currentUser.vendorId,
        tokenHash,
        tokenPrefix,
        invitedBy: currentUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });
      
      // Create audit log
      await storage.createAuditLog({
        userId: currentUser.id,
        action: 'invite_user',
        resourceType: 'user_invitation',
        resourceId: invitation.id,
        resourceName: data.email,
        metadata: { permissions: data.permissions },
        healthSystemId: currentUser.healthSystemId,
        vendorId: currentUser.vendorId,
      });
      
      // TODO: Send invitation email with token
      
      res.status(201).json({ 
        ...invitation, 
        invitationUrl: `${req.protocol}://${req.get('host')}/accept-invitation?token=${token}`
      });
    } catch (error) {
      logger.error({ err: error }, "Invite user error");
      res.status(400).json({ error: "Failed to send invitation" });
    }
  });
  
  // Update user
  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Only admins can update users
      if (currentUser.permissions !== 'admin') {
        return res.status(403).json({ error: "Only admins can update users" });
      }
      
      const schema = z.object({
        permissions: z.enum(['admin', 'user', 'viewer']).optional(),
        status: z.enum(['active', 'inactive']).optional(),
      });
      
      const updates = schema.parse(req.body);
      
      // Get the user being updated
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ error: "Target user not found" });
      }
      
      // Verify same organization
      if (currentUser.healthSystemId !== targetUser.healthSystemId || 
          currentUser.vendorId !== targetUser.vendorId) {
        return res.status(403).json({ error: "Cannot update users from other organizations" });
      }
      
      // Update user
      const updatedUser = await storage.updateUser(req.params.id, updates);
      
      // Create audit log
      await storage.createAuditLog({
        userId: currentUser.id,
        action: 'update',
        resourceType: 'user',
        resourceId: req.params.id,
        resourceName: targetUser.username,
        changes: { before: { permissions: targetUser.permissions, status: targetUser.status }, after: updates },
        healthSystemId: currentUser.healthSystemId,
        vendorId: currentUser.vendorId,
      });
      
      res.json(sanitizeUser(updatedUser!));
    } catch (error) {
      logger.error({ err: error }, "Update user error");
      res.status(400).json({ error: "Failed to update user" });
    }
  });
  
  // Get pending invitations
  app.get("/api/users/invitations", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const invitations = await storage.getUserInvitationsByOrganization(
        currentUser.healthSystemId || undefined,
        currentUser.vendorId || undefined
      );
      
      // Remove tokenHash from response for security
      const sanitized = invitations.map(inv => {
        const { tokenHash, ...rest } = inv;
        return rest;
      });
      
      res.json(sanitized);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });
  
  // Accept invitation (public - requires token)
  app.post("/api/users/invitations/accept", async (req, res) => {
    try {
      const schema = z.object({
        token: z.string(),
        username: z.string().min(3),
        password: z.string().min(6),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      });
      
      const data = schema.parse(req.body);
      
      // Extract token prefix and find matching invitations
      const tokenPrefix = data.token.substring(0, 8);
      const allInvitations = await storage.getUserInvitationsByOrganization();
      
      // Find invitation by verifying token hash
      let invitation = null;
      for (const inv of allInvitations.filter(i => i.tokenPrefix === tokenPrefix && i.status === 'pending')) {
        const isValid = await verifyPassword(data.token, inv.tokenHash);
        if (isValid) {
          invitation = inv;
          break;
        }
      }
      
      if (!invitation) {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }
      
      if (invitation.status !== 'pending') {
        return res.status(400).json({ error: "Invitation has already been used or expired" });
      }
      
      if (new Date() > new Date(invitation.expiresAt)) {
        await storage.expireUserInvitation(invitation.id);
        return res.status(400).json({ error: "Invitation has expired" });
      }
      
      // Check if username or email already exists
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      const existingEmail = await storage.getUserByEmail(invitation.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already registered" });
      }
      
      // Create user account
      const hashedPassword = await hashPassword(data.password);
      const user = await storage.createUser({
        username: data.username,
        password: hashedPassword,
        email: invitation.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: invitation.role,
        permissions: invitation.permissions,
        healthSystemId: invitation.healthSystemId,
        vendorId: invitation.vendorId,
      });
      
      // Mark invitation as accepted
      await storage.acceptUserInvitation(invitation.id);
      
      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: 'accept_invitation',
        resourceType: 'user',
        resourceId: user.id,
        resourceName: user.username,
        metadata: { invitationId: invitation.id, email: invitation.email },
        healthSystemId: invitation.healthSystemId,
        vendorId: invitation.vendorId,
      });
      
      // Set session
      req.session.userId = user.id;
      
      res.status(201).json(sanitizeUser(user));
    } catch (error) {
      logger.error({ err: error }, "Accept invitation error");
      res.status(400).json({ error: "Failed to accept invitation" });
    }
  });
  
  // Get organization settings
  app.get("/api/organization", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      let organization = null;
      if (currentUser.healthSystemId) {
        organization = await storage.getHealthSystem(currentUser.healthSystemId);
      } else if (currentUser.vendorId) {
        organization = await storage.getVendor(currentUser.vendorId);
      }
      
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      res.json({
        ...organization,
        type: currentUser.healthSystemId ? 'health-system' : 'vendor'
      });
    } catch (error) {
      logger.error({ err: error }, "Get organization error");
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });
  
  // Update organization settings (admin only)
  app.patch("/api/organization", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser || currentUser.permissions !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const schema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        website: z.string().url().optional().or(z.literal("")),
        logoUrl: z.string().url().optional().or(z.literal("")),
        settings: z.string().optional(),
      });
      
      const validated = schema.parse(req.body);
      
      // Filter out undefined and empty string values to preserve existing data
      const updates: Record<string, any> = {};
      if (validated.name !== undefined && validated.name !== "") updates.name = validated.name;
      if (validated.description !== undefined) updates.description = validated.description;
      if (validated.website !== undefined) updates.website = validated.website || null;
      if (validated.logoUrl !== undefined) updates.logoUrl = validated.logoUrl || null;
      if (validated.settings !== undefined) updates.settings = validated.settings;
      
      // Ensure we have at least one field to update
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      if (currentUser.healthSystemId) {
        await storage.updateHealthSystem(currentUser.healthSystemId, updates);
        
        await storage.createAuditLog({
          userId: currentUser.id,
          action: 'update',
          resourceType: 'health_system',
          resourceId: currentUser.healthSystemId,
          metadata: { updates },
          healthSystemId: currentUser.healthSystemId,
        });
      } else if (currentUser.vendorId) {
        await storage.updateVendor(currentUser.vendorId, updates);
        
        await storage.createAuditLog({
          userId: currentUser.id,
          action: 'update',
          resourceType: 'vendor',
          resourceId: currentUser.vendorId,
          metadata: { updates },
          vendorId: currentUser.vendorId,
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error({ err: error }, "Update organization error");
      res.status(400).json({ error: "Failed to update organization" });
    }
  });
  
  // Get system health metrics (admin only)
  app.get("/api/system-health", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser || currentUser.permissions !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const healthSystemId = currentUser.healthSystemId;
      const vendorId = currentUser.vendorId;
      
      // Gather system metrics
      const metrics: any = {
        users: {
          total: (await storage.getUsersByOrganization(healthSystemId ?? undefined, vendorId ?? undefined)).length,
        },
        alerts: {
          total: 0,
          unresolved: 0,
        },
        auditLogs: {
          recent: 0,
        },
        backgroundJobs: {
          pending: 0,
          running: 0,
        },
      };
      
      if (healthSystemId) {
        const alerts = await storage.getUnresolvedAlerts(healthSystemId);
        metrics.alerts.unresolved = alerts.length;
        const aiSystems = await storage.getAISystems(healthSystemId);
        metrics.aiSystems = {
          total: aiSystems.length,
        };
      }
      
      const recentAuditLogs = await storage.getAuditLogs({
        healthSystemId: healthSystemId ?? undefined,
        vendorId: vendorId ?? undefined,
        limit: 10,
      });
      metrics.auditLogs.recent = recentAuditLogs.length;
      
      const pendingJobs = await storage.getPendingBackgroundJobs();
      metrics.backgroundJobs.pending = pendingJobs.length;
      
      res.json(metrics);
    } catch (error) {
      logger.error({ err: error }, "Get system health error");
      res.status(500).json({ error: "Failed to fetch system health" });
    }
  });
  
  // Get audit logs (admin only)
  app.get("/api/audit-logs", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser || currentUser.permissions !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const filters: any = {
        healthSystemId: currentUser.healthSystemId,
        vendorId: currentUser.vendorId,
        limit: 100,
      };
      
      if (req.query.action) filters.action = req.query.action as string;
      if (req.query.resourceType) filters.resourceType = req.query.resourceType as string;
      if (req.query.userId) filters.userId = req.query.userId as string;
      
      const logs = await storage.getAuditLogs(filters);
      res.json(logs);
    } catch (error) {
      logger.error({ err: error }, "Get audit logs error");
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });
  
  // Cancel invitation
  app.delete("/api/users/invitations/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Only admins can cancel invitations
      if (currentUser.permissions !== 'admin') {
        return res.status(403).json({ error: "Only admins can cancel invitations" });
      }
      
      const invitation = await storage.getUserInvitation(req.params.id);
      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      
      // Verify same organization
      if (currentUser.healthSystemId !== invitation.healthSystemId || 
          currentUser.vendorId !== invitation.vendorId) {
        return res.status(403).json({ error: "Cannot cancel invitations from other organizations" });
      }
      
      await storage.expireUserInvitation(req.params.id);
      
      // Create audit log
      await storage.createAuditLog({
        userId: currentUser.id,
        action: 'delete',
        resourceType: 'user_invitation',
        resourceId: req.params.id,
        resourceName: invitation.email,
        healthSystemId: currentUser.healthSystemId,
        vendorId: currentUser.vendorId,
      });
      
      res.json({ message: "Invitation cancelled" });
    } catch (error) {
      logger.error({ err: error }, "Cancel invitation error");
      res.status(400).json({ error: "Failed to cancel invitation" });
    }
  });
  
  // ===== Demo Routes (temporary - for testing without auth) =====
  
  // Get current health system ID (for demo purposes)
  app.get("/api/current-health-system", async (req, res) => {
    res.json({ id: DEMO_HEALTH_SYSTEM_ID });
  });

  // Get current vendor ID (for demo purposes)
  app.get("/api/current-vendor", async (req, res) => {
    res.json({ id: DEMO_VENDOR_VIZAI_ID });
  });
  // Health System routes
  app.get("/api/health-systems/:id", async (req, res) => {
    const healthSystem = await storage.getHealthSystem(req.params.id);
    if (!healthSystem) {
      return res.status(404).json({ error: "Health system not found" });
    }
    res.json(healthSystem);
  });

  app.post("/api/health-systems", async (req, res) => {
    try {
      const data = insertHealthSystemSchema.parse(req.body);
      const healthSystem = await storage.createHealthSystem(data);
      res.status(201).json(healthSystem);
    } catch (error) {
      res.status(400).json({ error: "Invalid health system data" });
    }
  });

  // Public vendor directory (no auth required)
  app.get("/api/vendors/public", async (req: Request, res: Response) => {
    try {
      const vendors = await storage.getPublicVendors();
      res.json(vendors);
    } catch (error: any) {
      logger.error({ err: error }, "Error fetching public vendors");
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  // AI System routes - ONLY health system users can access
  app.get("/api/ai-systems", requireRole("health_system"), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user ||!user.healthSystemId) {
      return res.status(403).json({ error: "No health system associated with this account" });
    }
    
    // Use session-derived healthSystemId, NEVER trust client
    const systems = await storage.getAISystems(user.healthSystemId);
    res.json(systems);
  });

  app.get("/api/ai-systems/:id", requireAuth, async (req, res) => {
    const system = await storage.getAISystem(req.params.id);
    if (!system) {
      return res.status(404).json({ error: "AI system not found" });
    }
    
    // Validate ownership
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.healthSystemId !== system.healthSystemId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(system);
  });

  app.post("/api/ai-systems", requireRole("health_system"), async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || !user.healthSystemId) {
        return res.status(403).json({ error: "No health system associated with this account" });
      }
      
      // Parse WITHOUT healthSystemId (will be added from session)
      const dataWithoutHealthSystemId = insertAISystemSchema.omit({ healthSystemId: true }).parse(req.body);
      
      // Force healthSystemId from session
      const data = {
        ...dataWithoutHealthSystemId,
        healthSystemId: user.healthSystemId,
      };
      
      const system = await storage.createAISystem(data);
      res.status(201).json(system);
    } catch (error) {
      res.status(400).json({ error: "Invalid AI system data" });
    }
  });

  app.patch("/api/ai-systems/:id", requireAuth, async (req, res) => {
    try {
      // First get the system to validate ownership
      const existingSystem = await storage.getAISystem(req.params.id);
      if (!existingSystem) {
        return res.status(404).json({ error: "AI system not found" });
      }
      
      // Validate ownership
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || user.healthSystemId !== existingSystem.healthSystemId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Validate partial update data
      const partialSchema = insertAISystemSchema.partial();
      const data = partialSchema.parse(req.body);
      
      // CRITICAL: Preserve existing healthSystemId, never allow client to change it
      delete data.healthSystemId;
      
      const system = await storage.updateAISystem(req.params.id, data);
      res.json(system);
    } catch (error) {
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  app.delete("/api/ai-systems/:id", requireAuth, async (req, res) => {
    // First get the system to validate ownership
    const existingSystem = await storage.getAISystem(req.params.id);
    if (!existingSystem) {
      return res.status(404).json({ error: "AI system not found" });
    }
    
    // Validate ownership
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.healthSystemId !== existingSystem.healthSystemId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    await storage.deleteAISystem(req.params.id);
    res.status(204).send();
  });

  // Monitoring Alert routes - ONLY accessible by health system users
  app.get("/api/alerts", requireRole("health_system"), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.healthSystemId) {
      return res.status(403).json({ error: "No health system associated with this account" });
    }
    
    // Use session-derived healthSystemId, ignore client-provided value
    const alerts = await storage.getUnresolvedAlerts(user.healthSystemId);
    res.json(alerts);
  });

  app.post("/api/alerts", requireAuth, async (req, res) => {
    try {
      const data = insertMonitoringAlertSchema.parse(req.body);
      
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Validate the AI system belongs to the user's health system
      const system = await storage.getAISystem(data.aiSystemId);
      if (!system) {
        return res.status(404).json({ error: "AI system not found" });
      }
      if (user.healthSystemId !== system.healthSystemId) {
        return res.status(403).json({ error: "Access denied: Can only create alerts for AI systems in your health system" });
      }
      
      const alert = await storage.createAlert(data);
      res.status(201).json(alert);
    } catch (error) {
      res.status(400).json({ error: "Invalid alert data" });
    }
  });

  app.patch("/api/alerts/:id/resolve", requireAuth, async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    
    // Get alert to validate ownership
    const alerts = await storage.getAlerts();
    const alert = alerts.find(a => a.id === req.params.id);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }
    
    // Get the AI system to check health system ownership
    const system = await storage.getAISystem(alert.aiSystemId);
    if (!system) {
      return res.status(404).json({ error: "AI system not found" });
    }
    
    // Validate ownership through AI system
    if (user.healthSystemId !== system.healthSystemId) {
      return res.status(403).json({ error: "Access denied: Can only resolve alerts from your own health system" });
    }
    
    await storage.resolveAlert(req.params.id);
    res.status(204).send();
  });

  // 🔮 Predictive Alert routes
  app.get("/api/health-systems/:healthSystemId/predictive-alerts", requireRole("health_system"), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.healthSystemId) {
      return res.status(403).json({ error: "No health system associated with this account" });
    }
    
    // Validate ownership: session-derived healthSystemId must match requested resource
    if (user.healthSystemId !== req.params.healthSystemId) {
      return res.status(403).json({ error: "Access denied: Can only view predictive alerts for your own health system" });
    }
    
    const alerts = await storage.getPredictiveAlertsForHealthSystem(user.healthSystemId);
    res.json(alerts);
  });

  app.post("/api/health-systems/:healthSystemId/predictive-alerts/generate", requireRole("health_system"), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.healthSystemId) {
      return res.status(403).json({ error: "No health system associated with this account" });
    }
    
    // Validate ownership: session-derived healthSystemId must match requested resource
    if (user.healthSystemId !== req.params.healthSystemId) {
      return res.status(403).json({ error: "Access denied: Can only generate predictive alerts for your own health system" });
    }
    
    try {
      const { predictiveAlertService } = await import("./services/predictive-alert-service");
      const alertsGenerated = await predictiveAlertService.generatePredictiveAlertsForHealthSystem(user.healthSystemId);
      
      res.json({ 
        success: true, 
        alertsGenerated,
        message: `Generated ${alertsGenerated} predictive alerts`
      });
    } catch (error) {
      logger.error({ err: error }, "Error generating predictive alerts");
      res.status(500).json({ error: "Failed to generate predictive alerts" });
    }
  });

  app.patch("/api/predictive-alerts/:alertId/dismiss", requireRole("health_system"), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.healthSystemId) {
      return res.status(403).json({ error: "No health system associated with this account" });
    }
    
    // Validate ownership: get all alerts for health system and check if this alert is in the list
    const alerts = await storage.getPredictiveAlertsForHealthSystem(user.healthSystemId);
    const alert = alerts.find(a => a.id === req.params.alertId);
    
    if (!alert) {
      return res.status(404).json({ error: "Predictive alert not found or access denied" });
    }
    
    await storage.dismissPredictiveAlert(req.params.alertId);
    res.status(204).send();
  });

  // Vendor routes
  app.get("/api/vendors", async (req, res) => {
    const vendors = await storage.getVendors();
    res.json(vendors);
  });

  // Get vendor by ID - accessible by all authenticated users (vendors can see their own, health systems can browse)
  app.get("/api/vendors/:id", requireAuth, async (req, res) => {
    const vendor = await storage.getVendor(req.params.id);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    res.json(vendor);
  });

  app.post("/api/vendors", async (req, res) => {
    try {
      const data = insertVendorSchema.parse(req.body);
      const vendor = await storage.createVendor(data);
      res.status(201).json(vendor);
    } catch (error) {
      res.status(400).json({ error: "Invalid vendor data" });
    }
  });

  // Vendor analytics endpoint - vendors can only access their own data
  app.get("/api/vendors/:vendorId/analytics", requireAuth, requireRole("vendor"), async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const user = await storage.getUser(req.session.userId);
      if (!user || !user.vendorId) {
        return res.status(401).json({ error: "User not found or not associated with vendor" });
      }
      
      // Ensure vendor can only access their own analytics
      if (user.vendorId !== req.params.vendorId) {
        return res.status(403).json({ error: "Access denied: Can only view your own analytics" });
      }
      
      const vendorId = req.params.vendorId;
      
      // Get certification applications
      const applications = await storage.getCertificationApplicationsByVendor(vendorId);
      const applicationStats = {
        total: applications.length,
        pending: applications.filter(a => a.status === 'pending').length,
        approved: applications.filter(a => a.status === 'approved').length,
        rejected: applications.filter(a => a.status === 'rejected').length,
        underReview: applications.filter(a => a.status === 'under_review').length,
      };
      
      // Get AI systems and compliance data
      const aiSystems = await storage.getAISystemsByVendor(vendorId);
      const systemsWithCompliance = await Promise.all(
        aiSystems.map(async (system) => {
          const mappings = await storage.getComplianceMappingsBySystem(system.id);
          const compliantCount = mappings.filter(m => m.status === 'compliant').length;
          const totalCount = mappings.length;
          
          return {
            id: system.id,
            name: system.name,
            complianceRate: totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 0,
            status: system.status,
            riskLevel: system.riskLevel,
          };
        })
      );
      
      // Calculate average compliance score
      const averageComplianceRate = systemsWithCompliance.length > 0
        ? Math.round(systemsWithCompliance.reduce((sum, s) => sum + s.complianceRate, 0) / systemsWithCompliance.length)
        : 0;
      
      // Get deployments
      const deployments = await storage.getDeploymentsByVendor(vendorId);
      const uniqueHealthSystems = new Set(deployments.map(d => d.healthSystemId)).size;
      
      // Sort systems by compliance rate (descending) and take top 5
      const topSystems = systemsWithCompliance
        .sort((a, b) => b.complianceRate - a.complianceRate)
        .slice(0, 5);
      
      res.json({
        certificationApplications: applicationStats,
        aiSystems: {
          total: aiSystems.length,
          verified: aiSystems.filter(s => s.status === 'verified').length,
          averageComplianceRate,
          byRiskLevel: {
            low: aiSystems.filter(s => s.riskLevel === 'low').length,
            medium: aiSystems.filter(s => s.riskLevel === 'medium').length,
            high: aiSystems.filter(s => s.riskLevel === 'high').length,
            critical: aiSystems.filter(s => s.riskLevel === 'critical').length,
          },
        },
        deployments: {
          total: deployments.length,
          uniqueHealthSystems,
          active: deployments.filter(d => d.status === 'active').length,
        },
        topSystems,
      });
    } catch (error) {
      logger.error({ err: error }, "Vendor analytics error");
      res.status(500).json({ error: "Failed to load analytics" });
    }
  });

  // Deployment routes - role-based access control with session-derived tenant IDs
  app.get("/api/deployments", requireAuth, async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    
    // Vendors: use session-derived vendorId
    if (user.role === "vendor") {
      if (!user.vendorId) {
        return res.status(403).json({ error: "No vendor associated with this account" });
      }
      const deployments = await storage.getDeploymentsByVendor(user.vendorId);
      return res.json(deployments);
    }
    
    // Health system users: use session-derived healthSystemId
    if (user.role === "health_system") {
      if (!user.healthSystemId) {
        return res.status(403).json({ error: "No health system associated with this account" });
      }
      const deployments = await storage.getDeploymentsByHealthSystem(user.healthSystemId);
      return res.json(deployments);
    }
    
    res.status(403).json({ error: "Access denied: Invalid role" });
  });

  app.post("/api/deployments", requireAuth, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const data = insertDeploymentSchema.parse(req.body);
      
      // Deployments require BOTH vendorId and healthSystemId
      // Force user's org ID based on role, accept the other from client
      if (user.role === "vendor") {
        if (!user.vendorId) {
          return res.status(403).json({ error: "No vendor associated with this account" });
        }
        // Force vendorId from session, client provides healthSystemId
        data.vendorId = user.vendorId;
        if (!data.healthSystemId) {
          return res.status(400).json({ error: "healthSystemId is required" });
        }
      } else if (user.role === "health_system") {
        if (!user.healthSystemId) {
          return res.status(403).json({ error: "No health system associated with this account" });
        }
        // Force healthSystemId from session, client provides vendorId
        data.healthSystemId = user.healthSystemId;
        if (!data.vendorId) {
          return res.status(400).json({ error: "vendorId is required" });
        }
      } else {
        return res.status(403).json({ error: "Invalid role" });
      }
      
      const deployment = await storage.createDeployment(data);
      res.status(201).json(deployment);
    } catch (error) {
      res.status(400).json({ error: "Invalid deployment data" });
    }
  });

  // Compliance Certification routes - ONLY vendor users
  app.get("/api/certifications", requireRole("vendor"), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.vendorId) {
      return res.status(403).json({ error: "No vendor associated with this account" });
    }
    
    // Use session-derived vendorId
    const certifications = await storage.getCertifications(user.vendorId);
    res.json(certifications);
  });

  app.post("/api/certifications", requireRole("vendor"), async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || !user.vendorId) {
        return res.status(403).json({ error: "No vendor associated with this account" });
      }
      
      // Parse WITHOUT vendorId (will be added from session)
      const dataWithoutVendorId = insertComplianceCertificationSchema.omit({ vendorId: true }).parse(req.body);
      
      // Force vendorId from session
      const data = {
        ...dataWithoutVendorId,
        vendorId: user.vendorId,
      };
      
      const certification = await storage.createCertification(data);
      res.status(201).json(certification);
    } catch (error) {
      res.status(400).json({ error: "Invalid certification data" });
    }
  });

  // Certification Application routes - vendor certification workflow
  app.post("/api/vendors/:vendorId/certifications/apply", requireRole("vendor"), async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || !user.vendorId) {
        return res.status(403).json({ error: "No vendor associated with this account" });
      }
      
      // SECURITY: Ignore vendorId from URL, use session-derived vendorId exclusively
      // This prevents vendor impersonation attacks
      const { tierRequested, documentationUrls, complianceStatements } = req.body;
      
      if (!tierRequested || !["Silver", "Gold", "Platinum"].includes(tierRequested)) {
        return res.status(400).json({ error: "Invalid tier requested. Must be Silver, Gold, or Platinum" });
      }
      
      // Create application using session-derived vendorId ONLY
      const application = await storage.createCertificationApplication({
        vendorId: user.vendorId,  // Force from session, ignore URL param
        tierRequested,
        documentationUrls: documentationUrls || [],
        complianceStatements: typeof complianceStatements === "string" ? complianceStatements : JSON.stringify(complianceStatements || {}),
        status: "pending",
      });
      
      // Enqueue background job for automated testing
      const { enqueueJob } = await import("./services/background-jobs");
      await enqueueJob("certification_workflow", { applicationId: application.id });
      
      res.status(201).json(application);
    } catch (error) {
      logger.error({ err: error }, "Error creating certification application");
      res.status(400).json({ error: "Invalid application data" });
    }
  });

  app.get("/api/vendors/:vendorId/certifications/applications", requireAuth, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      logger.debug({ username: user.username, role: user.role, vendorId: req.params.vendorId }, `[CERT_APPS] GET request`);
      
      // Vendor can see their own applications
      if (user.role === "vendor" && user.vendorId === req.params.vendorId) {
        const applications = await storage.getCertificationApplicationsByVendor(req.params.vendorId);
        logger.info({ vendorId: user.vendorId, count: applications.length }, `[CERT_APPS] Vendor fetched ${applications.length} applications`);
        return res.json(applications);
      }
      
      // Health system admins can see all applications
      if (user.role === "health_system") {
        const applications = await storage.getCertificationApplicationsByVendor(req.params.vendorId);
        logger.info({ vendorId: req.params.vendorId, count: applications.length }, `[CERT_APPS] Health system admin fetched ${applications.length} applications`);
        return res.json(applications);
      }
      
      logger.warn({ username: user.username, role: user.role }, `[CERT_APPS] Access denied`);
      res.status(403).json({ error: "Access denied" });
    } catch (error) {
      logger.error({ err: error }, "Error fetching applications");
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  app.patch("/api/vendors/:vendorId/certifications/applications/:id/review", requireRole("health_system"), async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || !user.healthSystemId) {
        return res.status(403).json({ error: "No health system associated with this account" });
      }
      
      const { status, rejectionReason, notes } = req.body;
      
      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Status must be approved or rejected" });
      }
      
      if (status === "rejected" && !rejectionReason) {
        return res.status(400).json({ error: "Rejection reason is required" });
      }
      
      // Get application to verify it exists and validate ownership
      const application = await storage.getCertificationApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      // SECURITY: Verify application belongs to vendorId in URL to prevent mismatched approvals
      if (application.vendorId !== req.params.vendorId) {
        return res.status(403).json({ error: "Application does not belong to specified vendor" });
      }
      
      // Update application
      await storage.reviewCertificationApplication(
        req.params.id,
        status,
        user.id,
        rejectionReason,
        notes
      );
      
      // If approved, create certification and update vendor
      if (status === "approved") {
        await storage.createCertification({
          vendorId: application.vendorId,
          type: `Spectral ${application.tierRequested}`,
          status: "active",
          verifiedDate: new Date(),
        });
        
        // Update vendor verification status
        const vendor = await storage.getVendor(application.vendorId);
        if (vendor) {
          // Would update vendor.certificationTier and vendor.verified here
          // For now, just creating the certification is sufficient
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error({ err: error }, "Error reviewing application");
      res.status(500).json({ error: "Failed to review application" });
    }
  });

  // Dashboard stats endpoint - ONLY health system users
  app.get("/api/dashboard/stats", requireRole("health_system"), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.healthSystemId) {
      return res.status(403).json({ error: "No health system associated with this account" });
    }

    // Use session-derived healthSystemId
    const systems = await storage.getAISystems(user.healthSystemId);
    const alerts = await storage.getUnresolvedAlerts(user.healthSystemId);

    const atRisk = systems.filter(s => s.status === "drift" || s.riskLevel === "High").length;
    const verified = systems.filter(s => s.status === "verified").length;
    const compliant = systems.length > 0 ? Math.round((verified / systems.length) * 100) : 100;

    res.json({
      totalSystems: systems.length,
      atRisk,
      verified,
      compliant: `${compliant}%`,
      unresolvedAlerts: alerts.length,
    });
  });

  // Risk Scoring endpoints - ONLY health system users
  app.post("/api/ai-systems/:id/calculate-risk", requireRole("health_system"), async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verify ownership
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || !user.healthSystemId) {
        return res.status(403).json({ error: "No health system associated with this account" });
      }
      
      const aiSystem = await storage.getAISystem(id);
      if (!aiSystem || aiSystem.healthSystemId !== user.healthSystemId) {
        return res.status(404).json({ error: "AI system not found or access denied" });
      }
      
      // Import dynamically to avoid circular dependencies
      const { calculateRiskScore, updateAISystemRisk } = await import("./services/risk-scoring");
      
      // Calculate and update risk
      await updateAISystemRisk(id);
      const riskScore = await calculateRiskScore(id);
      
      res.json(riskScore);
    } catch (error) {
      logger.error({ err: error }, "Risk calculation error");
      res.status(500).json({ error: "Failed to calculate risk score" });
    }
  });

  app.post("/api/health-systems/:id/calculate-risks", requireRole("health_system"), async (req, res) => {
    try {
      const { id: healthSystemId } = req.params;
      
      // Verify ownership
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || user.healthSystemId !== healthSystemId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Import dynamically
      const { calculateHealthSystemRiskScores, updateHealthSystemRisks } = await import("./services/risk-scoring");
      
      // Update all AI systems in this health system
      await updateHealthSystemRisks(healthSystemId);
      const scores = await calculateHealthSystemRiskScores(healthSystemId);
      
      res.json(scores);
    } catch (error) {
      logger.error({ err: error }, "Batch risk calculation error");
      res.status(500).json({ error: "Failed to calculate risk scores" });
    }
  });

  // ===== Advanced Analytics Routes =====
  
  // Get portfolio health score
  app.get("/api/health-systems/:id/analytics/portfolio-health", requireRole("health_system"), async (req, res) => {
    try {
      const { id: healthSystemId } = req.params;
      
      // Verify ownership
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || user.healthSystemId !== healthSystemId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { calculatePortfolioHealthScore } = await import("./services/analytics-service");
      const healthScore = await calculatePortfolioHealthScore(healthSystemId);
      
      res.json(healthScore);
    } catch (error) {
      logger.error({ err: error }, "Portfolio health score error");
      res.status(500).json({ error: "Failed to calculate portfolio health score" });
    }
  });

  // Get department metrics
  app.get("/api/health-systems/:id/analytics/departments", requireRole("health_system"), async (req, res) => {
    try {
      const { id: healthSystemId } = req.params;
      
      // Verify ownership
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || user.healthSystemId !== healthSystemId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { getDepartmentMetrics } = await import("./services/analytics-service");
      const metrics = await getDepartmentMetrics(healthSystemId);
      
      res.json(metrics);
    } catch (error) {
      logger.error({ err: error }, "Department metrics error");
      res.status(500).json({ error: "Failed to fetch department metrics" });
    }
  });

  // Get alert trend analysis
  app.get("/api/health-systems/:id/analytics/alert-trends", requireRole("health_system"), async (req, res) => {
    try {
      const { id: healthSystemId } = req.params;
      const days = parseInt(req.query.days as string) || 30;
      
      // Verify ownership
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || user.healthSystemId !== healthSystemId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { getAlertTrendAnalysis } = await import("./services/analytics-service");
      const trends = await getAlertTrendAnalysis(healthSystemId, days);
      
      res.json(trends);
    } catch (error) {
      logger.error({ err: error }, "Alert trends error");
      res.status(500).json({ error: "Failed to fetch alert trends" });
    }
  });

  // Get compliance trend
  app.get("/api/health-systems/:id/analytics/compliance-trend", requireRole("health_system"), async (req, res) => {
    try {
      const { id: healthSystemId } = req.params;
      const months = parseInt(req.query.months as string) || 6;
      
      // Verify ownership
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || user.healthSystemId !== healthSystemId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { getComplianceTrend } = await import("./services/analytics-service");
      const trend = await getComplianceTrend(healthSystemId, months);
      
      res.json(trend);
    } catch (error) {
      logger.error({ err: error }, "Compliance trend error");
      res.status(500).json({ error: "Failed to fetch compliance trend" });
    }
  });

  // Get risk score trend
  app.get("/api/health-systems/:id/analytics/risk-trend", requireRole("health_system"), async (req, res) => {
    try {
      const { id: healthSystemId } = req.params;
      const months = parseInt(req.query.months as string) || 6;
      
      // Verify ownership
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || user.healthSystemId !== healthSystemId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { getRiskScoreTrend } = await import("./services/analytics-service");
      const trend = await getRiskScoreTrend(healthSystemId, months);
      
      res.json(trend);
    } catch (error) {
      logger.error({ err: error }, "Risk trend error");
      res.status(500).json({ error: "Failed to fetch risk trend" });
    }
  });

  // ===== Compliance Template Library =====
  
  // List all compliance templates with optional filtering
  app.get("/api/templates", requireAuth, async (req, res) => {
    try {
      const { framework, category, tags, search } = req.query;
      
      const filters: any = {};
      if (framework && typeof framework === 'string') filters.framework = framework;
      if (category && typeof category === 'string') filters.category = category;
      if (tags && typeof tags === 'string') filters.tags = tags.split(',');
      if (search && typeof search === 'string') filters.search = search;
      
      const templates = await storage.getComplianceTemplates(filters);
      res.json(templates);
    } catch (error) {
      logger.error({ err: error }, "Template list error");
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });
  
  // Get a specific template by ID
  app.get("/api/templates/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const template = await storage.getComplianceTemplate(id);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      res.json(template);
    } catch (error) {
      logger.error({ err: error }, "Template fetch error");
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  // ===== Partner API Routes (API Key Auth) =====
  
  // Import API key authentication middleware
  const { requireApiKey } = await import("./middleware/api-auth");
  
  // Submit certification application
  app.post("/api/partner/applications", requireApiKey, async (req, res) => {
    try {
      const vendorId = req.apiVendor!.id;
      
      // Validate request body
      const schema = z.object({
        tierRequested: z.enum(["Silver", "Gold", "Platinum"]),
        complianceStatements: z.record(z.string()),
        documentationUrls: z.array(z.string()).optional(),
        notes: z.string().optional(),
      });
      
      const validatedData = schema.parse(req.body);
      
      // Create application
      const application = await storage.createCertificationApplication({
        vendorId,
        tierRequested: validatedData.tierRequested,
        status: "pending",
        documentationUrls: validatedData.documentationUrls || [],
        complianceStatements: JSON.stringify(validatedData.complianceStatements),
        notes: validatedData.notes || null,
      });
      
      // Schedule background job for automated testing
      const { enqueueJob } = await import("./services/background-jobs");
      await enqueueJob(
        "certification_workflow",
        { applicationId: application.id }
      );
      
      res.status(201).json({
        id: application.id,
        status: application.status,
        tierRequested: application.tierRequested,
        submittedAt: application.submittedAt,
        message: "Application submitted successfully. Automated testing will begin shortly.",
      });
    } catch (error: any) {
      logger.error({ err: error }, "Partner API - Submit application error");
      
      if (error.name === "ZodError") {
        return res.status(400).json({
          error: "Validation error",
          details: error.errors,
        });
      }
      
      res.status(500).json({ error: "Failed to submit application" });
    }
  });
  
  // Get all applications for vendor
  app.get("/api/partner/applications", requireApiKey, async (req, res) => {
    try {
      const vendorId = req.apiVendor!.id;
      const applications = await storage.getCertificationApplicationsByVendor(vendorId);
      
      res.json({
        applications: applications.map(app => ({
          id: app.id,
          tierRequested: app.tierRequested,
          status: app.status,
          submittedAt: app.submittedAt,
          reviewedAt: app.reviewedAt,
          automatedChecksResult: app.automatedChecksResult,
          rejectionReason: app.rejectionReason,
        })),
      });
    } catch (error) {
      logger.error({ err: error }, "Partner API - List applications error");
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });
  
  // Get specific application details
  app.get("/api/partner/applications/:id", requireApiKey, async (req, res) => {
    try {
      const { id } = req.params;
      const vendorId = req.apiVendor!.id;
      
      const application = await storage.getCertificationApplication(id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      // Verify ownership
      if (application.vendorId !== vendorId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(application);
    } catch (error) {
      logger.error({ err: error }, "Partner API - Get application error");
      res.status(500).json({ error: "Failed to fetch application" });
    }
  });
  
  // Get compliance scores for all vendor AI systems
  app.get("/api/partner/compliance-scores", requireApiKey, async (req, res) => {
    try {
      const vendorId = req.apiVendor!.id;
      
      // Get all AI systems for this vendor
      const systems = await storage.getAISystemsByVendor(vendorId);
      
      // Get compliance scores for each system
      const scores = await Promise.all(
        systems.map(async (system) => {
          const mappings = await storage.getComplianceMappingsBySystem(system.id);
          const totalControls = mappings.length;
          const compliantControls = mappings.filter((m: any) => m.status === "compliant").length;
          const complianceRate = totalControls > 0 ? (compliantControls / totalControls) * 100 : 0;
          
          return {
            aiSystemId: system.id,
            aiSystemName: system.name,
            riskLevel: system.riskLevel,
            status: system.status,
            complianceRate: Math.round(complianceRate),
            totalControls,
            compliantControls,
          };
        })
      );
      
      res.json({
        vendorId,
        vendorName: req.apiVendor!.name,
        systems: scores,
        summary: {
          totalSystems: scores.length,
          averageComplianceRate: scores.length > 0 
            ? Math.round(scores.reduce((sum, s) => sum + s.complianceRate, 0) / scores.length)
            : 0,
        },
      });
    } catch (error) {
      logger.error({ err: error }, "Partner API - Get compliance scores error");
      res.status(500).json({ error: "Failed to fetch compliance scores" });
    }
  });

  // ===== AI Monitoring Webhook Routes (Public) =====
  
  // LangSmith webhook receiver for AI telemetry events (HMAC-SHA256 verified)
  app.post("/api/webhooks/langsmith/:aiSystemId", webhookRateLimit, verifyWebhookSignature('langsmith'), async (req, res) => {
    try {
      const { aiSystemId } = req.params;
      
      // Verify AI system exists
      const aiSystem = await storage.getAISystem(aiSystemId);
      if (!aiSystem) {
        return res.status(404).json({ error: "AI system not found" });
      }
      
      // Validate payload schema
      const validationResult = validateWebhookPayload(langSmithWebhookSchema, req.body);
      if (!validationResult.success) {
        logger.warn({ errors: validationResult.error.errors }, "LangSmith webhook payload validation failed");
        return res.status(400).json({ 
          error: "Invalid webhook payload",
          details: validationResult.error.errors
        });
      }
      
      const payload = validationResult.data;
      
      // Detect webhook type and parse accordingly
      let eventType = "run"; // default
      let ruleId: string | undefined;
      let severity: string | undefined;
      let metric: string | undefined;
      let metricValue: string | undefined;
      let threshold: string | undefined;
      
      // LangSmith Alert Webhook
      if (payload.alert_rule_id) {
        eventType = "alert";
        ruleId = payload.alert_rule_id;
        metric = payload.alert_rule_attribute;
        metricValue = payload.triggered_metric_value?.toString();
        threshold = payload.triggered_threshold?.toString();
        
        // Map metric to severity
        if (metric === "error_count") {
          severity = parseFloat(metricValue || "0") > parseFloat(threshold || "0") * 2 ? "critical" : "high";
        } else if (metric === "latency") {
          severity = parseFloat(metricValue || "0") > 5000 ? "high" : "medium";
        } else if (metric === "feedback_score") {
          severity = parseFloat(metricValue || "0") < 0.5 ? "high" : "medium";
        } else {
          severity = "medium";
        }
        
        // Create monitoring alert for critical/high severity
        if (severity === "critical" || severity === "high") {
          const alert = await storage.createAlert({
            aiSystemId,
            type: `LangSmith Alert: ${metric}`,
            severity: severity,
            message: `${metric} threshold exceeded: ${metricValue} (threshold: ${threshold})`,
            resolved: false,
          });
          
          // Send email notification for critical alerts
          if (severity === "critical") {
            try {
              const { sendCriticalAlertEmail } = await import("./services/email-notification");
              const aiSystem = await storage.getAISystem(aiSystemId);
              
              if (aiSystem) {
                const healthSystem = await storage.getHealthSystem(aiSystem.healthSystemId);
                
                if (healthSystem) {
                  // Fetch all admin users for this health system
                  const orgUsers = await storage.getUsersByOrganization(aiSystem.healthSystemId);
                  const adminUsers = orgUsers.filter(u => u.permissions === 'admin' && u.status === 'active');
                  
                  // Send email to all admin users
                  for (const admin of adminUsers) {
                    try {
                      await sendCriticalAlertEmail(
                        admin.email,
                        admin.firstName && admin.lastName 
                          ? `${admin.firstName} ${admin.lastName}`
                          : admin.username,
                        {
                          aiSystemName: aiSystem.name,
                          severity: alert.severity,
                          message: alert.message,
                          timestamp: alert.createdAt,
                          healthSystemName: healthSystem.name,
                          alertId: alert.id,
                        }
                      );
                    } catch (adminEmailError) {
                      logger.error({ err: adminEmailError, adminEmail: admin.email }, "Failed to send email to admin");
                    }
                  }
                  
                  if (adminUsers.length === 0) {
                    logger.warn({ healthSystemId: aiSystem.healthSystemId }, "No admin users found for critical alert notification");
                  }
                }
              }
            } catch (emailError) {
              logger.error({ err: emailError }, "Email notification error (non-critical)");
            }
          }
        }
      }
      // LangSmith Automation Rules Webhook
      else if (payload.rule_id && payload.runs) {
        eventType = "run";
        ruleId = payload.rule_id;
        
        // Check for errors in runs
        const errorRuns = payload.runs.filter((run: any) => run.error);
        if (errorRuns.length > 0) {
          eventType = "error";
          severity = "high";
          const alert = await storage.createAlert({
            aiSystemId,
            type: "LangSmith Run Error",
            severity: "high",
            message: `${errorRuns.length} run(s) failed with errors`,
            resolved: false,
          });
          
          // Note: Critical severity would trigger email here if needed
          // Currently high severity doesn't auto-email, but can be configured
        }
      }
      
      // Store telemetry event
      const telemetryEvent = await storage.createAITelemetryEvent({
        aiSystemId,
        eventType,
        source: "langsmith",
        runId: payload.runs?.[0]?.id,
        ruleId,
        severity,
        metric,
        metricValue,
        threshold,
        payload: JSON.stringify(payload),
        processedAt: new Date(),
      });
      
      // Update AI system lastCheck timestamp
      await storage.updateAISystemLastCheck(aiSystemId, new Date());
      
      // Calculate and update risk score automatically
      try {
        const { updateAISystemRisk } = await import("./services/risk-scoring");
        await updateAISystemRisk(aiSystemId);
      } catch (riskError) {
        logger.error({ err: riskError }, "Risk scoring error (non-critical)");
        // Don't fail the webhook if risk scoring fails
      }
      
      // 🔒 TRANSLATION ENGINE - Process telemetry through compliance mapping
      try {
        const { translationEngine } = await import("./services/translation-engine");
        const translatedEvent = await translationEngine.translate(telemetryEvent);
        
        logger.info({ violationCount: translatedEvent.violations.length, actionCount: translatedEvent.actions.length }, `Translation Engine: Processed ${translatedEvent.violations.length} violation(s), ${translatedEvent.actions.length} action(s)`);
        
        // Store violations and their associated actions (FIX: Correctly associate actions with violations)
        for (const violation of translatedEvent.violations) {
          // Save violation to database
          const violationRecord = await storage.createComplianceViolation({
            telemetryEventId: telemetryEvent.id,
            aiSystemId: telemetryEvent.aiSystemId,
            framework: violation.framework,
            controlId: violation.controlId,
            controlName: violation.controlName,
            violationType: violation.violationType,
            severity: violation.severity,
            requiresReporting: violation.requiresReporting,
            reportingDeadline: violation.reportingDeadline || null,
            description: violation.description,
            resolved: false,
          });
          
          // Get actions for THIS specific violation (not all actions)
          const actionsForViolation = translatedEvent.actionsByViolation.get(violation) || [];
          
          // Create only the actions that belong to this violation
          for (const action of actionsForViolation) {
            await storage.createRequiredAction({
              violationId: violationRecord.id,
              aiSystemId: telemetryEvent.aiSystemId,
              actionType: action.actionType,
              priority: action.priority,
              description: action.description,
              assignee: action.assignee,
              deadline: action.deadline,
              automated: action.automated,
              actionDetails: action.actionDetails ? JSON.stringify(action.actionDetails) : null,
              status: "pending",
            });
          }
        }
        
        // Log critical violations for monitoring
        const criticalViolations = translatedEvent.violations.filter(v => v.severity === 'critical');
        if (criticalViolations.length > 0) {
          logger.warn({ 
            count: criticalViolations.length, 
            violations: criticalViolations.map(v => ({ framework: v.framework, controlId: v.controlId, controlName: v.controlName })) 
          }, `CRITICAL VIOLATIONS DETECTED: ${criticalViolations.length} violation(s) require immediate attention`);
        }
        
      } catch (translationError) {
        logger.error({ err: translationError }, "Translation Engine error (non-critical)");
        // Don't fail the webhook if translation fails
      }
      
      // 🔮 PREDICTIVE ALERTS - Check if predictions were correct and actualize them
      try {
        const predictiveAlerts = await storage.getPredictiveAlerts(aiSystemId);
        const now = new Date();
        
        for (const alert of predictiveAlerts) {
          // Check if telemetry metric matches alert metric
          const currentMetricValue = metricValue ? parseFloat(metricValue) : null;
          const alertThreshold = parseFloat(alert.threshold);
          
          // If metric matches and threshold is breached, actualize the prediction
          if (currentMetricValue !== null && currentMetricValue >= alertThreshold) {
            if (metric && alert.metric.includes(metric.toLowerCase())) {
              await storage.actualizePredictiveAlert(alert.id);
              logger.info({ alertId: alert.id, metric: alert.metric, threshold: alertThreshold }, `Actualized predictive alert: ${alert.metric} exceeded threshold as predicted`);
            }
          }
        }
      } catch (predictionError) {
        logger.error({ err: predictionError }, "Prediction actualization error (non-critical)");
        // Don't fail the webhook if prediction checking fails
      }
      
      res.status(200).json({ 
        success: true, 
        eventId: telemetryEvent.id,
        message: "Telemetry event processed and translated to compliance violations" 
      });
    } catch (error) {
      logger.error({ err: error }, "Webhook processing error");
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  // Arize AI webhook receiver for model monitoring (HMAC-SHA256 verified)
  app.post("/api/webhooks/arize/:aiSystemId", webhookRateLimit, verifyWebhookSignature('arize'), async (req, res) => {
    try {
      const { aiSystemId } = req.params;
      
      // Verify AI system exists
      const aiSystem = await storage.getAISystem(aiSystemId);
      if (!aiSystem) {
        return res.status(404).json({ error: "AI system not found" });
      }
      
      // Validate payload schema
      const validationResult = validateWebhookPayload(arizeWebhookSchema, req.body);
      if (!validationResult.success) {
        logger.warn({ errors: validationResult.error.errors }, "Arize webhook payload validation failed");
        return res.status(400).json({ 
          error: "Invalid webhook payload",
          details: validationResult.error.errors
        });
      }
      
      const payload = validationResult.data;
      
      // Arize sends alerts for drift, data quality, and bias
      let eventType = "drift"; // default
      let severity: string = "medium";
      let metric: string | undefined;
      let metricValue: string | undefined;
      let threshold: string | undefined;
      
      // Arize drift monitoring
      if (payload.alert_type === "drift") {
        eventType = "drift";
        metric = payload.feature_name || "drift_score";
        metricValue = payload.drift_value?.toString();
        threshold = payload.threshold?.toString();
        severity = parseFloat(metricValue || "0") > 0.2 ? "critical" : "high";
      }
      // Arize bias detection
      else if (payload.alert_type === "bias") {
        eventType = "bias";
        metric = payload.fairness_metric || "demographic_parity";
        metricValue = payload.bias_value?.toString();
        threshold = payload.threshold?.toString();
        severity = "high";
      }
      // Arize performance degradation
      else if (payload.alert_type === "performance") {
        eventType = "performance_degradation";
        metric = payload.metric_name || "accuracy";
        metricValue = payload.current_value?.toString();
        threshold = payload.threshold?.toString();
        severity = "high";
      }
      
      // Store telemetry event
      const telemetryEvent = await storage.createAITelemetryEvent({
        aiSystemId,
        eventType,
        source: "arize",
        severity,
        metric,
        metricValue,
        threshold,
        payload: JSON.stringify(payload),
        processedAt: new Date(),
      });
      
      // Update AI system lastCheck
      await storage.updateAISystemLastCheck(aiSystemId, new Date());
      
      // Process through Translation Engine
      try {
        const { translationEngine } = await import("./services/translation-engine");
        const translatedEvent = await translationEngine.translate(telemetryEvent);
        
        // Store violations and actions
        for (const violation of translatedEvent.violations) {
          const violationRecord = await storage.createComplianceViolation({
            telemetryEventId: telemetryEvent.id,
            aiSystemId: telemetryEvent.aiSystemId,
            framework: violation.framework,
            controlId: violation.controlId,
            controlName: violation.controlName,
            violationType: violation.violationType,
            severity: violation.severity,
            requiresReporting: violation.requiresReporting,
            reportingDeadline: violation.reportingDeadline || null,
            description: violation.description,
            resolved: false,
          });
          
          const actionsForViolation = translatedEvent.actionsByViolation.get(violation) || [];
          for (const action of actionsForViolation) {
            await storage.createRequiredAction({
              violationId: violationRecord.id,
              aiSystemId: telemetryEvent.aiSystemId,
              actionType: action.actionType,
              priority: action.priority,
              description: action.description,
              assignee: action.assignee,
              deadline: action.deadline,
              automated: action.automated,
              actionDetails: action.actionDetails ? JSON.stringify(action.actionDetails) : null,
              status: "pending",
            });
          }
        }
        
        logger.info({ violationCount: translatedEvent.violations.length }, `Arize webhook processed: ${translatedEvent.violations.length} violation(s)`);
      } catch (translationError) {
        logger.error({ err: translationError }, "Arize translation error (non-critical)");
      }
      
      res.status(200).json({ success: true, eventId: telemetryEvent.id });
    } catch (error) {
      logger.error({ err: error }, "Arize webhook error");
      res.status(500).json({ error: "Failed to process Arize webhook" });
    }
  });

  // LangFuse webhook receiver for AI observability telemetry (HMAC-SHA256 verified)
  app.post("/api/webhooks/langfuse/:aiSystemId", webhookRateLimit, verifyWebhookSignature('langfuse'), async (req, res) => {
    try {
      const { aiSystemId } = req.params;
      
      // Verify AI system exists
      const aiSystem = await storage.getAISystem(aiSystemId);
      if (!aiSystem) {
        return res.status(404).json({ error: "AI system not found" });
      }
      
      // Validate payload schema
      const validationResult = validateWebhookPayload(langFuseWebhookSchema, req.body);
      if (!validationResult.success) {
        logger.warn({ errors: validationResult.error.errors }, "LangFuse webhook payload validation failed");
        return res.status(400).json({ 
          error: "Invalid webhook payload",
          details: validationResult.error.errors
        });
      }
      
      const payload = validationResult.data;
      
      // LangFuse sends trace/span/generation events
      let eventType = "trace";
      let severity: string = "medium";
      let metric: string | undefined;
      let metricValue: string | undefined;
      
      // LangFuse trace events
      if (payload.type === "trace") {
        eventType = "trace";
        metric = "latency";
        metricValue = payload.latency?.toString();
        severity = parseFloat(metricValue || "0") > 5000 ? "high" : "low";
      }
      // LangFuse generation events (LLM calls)
      else if (payload.type === "generation") {
        eventType = "generation";
        metric = payload.model;
        metricValue = payload.tokens?.toString();
        
        // Check for errors
        if (payload.error) {
          severity = "high";
        }
      }
      // LangFuse score events (evaluation results)
      else if (payload.type === "score") {
        eventType = "score";
        metric = payload.name;
        metricValue = payload.value?.toString();
        severity = parseFloat(metricValue || "0") < 0.5 ? "high" : "low";
      }
      
      // Store telemetry event
      const telemetryEvent = await storage.createAITelemetryEvent({
        aiSystemId,
        eventType,
        source: "langfuse",
        severity,
        metric,
        metricValue,
        payload: JSON.stringify(payload),
        processedAt: new Date(),
      });
      
      // Update AI system lastCheck
      await storage.updateAISystemLastCheck(aiSystemId, new Date());
      
      // Process through Translation Engine
      try {
        const { translationEngine } = await import("./services/translation-engine");
        const translatedEvent = await translationEngine.translate(telemetryEvent);
        
        // Store violations and actions
        for (const violation of translatedEvent.violations) {
          const violationRecord = await storage.createComplianceViolation({
            telemetryEventId: telemetryEvent.id,
            aiSystemId: telemetryEvent.aiSystemId,
            framework: violation.framework,
            controlId: violation.controlId,
            controlName: violation.controlName,
            violationType: violation.violationType,
            severity: violation.severity,
            requiresReporting: violation.requiresReporting,
            reportingDeadline: violation.reportingDeadline || null,
            description: violation.description,
            resolved: false,
          });
          
          const actionsForViolation = translatedEvent.actionsByViolation.get(violation) || [];
          for (const action of actionsForViolation) {
            await storage.createRequiredAction({
              violationId: violationRecord.id,
              aiSystemId: telemetryEvent.aiSystemId,
              actionType: action.actionType,
              priority: action.priority,
              description: action.description,
              assignee: action.assignee,
              deadline: action.deadline,
              automated: action.automated,
              actionDetails: action.actionDetails ? JSON.stringify(action.actionDetails) : null,
              status: "pending",
            });
          }
        }
        
        logger.info({ violationCount: translatedEvent.violations.length }, `LangFuse webhook processed: ${translatedEvent.violations.length} violation(s)`);
      } catch (translationError) {
        logger.error({ err: translationError }, "LangFuse translation error (non-critical)");
      }
      
      res.status(200).json({ success: true, eventId: telemetryEvent.id });
    } catch (error) {
      logger.error({ err: error }, "LangFuse webhook error");
      res.status(500).json({ error: "Failed to process LangFuse webhook" });
    }
  });

  // Weights & Biases webhook receiver for ML experiment tracking (HMAC-SHA256 verified)
  app.post("/api/webhooks/wandb/:aiSystemId", webhookRateLimit, verifyWebhookSignature('wandb'), async (req, res) => {
    try {
      const { aiSystemId } = req.params;
      
      // Verify AI system exists
      const aiSystem = await storage.getAISystem(aiSystemId);
      if (!aiSystem) {
        return res.status(404).json({ error: "AI system not found" });
      }
      
      // Validate payload schema
      const validationResult = validateWebhookPayload(wandbWebhookSchema, req.body);
      if (!validationResult.success) {
        logger.warn({ errors: validationResult.error.errors }, "W&B webhook payload validation failed");
        return res.status(400).json({ 
          error: "Invalid webhook payload",
          details: validationResult.error.errors
        });
      }
      
      const payload = validationResult.data;
      
      // W&B sends run events for model training
      let eventType = "run";
      let severity: string = "low";
      let metric: string | undefined;
      let metricValue: string | undefined;
      
      // W&B run completed events
      if (payload.event_type === "run_completed") {
        eventType = "training_complete";
        metric = payload.metrics?.accuracy || "model_performance";
        metricValue = payload.metrics?.val_accuracy?.toString();
        
        // Check for performance degradation
        const accuracy = parseFloat(metricValue || "0");
        if (accuracy < 0.85) {
          severity = "high";
        }
      }
      // W&B alert events
      else if (payload.event_type === "alert") {
        eventType = "alert";
        metric = payload.alert_name;
        metricValue = payload.value?.toString();
        severity = payload.severity === "critical" ? "critical" : "high";
      }
      
      // Store telemetry event
      const telemetryEvent = await storage.createAITelemetryEvent({
        aiSystemId,
        eventType,
        source: "wandb",
        severity,
        metric,
        metricValue,
        payload: JSON.stringify(payload),
        processedAt: new Date(),
      });
      
      // Update AI system lastCheck
      await storage.updateAISystemLastCheck(aiSystemId, new Date());
      
      // Process through Translation Engine
      try {
        const { translationEngine } = await import("./services/translation-engine");
        const translatedEvent = await translationEngine.translate(telemetryEvent);
        
        // Store violations and actions
        for (const violation of translatedEvent.violations) {
          const violationRecord = await storage.createComplianceViolation({
            telemetryEventId: telemetryEvent.id,
            aiSystemId: telemetryEvent.aiSystemId,
            framework: violation.framework,
            controlId: violation.controlId,
            controlName: violation.controlName,
            violationType: violation.violationType,
            severity: violation.severity,
            requiresReporting: violation.requiresReporting,
            reportingDeadline: violation.reportingDeadline || null,
            description: violation.description,
            resolved: false,
          });
          
          const actionsForViolation = translatedEvent.actionsByViolation.get(violation) || [];
          for (const action of actionsForViolation) {
            await storage.createRequiredAction({
              violationId: violationRecord.id,
              aiSystemId: telemetryEvent.aiSystemId,
              actionType: action.actionType,
              priority: action.priority,
              description: action.description,
              assignee: action.assignee,
              deadline: action.deadline,
              automated: action.automated,
              actionDetails: action.actionDetails ? JSON.stringify(action.actionDetails) : null,
              status: "pending",
            });
          }
        }
        
        logger.info({ violationCount: translatedEvent.violations.length }, `W&B webhook processed: ${translatedEvent.violations.length} violation(s)`);
      } catch (translationError) {
        logger.error({ err: translationError }, "W&B translation error (non-critical)");
      }
      
      res.status(200).json({ success: true, eventId: telemetryEvent.id });
    } catch (error) {
      logger.error({ err: error }, "W&B webhook error");
      res.status(500).json({ error: "Failed to process W&B webhook" });
    }
  });

  // PagerDuty webhook receiver for incident management (HMAC-SHA256 verified)
  app.post("/api/webhooks/pagerduty", webhookRateLimit, verifyWebhookSignature('pagerduty'), async (req, res) => {
    try {
      // Validate payload schema
      const validationResult = validateWebhookPayload(pagerDutyWebhookSchema, req.body);
      if (!validationResult.success) {
        logger.warn({ errors: validationResult.error.errors }, "PagerDuty webhook payload validation failed");
        return res.status(400).json({ 
          error: "Invalid webhook payload",
          details: validationResult.error.errors
        });
      }
      
      const payload = validationResult.data;
      
      // PagerDuty sends incident events
      if (payload.event && payload.event.event_type === "incident.triggered") {
        const incident = payload.event.data;
        
        // Extract AI system ID from incident custom fields or title
        const aiSystemId = incident.custom_details?.ai_system_id;
        if (!aiSystemId) {
          return res.status(200).json({ message: "No AI system ID in incident" });
        }
        
        // Verify AI system exists
        const aiSystem = await storage.getAISystem(aiSystemId);
        if (!aiSystem) {
          return res.status(404).json({ error: "AI system not found" });
        }
        
        // Create monitoring alert
        await storage.createAlert({
          aiSystemId,
          type: "PagerDuty Incident",
          severity: incident.urgency === "high" ? "critical" : "high",
          message: incident.title || "PagerDuty incident triggered",
        });
        
        logger.info({ aiSystemId, incidentId: incident.id }, "PagerDuty incident processed");
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error({ err: error }, "PagerDuty webhook error");
      res.status(500).json({ error: "Failed to process PagerDuty webhook" });
    }
  });

  // DataDog webhook receiver for infrastructure monitoring (HMAC-SHA256 verified)
  app.post("/api/webhooks/datadog", webhookRateLimit, verifyWebhookSignature('datadog'), async (req, res) => {
    try {
      // Validate payload schema
      const validationResult = validateWebhookPayload(dataDogWebhookSchema, req.body);
      if (!validationResult.success) {
        logger.warn({ errors: validationResult.error.errors }, "DataDog webhook payload validation failed");
        return res.status(400).json({ 
          error: "Invalid webhook payload",
          details: validationResult.error.errors
        });
      }
      
      const payload = validationResult.data;
      
      // DataDog sends monitor alerts
      if (payload.event_type === "triggered" || payload.event_type === "no_data") {
        // Extract AI system ID from tags
        const tags = payload.tags || [];
        const aiSystemTag = tags.find((t: string) => t.startsWith("ai_system:"));
        if (!aiSystemTag) {
          return res.status(200).json({ message: "No AI system tag in alert" });
        }
        
        const aiSystemId = aiSystemTag.split(":")[1];
        
        // Verify AI system exists
        const aiSystem = await storage.getAISystem(aiSystemId);
        if (!aiSystem) {
          return res.status(404).json({ error: "AI system not found" });
        }
        
        // Determine severity
        const severity = payload.alert_type === "error" ? "critical" : "high";
        
        // Create monitoring alert
        await storage.createAlert({
          aiSystemId,
          type: "DataDog Monitor",
          severity,
          message: payload.title || "DataDog monitor alert",
        });
        
        logger.info({ aiSystemId, monitorId: payload.id }, "DataDog alert processed");
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error({ err: error }, "DataDog webhook error");
      res.status(500).json({ error: "Failed to process DataDog webhook" });
    }
  });

  // Twilio webhook receiver for SMS delivery events (HMAC-SHA256 verified)
  app.post("/api/webhooks/twilio", webhookRateLimit, verifyWebhookSignature('twilio'), async (req, res) => {
    try {
      // Validate payload schema
      const validationResult = validateWebhookPayload(twilioWebhookSchema, req.body);
      if (!validationResult.success) {
        logger.warn({ errors: validationResult.error.errors }, "Twilio webhook payload validation failed");
        return res.status(400).json({ 
          error: "Invalid webhook payload",
          details: validationResult.error.errors
        });
      }
      
      const payload = validationResult.data;
      
      // Twilio sends delivery status callbacks
      // MessageStatus: queued, sent, delivered, undelivered, failed
      if (payload.MessageStatus) {
        logger.info({ 
          messageSid: payload.MessageSid,
          status: payload.MessageStatus,
          to: payload.To,
        }, "Twilio SMS status update received");
        
        // Store delivery status for audit trail if needed
        // Could update notification logs here
      }
      
      res.status(200).send("OK");
    } catch (error) {
      logger.error({ err: error }, "Twilio webhook error");
      res.status(500).json({ error: "Failed to process Twilio webhook" });
    }
  });

  // Slack webhook receiver for interactive events (HMAC-SHA256 verified)
  app.post("/api/webhooks/slack", webhookRateLimit, verifyWebhookSignature('slack'), async (req, res) => {
    try {
      // Validate payload schema
      const validationResult = validateWebhookPayload(slackWebhookSchema, req.body);
      if (!validationResult.success) {
        logger.warn({ errors: validationResult.error.errors }, "Slack webhook payload validation failed");
        return res.status(400).json({ 
          error: "Invalid webhook payload",
          details: validationResult.error.errors
        });
      }
      
      const payload = validationResult.data;
      
      // Handle Slack challenge for webhook verification
      if (payload.type === "url_verification") {
        return res.json({ challenge: payload.challenge });
      }
      
      // Handle Slack interactive messages (button clicks, etc.)
      if (payload.type === "event_callback" && payload.event) {
        const event = payload.event;
        
        logger.info({ 
          eventType: event.type,
          user: event.user,
          channel: event.channel,
        }, "Slack event received");
        
        // Could process user interactions with alert messages here
        // For example, acknowledge alerts, request details, etc.
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error({ err: error }, "Slack webhook error");
      res.status(500).json({ error: "Failed to process Slack webhook" });
    }
  });

  // Epic EHR FHIR webhook for clinical data events (HMAC-SHA256 verified)
  app.post("/api/webhooks/epic/:aiSystemId", webhookRateLimit, verifyWebhookSignature('epic'), async (req, res) => {
    try {
      const { aiSystemId } = req.params;
      
      // Verify AI system exists
      const aiSystem = await storage.getAISystem(aiSystemId);
      if (!aiSystem) {
        return res.status(404).json({ error: "AI system not found" });
      }
      
      // Validate payload schema
      const validationResult = validateWebhookPayload(epicWebhookSchema, req.body);
      if (!validationResult.success) {
        logger.warn({ errors: validationResult.error.errors }, "Epic webhook payload validation failed");
        return res.status(400).json({ 
          error: "Invalid webhook payload",
          details: validationResult.error.errors
        });
      }
      
      const payload = validationResult.data;
      
      // Epic sends FHIR resource subscription notifications
      // Process clinical data access events for compliance tracking
      const eventType = payload.resourceType === "Patient" ? "patient_access" : "clinical_data_access";
      
      // Store telemetry for audit trail
      const telemetryEvent = await storage.createAITelemetryEvent({
        aiSystemId,
        eventType,
        source: "epic_ehr",
        severity: "low",
        metric: payload.resourceType,
        payload: JSON.stringify(payload),
        processedAt: new Date(),
      });
      
      logger.info({ aiSystemId, resourceType: payload.resourceType }, "Epic EHR event processed");
      
      res.status(200).json({ success: true, eventId: telemetryEvent.id });
    } catch (error) {
      logger.error({ err: error }, "Epic EHR webhook error");
      res.status(500).json({ error: "Failed to process Epic webhook" });
    }
  });

  // Cerner EHR FHIR webhook for clinical data events (HMAC-SHA256 verified)
  app.post("/api/webhooks/cerner/:aiSystemId", webhookRateLimit, verifyWebhookSignature('cerner'), async (req, res) => {
    try {
      const { aiSystemId } = req.params;
      
      // Verify AI system exists
      const aiSystem = await storage.getAISystem(aiSystemId);
      if (!aiSystem) {
        return res.status(404).json({ error: "AI system not found" });
      }
      
      // Validate payload schema
      const validationResult = validateWebhookPayload(cernerWebhookSchema, req.body);
      if (!validationResult.success) {
        logger.warn({ errors: validationResult.error.errors }, "Cerner webhook payload validation failed");
        return res.status(400).json({ 
          error: "Invalid webhook payload",
          details: validationResult.error.errors
        });
      }
      
      const payload = validationResult.data;
      
      // Cerner sends FHIR resource subscription notifications
      const eventType = payload.resourceType === "Patient" ? "patient_access" : "clinical_data_access";
      
      // Store telemetry for audit trail
      const telemetryEvent = await storage.createAITelemetryEvent({
        aiSystemId,
        eventType,
        source: "cerner_ehr",
        severity: "low",
        metric: payload.resourceType,
        payload: JSON.stringify(payload),
        processedAt: new Date(),
      });
      
      logger.info({ aiSystemId, resourceType: payload.resourceType }, "Cerner EHR event processed");
      
      res.status(200).json({ success: true, eventId: telemetryEvent.id });
    } catch (error) {
      logger.error({ err: error }, "Cerner EHR webhook error");
      res.status(500).json({ error: "Failed to process Cerner webhook" });
    }
  });

  // Athenahealth EHR FHIR webhook for clinical data events (HMAC-SHA256 verified)
  app.post("/api/webhooks/athenahealth/:aiSystemId", webhookRateLimit, verifyWebhookSignature('athenahealth'), async (req, res) => {
    try {
      const { aiSystemId } = req.params;
      
      // Verify AI system exists
      const aiSystem = await storage.getAISystem(aiSystemId);
      if (!aiSystem) {
        return res.status(404).json({ error: "AI system not found" });
      }
      
      // Validate payload schema
      const validationResult = validateWebhookPayload(athenahealthWebhookSchema, req.body);
      if (!validationResult.success) {
        logger.warn({ errors: validationResult.error.errors }, "Athenahealth webhook payload validation failed");
        return res.status(400).json({ 
          error: "Invalid webhook payload",
          details: validationResult.error.errors
        });
      }
      
      const payload = validationResult.data;
      
      // Athenahealth sends FHIR resource subscription notifications
      const eventType = payload.resourceType === "Patient" ? "patient_access" : "clinical_data_access";
      
      // Store telemetry for audit trail
      const telemetryEvent = await storage.createAITelemetryEvent({
        aiSystemId,
        eventType,
        source: "athenahealth_ehr",
        severity: "low",
        metric: payload.resourceType,
        payload: JSON.stringify(payload),
        processedAt: new Date(),
      });
      
      logger.info({ aiSystemId, resourceType: payload.resourceType }, "Athenahealth EHR event processed");
      
      res.status(200).json({ success: true, eventId: telemetryEvent.id });
    } catch (error) {
      logger.error({ err: error }, "Athenahealth EHR webhook error");
      res.status(500).json({ error: "Failed to process Athenahealth webhook" });
    }
  });

  // ==========================================
  // COMPLIANCE REPORT GENERATION (Health System only)
  // ==========================================
  
  // Generate PDF compliance report
  app.post("/api/health-systems/:healthSystemId/reports/generate", requireRole("health_system"), async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const user = await storage.getUser(req.session.userId);
      if (!user || !user.healthSystemId) {
        return res.status(403).json({ error: "No health system associated with this account" });
      }
      
      const { healthSystemId } = req.params;
      
      // Verify ownership
      if (user.healthSystemId !== healthSystemId) {
        return res.status(403).json({ error: "Access denied: Can only generate reports for your health system" });
      }
      
      const { reportType = 'monthly', periodDays = 30 } = req.body;
      
      // Fetch data for report
      const healthSystem = await storage.getHealthSystem(healthSystemId);
      if (!healthSystem) {
        return res.status(404).json({ error: "Health system not found" });
      }
      
      const aiSystems = await storage.getAISystems(healthSystemId);
      
      // Calculate period
      const periodEnd = new Date();
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - periodDays);
      
      // Calculate statistics
      const verifiedSystems = aiSystems.filter(s => s.status === 'verified').length;
      const driftSystems = aiSystems.filter(s => s.status === 'drift').length;
      const criticalSystems = aiSystems.filter(s => s.riskLevel === 'Critical').length;
      
      // Get compliance data for each system
      const systemsWithCompliance = await Promise.all(
        aiSystems.map(async (system) => {
          const mappings = await storage.getComplianceMappingsBySystem(system.id);
          const compliantCount = mappings.filter(m => m.status === 'compliant').length;
          const totalCount = mappings.length;
          const complianceRate = totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 0;
          
          // Group by framework
          const frameworkScores: any[] = [];
          const frameworks = ['HIPAA', 'NIST_AI_RMF', 'FDA'];
          
          return {
            name: system.name,
            department: system.department,
            riskLevel: system.riskLevel,
            status: system.status,
            complianceRate,
            frameworkScores,
          };
        })
      );
      
      const averageComplianceRate = systemsWithCompliance.length > 0
        ? Math.round(systemsWithCompliance.reduce((sum, s) => sum + s.complianceRate, 0) / systemsWithCompliance.length)
        : 0;
      
      // Generate findings
      const findings = [];
      if (criticalSystems > 0) {
        findings.push({
          severity: 'critical',
          title: 'Critical Risk AI Systems Detected',
          description: `${criticalSystems} AI system(s) have been flagged with critical risk levels requiring immediate attention.`,
          affectedSystems: aiSystems.filter(s => s.riskLevel === 'Critical').map(s => s.name),
        });
      }
      if (driftSystems > 0) {
        findings.push({
          severity: 'medium',
          title: 'Compliance Drift Detected',
          description: `${driftSystems} AI system(s) are showing signs of compliance drift and require monitoring.`,
          affectedSystems: aiSystems.filter(s => s.status === 'drift').map(s => s.name),
        });
      }
      
      // Generate recommendations
      const recommendations = [];
      if (averageComplianceRate < 80) {
        recommendations.push('Increase compliance coverage across AI system portfolio to achieve 80%+ compliance rate.');
      }
      if (criticalSystems > 0) {
        recommendations.push('Immediately investigate and remediate critical risk AI systems to prevent regulatory exposure.');
      }
      if (driftSystems > 0) {
        recommendations.push('Implement continuous monitoring and automated compliance verification for systems showing drift.');
      }
      recommendations.push('Schedule regular compliance audits and maintain documentation for all AI systems.');
      
      // Generate PDF
      const { generateComplianceReport } = await import("./services/pdf-report-generator");
      const pdfBuffer = await generateComplianceReport({
        healthSystemName: healthSystem.name,
        reportType,
        periodStart,
        periodEnd,
        generatedAt: new Date(),
        generatedBy: user.username,
        summary: {
          totalSystems: aiSystems.length,
          verifiedSystems,
          driftSystems,
          criticalSystems,
          averageComplianceRate,
          frameworks: ['HIPAA Security Rule', 'NIST AI RMF', 'FDA SaMD Guidance'],
        },
        systems: systemsWithCompliance,
        findings,
        recommendations,
      });
      
      // Upload to S3 (if configured)
      const { S3Service } = await import("./s3");
      const reportId = `report-${Date.now()}`;
      const s3Key = S3Service.getReportKey(healthSystemId!, reportType, reportId);
      const s3Url = await S3Service.upload(s3Key, pdfBuffer, 'application/pdf');
      
      // Save report metadata to database
      const reportRecord = await storage.createComplianceReport({
        healthSystemId: healthSystemId!,
        reportType,
        frameworks: ['HIPAA Security Rule', 'NIST AI RMF', 'FDA SaMD Guidance'],
        periodStart,
        periodEnd,
        summary: JSON.stringify({
          totalSystems: aiSystems.length,
          verifiedSystems,
          driftSystems,
          criticalSystems,
          averageComplianceRate,
          frameworks: ['HIPAA Security Rule', 'NIST AI RMF', 'FDA SaMD Guidance'],
        }),
        findings: JSON.stringify(findings),
        recommendations,
        fileUrl: s3Url || null,
        generatedBy: req.session.userId!,
      });
      
      if (s3Url) {
        logger.info({ s3Url }, 'Report uploaded to S3');
      } else {
        logger.warn("S3 not configured - report metadata saved to database but file not archived");
      }
      
      // Send PDF for immediate download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="compliance-report-${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      logger.error({ err: error }, "Report generation error");
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // ==========================================
  // PUBLIC VENDOR TRUST PAGE API (no auth)
  // ==========================================
  
  // Get vendor trust page data (public endpoint)
  app.get("/api/public/vendors/:vendorId/trust-page", async (req, res) => {
    try {
      const { vendorId } = req.params;
      
      // Get vendor details
      const vendor = await storage.getVendor(vendorId);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      
      // Get approved certification applications from new workflow
      const applications = await storage.getCertificationApplicationsByVendor(vendorId);
      const approvedApplications = applications.filter(app => app.status === 'approved');
      
      // Get legacy certifications (for backwards compatibility)
      const legacyCertifications = await storage.getVendorCertifications(vendorId);
      
      // Get vendor's AI systems (only those deployed to health systems)
      const aiSystems = await storage.getAISystemsByVendor(vendorId);
      
      // For each AI system, get compliance mapping stats
      const systemsWithCompliance = await Promise.all(
        aiSystems.map(async (system) => {
          const mappings = await storage.getComplianceMappingsBySystem(system.id);
          const compliantCount = mappings.filter(m => m.status === 'compliant').length;
          const totalCount = mappings.length;
          
          return {
            id: system.id,
            name: system.name,
            department: system.department,
            riskLevel: system.riskLevel,
            status: system.status,
            complianceRate: totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 0,
            totalControls: totalCount,
            compliantControls: compliantCount,
          };
        })
      );
      
      // Calculate overall statistics
      const totalSystems = systemsWithCompliance.length;
      const verifiedSystems = systemsWithCompliance.filter(s => s.status === 'verified').length;
      const averageComplianceRate = totalSystems > 0 
        ? Math.round(systemsWithCompliance.reduce((sum, s) => sum + s.complianceRate, 0) / totalSystems)
        : 0;
      
      res.json({
        vendor: {
          id: vendor.id,
          name: vendor.name,
          description: vendor.description,
          category: vendor.category,
          certificationTier: vendor.certificationTier,
          verified: vendor.verified,
          logoUrl: vendor.logoUrl,
          website: vendor.website,
        },
        certifications: [
          // New certification applications (approved)
          ...approvedApplications.map(app => ({
            tier: app.tierRequested,
            type: `${app.tierRequested} Certification`,
            status: 'verified',
            verifiedDate: app.reviewedAt || app.submittedAt,
            automatedScore: app.automatedChecksResult ? JSON.parse(app.automatedChecksResult).score : null,
          })),
          // Legacy certifications
          ...legacyCertifications.map(cert => ({
            type: cert.type,
            status: cert.status,
            verifiedDate: cert.verifiedDate,
          })),
        ],
        aiSystems: systemsWithCompliance,
        statistics: {
          totalSystems,
          verifiedSystems,
          averageComplianceRate,
          certificationsCount: approvedApplications.length + legacyCertifications.filter(c => c.status === 'verified').length,
        },
      });
    } catch (error) {
      logger.error({ err: error }, "Trust page error");
      res.status(500).json({ error: "Failed to load trust page" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
