import crypto from "crypto";
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
  // ===== Inngest Workflow Endpoint =====
  
  // Serve Inngest durable workflows
  try {
    const { serve } = await import("inngest/express");
    const { inngest } = await import("./inngest/client");
    const { certificationWorkflow } = await import("./inngest/functions/certification-workflow");
    const { predictiveAlertsJob, predictiveAlertsOnDemand } = await import("./inngest/functions/predictive-alerts");
    const { automatedActionExecutor } = await import("./inngest/functions/action-executor");
    
    app.use(
      "/api/inngest",
      serve({
        client: inngest,
        functions: [
          certificationWorkflow,
          predictiveAlertsJob,
          predictiveAlertsOnDemand,
          automatedActionExecutor,
        ],
      })
    );
    
    logger.info("Inngest durable workflows initialized");
  } catch (error) {
    logger.warn({ err: error }, "Inngest not initialized - background jobs will use legacy system");
  }
  
  // ===== API Documentation =====
  
  /**
   * @openapi
   * /api-docs:
   *   get:
   *     summary: API Documentation UI
   *     description: Interactive Swagger UI for exploring and testing API endpoints
   *     tags: [Documentation]
   *     responses:
   *       200:
   *         description: Swagger UI HTML page
   */
  const swaggerUi = await import('swagger-ui-express');
  const { swaggerSpec } = await import('./swagger.config');
  
  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Spectral API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  }));
  
  // Expose raw OpenAPI spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerSpec);
  });
  
  // ===== Security Routes =====
  
  /**
   * @openapi
   * /api/csrf-token:
   *   get:
   *     summary: Get CSRF token
   *     description: Retrieve CSRF token for state-changing requests (stored in session)
   *     tags: [Authentication]
   *     responses:
   *       200:
   *         description: CSRF token retrieved
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 csrfToken:
   *                   type: string
   */
  app.get("/api/csrf-token", getCsrfToken);
  
  // ===== Authentication Routes =====
  
  /**
   * @openapi
   * /api/auth/register:
   *   post:
   *     summary: Register new user
   *     description: Create new user account with organization (health system or AI vendor)
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [username, password, email, role, organizationName]
   *             properties:
   *               username:
   *                 type: string
   *                 minLength: 3
   *               password:
   *                 type: string
   *                 minLength: 6
   *               email:
   *                 type: string
   *                 format: email
   *               role:
   *                 type: string
   *                 enum: [health_system, vendor]
   *               organizationName:
   *                 type: string
   *                 minLength: 2
   *     responses:
   *       201:
   *         description: User created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       400:
   *         description: Invalid registration data or user already exists
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
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
      
      // Generate email verification token (32 bytes = 64 hex chars)
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Hash the verification token before storing (security best practice)
      const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
      
      // Create user with org association - first user is admin
      const user = await storage.createUser({
        username: data.username,
        password: hashedPassword,
        email: data.email,
        emailVerified: false,
        emailVerificationToken: verificationTokenHash,
        emailVerificationTokenExpiry: tokenExpiry,
        role: data.role,
        permissions: 'admin', // First user for organization is always admin
        healthSystemId,
        vendorId,
      });
      
      // Send verification email
      const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}`;
      const { sendEmailVerificationEmail } = await import("./services/email-notification");
      await sendEmailVerificationEmail(user.email, user.username, verificationUrl);
      
      // Do NOT set session until email is verified
      // req.session.userId = user.id;
      
      res.status(201).json({ 
        message: "Registration successful! Please check your email to verify your account.",
        email: user.email,
        emailSent: true
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid registration data" });
    }
  });
  
  /**
   * @openapi
   * /api/auth/login:
   *   post:
   *     summary: User login
   *     description: Authenticate user with username/password and optional MFA token
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [username, password]
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *               mfaToken:
   *                 type: string
   *                 description: 6-digit MFA token (required if MFA enabled)
   *     responses:
   *       200:
   *         description: Login successful or MFA required
   *         content:
   *           application/json:
   *             schema:
   *               oneOf:
   *                 - $ref: '#/components/schemas/User'
   *                 - type: object
   *                   properties:
   *                     mfaRequired:
   *                       type: boolean
   *                     message:
   *                       type: string
   *       401:
   *         description: Invalid credentials or MFA token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
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
      
      // Check if email is verified
      if (!user.emailVerified) {
        return res.status(403).json({ 
          error: "Email not verified. Please check your email for verification link.",
          emailVerified: false
        });
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
  
  /**
   * @openapi
   * /api/auth/logout:
   *   post:
   *     summary: User logout
   *     description: Destroy user session and log out
   *     tags: [Authentication]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Logout successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *       500:
   *         description: Logout failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
  
  // Email verification endpoint
  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Invalid verification token" });
      }
      
      // Find user by verification token
      const user = await storage.getUserByVerificationToken(token);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired verification token" });
      }
      
      // Check if token is expired
      if (user.emailVerificationTokenExpiry && new Date() > user.emailVerificationTokenExpiry) {
        return res.status(400).json({ error: "Verification token has expired. Please request a new one." });
      }
      
      // Mark email as verified and clear token
      await storage.verifyUserEmail(user.id);
      
      // Automatically log in the user
      req.session.userId = user.id;
      
      res.json({ message: "Email verified successfully! You can now log in.", emailVerified: true });
    } catch (error) {
      logger.error({ err: error }, "Email verification error");
      res.status(500).json({ error: "Failed to verify email" });
    }
  });
  
  // Resend verification email
  /**
   * @openapi
   * /api/auth/resend-verification:
   *   post:
   *     summary: Resend email verification
   *     description: Resend verification email for unverified account
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email]
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *     responses:
   *       200:
   *         description: Verification email sent
   *       400:
   *         description: Email already verified or user not found
   */
  app.post("/api/auth/resend-verification", authRateLimit, async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists for security
        return res.json({ message: "If your email is registered, you will receive a verification link." });
      }
      
      // Check if already verified
      if (user.emailVerified) {
        return res.status(400).json({ error: "Email is already verified" });
      }
      
      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Update user with new token
      await storage.updateUserVerificationToken(user.id, verificationToken, tokenExpiry);
      
      // Send verification email
      const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}`;
      const { sendEmailVerificationEmail } = await import("./services/email-notification");
      await sendEmailVerificationEmail(user.email, user.username, verificationUrl);
      
      res.json({ message: "Verification email sent. Please check your inbox." });
    } catch (error) {
      logger.error({ err: error }, "Resend verification error");
      res.status(500).json({ error: "Failed to resend verification email" });
    }
  });
  
  // Forgot password - send reset email
  /**
   * @openapi
   * /api/auth/forgot-password:
   *   post:
   *     summary: Request password reset
   *     description: Send password reset email with secure token
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email]
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *     responses:
   *       200:
   *         description: Reset email sent if account exists
   */
  app.post("/api/auth/forgot-password", authRateLimit, async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists for security
        return res.json({ message: "If your email is registered, you will receive a password reset link." });
      }
      
      // Generate password reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // Update user with reset token
      await storage.updateUserPasswordResetToken(user.id, resetToken, tokenExpiry);
      
      // Send password reset email
      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;
      const { sendPasswordResetEmail } = await import("./services/email-notification");
      await sendPasswordResetEmail(user.email, user.username, resetUrl);
      
      res.json({ message: "Password reset link sent. Please check your email." });
    } catch (error) {
      logger.error({ err: error }, "Forgot password error");
      res.status(500).json({ error: "Failed to send password reset email" });
    }
  });
  
  // Reset password with token
  /**
   * @openapi
   * /api/auth/reset-password:
   *   post:
   *     summary: Reset password with token
   *     description: Complete password reset using token from email
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [token, newPassword]
   *             properties:
   *               token:
   *                 type: string
   *               newPassword:
   *                 type: string
   *                 minLength: 6
   *     responses:
   *       200:
   *         description: Password reset successfully
   *       400:
   *         description: Invalid or expired token
   */
  app.post("/api/auth/reset-password", authRateLimit, async (req, res) => {
    try {
      const { token, newPassword } = z.object({
        token: z.string(),
        newPassword: z.string().min(6)
      }).parse(req.body);
      
      // Find user by reset token
      const user = await storage.getUserByPasswordResetToken(token);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }
      
      // Check if token is expired
      if (user.passwordResetTokenExpiry && new Date() > user.passwordResetTokenExpiry) {
        return res.status(400).json({ error: "Reset token has expired. Please request a new one." });
      }
      
      // Hash new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update password and clear reset token
      await storage.resetUserPassword(user.id, hashedPassword);
      
      res.json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (error) {
      logger.error({ err: error }, "Reset password error");
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // ===== Enterprise SSO Routes (WorkOS) =====
  
  /**
   * @openapi
   * /api/auth/sso/login:
   *   get:
   *     summary: Initiate Enterprise SSO login
   *     description: Redirect user to WorkOS SSO provider (SAML/OAuth) for authentication
   *     tags: [Authentication]
   *     parameters:
   *       - in: query
   *         name: organization
   *         schema:
   *           type: string
   *         description: Organization ID for direct SSO login
   *       - in: query
   *         name: connection
   *         schema:
   *           type: string
   *         description: Specific SSO connection ID
   *       - in: query
   *         name: provider
   *         schema:
   *           type: string
   *         description: SSO provider (default 'authkit')
   *     responses:
   *       302:
   *         description: Redirect to SSO provider
   *       503:
   *         description: Enterprise SSO not configured
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.get("/api/auth/sso/login", async (req, res) => {
    try {
      const { getWorkOSClient, getWorkOSConfig, isWorkOSConfigured } = await import("./services/workos");
      
      if (!isWorkOSConfigured()) {
        return res.status(503).json({ 
          error: "Enterprise SSO is not configured. Please contact your administrator." 
        });
      }

      const workos = getWorkOSClient();
      const config = getWorkOSConfig();
      
      if (!workos || !config.clientId) {
        return res.status(503).json({ error: "SSO service unavailable" });
      }

      // Get organization from query parameter (for direct SSO link)
      const { organization, connection, provider } = req.query;

      const authorizationUrl = workos.userManagement.getAuthorizationUrl({
        provider: (provider as string) || 'authkit',
        clientId: config.clientId,
        redirectUri: config.redirectUri || `${req.protocol}://${req.get('host')}/api/auth/sso/callback`,
        ...(organization && { organization: organization as string }),
        ...(connection && { connection: connection as string }),
      });

      res.redirect(authorizationUrl);
    } catch (error) {
      logger.error({ err: error }, "SSO login initiation error");
      res.status(500).json({ error: "Failed to initiate SSO login" });
    }
  });

  /**
   * @openapi
   * /api/auth/sso/callback:
   *   get:
   *     summary: SSO authentication callback
   *     description: Handle OAuth/SAML callback from WorkOS, auto-provision user if needed
   *     tags: [Authentication]
   *     parameters:
   *       - in: query
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *         description: Authorization code from SSO provider
   *     responses:
   *       302:
   *         description: Redirect to dashboard after successful authentication
   *       400:
   *         description: Invalid callback - missing authorization code
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       503:
   *         description: SSO service unavailable
   */
  app.get("/api/auth/sso/callback", async (req, res) => {
    try {
      const { code } = req.query;
      
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: "Invalid SSO callback - missing authorization code" });
      }

      const { getWorkOSClient, getWorkOSConfig } = await import("./services/workos");
      const workos = getWorkOSClient();
      const config = getWorkOSConfig();
      
      if (!workos || !config.clientId) {
        return res.status(503).json({ error: "SSO service unavailable" });
      }

      // Exchange authorization code for user profile
      const { user: ssoUser } = await workos.userManagement.authenticateWithCode({
        code,
        clientId: config.clientId,
      });

      // Find or create user based on SSO identity
      let user = await storage.getUserBySSOIdentity(ssoUser.id, ssoUser.email);
      
      if (!user) {
        // Auto-provision user from SSO
        const hashedDummyPassword = await hashPassword(crypto.randomBytes(32).toString('hex'));
        
        // Determine organization from SSO user data
        let healthSystemId: string | null = null;
        let vendorId: string | null = null;
        
        // Create or find organization based on SSO domain/organization
        const emailDomain = ssoUser.email.split('@')[1];
        
        // Default to health system for now - in production, you'd have org mapping
        const healthSystem = await storage.createHealthSystem({
          name: emailDomain,
        });
        healthSystemId = healthSystem.id;

        user = await storage.createUser({
          username: ssoUser.email,
          password: hashedDummyPassword, // Not used for SSO users
          email: ssoUser.email,
          emailVerified: true, // SSO users are pre-verified
          firstName: ssoUser.firstName || undefined,
          lastName: ssoUser.lastName || undefined,
          ssoProvider: 'workos',
          ssoExternalId: ssoUser.id,
          ssoOrganizationId: (ssoUser as any).organizationId || undefined,
          role: 'health_system',
          permissions: 'admin', // First SSO user is admin
          healthSystemId,
          vendorId,
        });

        logger.info({ userId: user.id, email: user.email }, "Auto-provisioned SSO user");
      } else {
        // Update last login
        await storage.updateUserLastLogin(user.id);
      }

      // Create session
      req.session.userId = user.id;

      // Log successful SSO login
      await storage.createAuditLog({
        userId: user.id,
        action: 'sso_login',
        resourceType: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        healthSystemId: user.healthSystemId || undefined,
        vendorId: user.vendorId || undefined,
      });

      // Redirect to dashboard
      res.redirect('/dashboard');
    } catch (error) {
      logger.error({ err: error }, "SSO callback error");
      res.redirect('/login?error=sso_failed');
    }
  });

  /**
   * @openapi
   * /api/auth/sso/logout:
   *   post:
   *     summary: SSO logout
   *     description: Log out user from SSO session and destroy local session
   *     tags: [Authentication]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Successfully logged out
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Logged out successfully
   *       500:
   *         description: Logout failed
   */
  app.post("/api/auth/sso/logout", async (req, res) => {
    const userId = req.session.userId;
    
    req.session.destroy((err) => {
      if (err) {
        logger.error({ err }, "SSO logout session destruction failed");
        return res.status(500).json({ error: "Logout failed" });
      }
      
      // In production, you might redirect to WorkOS logout URL
      res.json({ message: "Logged out successfully" });
    });
  });
  
  /**
   * @openapi
   * /api/auth/me:
   *   get:
   *     summary: Get current user
   *     description: Retrieve authenticated user profile
   *     tags: [Authentication]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: User profile
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       401:
   *         description: Not authenticated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: User not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
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

  /**
   * @openapi
   * /api/auth/mfa/setup:
   *   post:
   *     summary: Setup MFA
   *     description: Generate MFA secret, QR code, and backup codes for two-factor authentication
   *     tags: [Authentication]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: MFA setup data (QR code URL, backup codes, secret)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 qrCodeUrl:
   *                   type: string
   *                   description: QR code URL for authenticator apps
   *                 backupCodes:
   *                   type: array
   *                   items:
   *                     type: string
   *                   description: One-time backup codes (save these!)
   *                 secret:
   *                   type: string
   *                   description: Secret key for manual entry
   *       400:
   *         description: MFA already enabled
   *       401:
   *         description: Not authenticated
   *       404:
   *         description: User not found
   */
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

  /**
   * @openapi
   * /api/auth/mfa/verify-setup:
   *   post:
   *     summary: Verify and enable MFA
   *     description: Verify MFA token and enable two-factor authentication
   *     tags: [Authentication]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [token]
   *             properties:
   *               token:
   *                 type: string
   *                 description: 6-digit MFA token from authenticator app
   *     responses:
   *       200:
   *         description: MFA enabled successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       400:
   *         description: MFA setup not initiated
   *       401:
   *         description: Invalid MFA token
   *       404:
   *         description: User not found
   */
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

  /**
   * @openapi
   * /api/auth/mfa/backup:
   *   post:
   *     summary: Login with MFA backup code
   *     description: Authenticate using one-time backup code when MFA device unavailable
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [username, password, backupCode]
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *               backupCode:
   *                 type: string
   *                 description: One-time 8-character backup code
   *     responses:
   *       200:
   *         description: Login successful (backup code consumed)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       401:
   *         description: Invalid credentials or backup code
   */
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

  /**
   * @openapi
   * /api/auth/mfa/disable:
   *   post:
   *     summary: Disable MFA
   *     description: Turn off two-factor authentication for user account (requires password confirmation)
   *     tags: [Authentication]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [password]
   *             properties:
   *               password:
   *                 type: string
   *                 format: password
   *                 description: Current account password to confirm disable
   *     responses:
   *       200:
   *         description: MFA disabled successfully
   *       401:
   *         description: Invalid password or not authenticated
   */
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
  
  /**
   * @openapi
   * /api/users:
   *   get:
   *     summary: List organization users
   *     description: Get all users in organization (admin only)
   *     tags: [User Management]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: List of users
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/User'
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Admin access required
   */
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
  
  /**
   * @openapi
   * /api/users/invite:
   *   post:
   *     summary: Invite user to organization
   *     description: Send secure invitation email to new user (admin only)
   *     tags: [User Management]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email]
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               permissions:
   *                 type: string
   *                 enum: [admin, user, viewer]
   *                 default: user
   *     responses:
   *       201:
   *         description: Invitation sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 invitation:
   *                   type: object
   *                 inviteUrl:
   *                   type: string
   *       400:
   *         description: User already exists or invitation pending
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Admin access required
   */
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
  
  /**
   * @openapi
   * /api/users/{id}:
   *   patch:
   *     summary: Update user
   *     description: Update user permissions or status (admin only)
   *     tags: [User Management]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               permissions:
   *                 type: string
   *                 enum: [admin, user, viewer]
   *               status:
   *                 type: string
   *                 enum: [active, inactive]
   *     responses:
   *       200:
   *         description: User updated successfully
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Admin access required or different organization
   *       404:
   *         description: User not found
   */
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
  /**
   * @openapi
   * /api/users/invitations:
   *   get:
   *     summary: Get user invitations
   *     description: List all pending user invitations for organization
   *     tags: [Users]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: List of invitations
   *       401:
   *         description: Not authenticated
   */
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
  /**
   * @openapi
   * /api/users/invitations/accept:
   *   post:
   *     summary: Accept user invitation
   *     description: Accept invitation using token from email and complete registration
   *     tags: [Users]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [token, password]
   *             properties:
   *               token:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Invitation accepted and user registered
   *       400:
   *         description: Invalid or expired token
   */
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
  /**
   * @openapi
   * /api/organization:
   *   get:
   *     summary: Get organization details
   *     description: Retrieve details of user's organization (health system or vendor)
   *     tags: [Users]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Organization details
   *       401:
   *         description: Not authenticated
   */
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
  /**
   * @openapi
   * /api/organization:
   *   patch:
   *     summary: Update organization
   *     description: Update organization details (name, location, etc)
   *     tags: [Users]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Organization updated
   *       401:
   *         description: Not authenticated
   */
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
  /**
   * @openapi
   * /api/system-health:
   *   get:
   *     summary: Get system health status
   *     description: Platform health metrics and status indicators
   *     tags: [System]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: System health status
   *       401:
   *         description: Not authenticated
   */
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
  
  /**
   * @openapi
   * /api/audit-logs:
   *   get:
   *     summary: Get audit logs
   *     description: Retrieve audit logs for organization (admin only)
   *     tags: [Audit Logs]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: query
   *         name: action
   *         schema:
   *           type: string
   *         description: Filter by action type
   *       - in: query
   *         name: resourceType
   *         schema:
   *           type: string
   *         description: Filter by resource type
   *       - in: query
   *         name: userId
   *         schema:
   *           type: string
   *         description: Filter by user ID
   *     responses:
   *       200:
   *         description: List of audit logs
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                   userId:
   *                     type: string
   *                   action:
   *                     type: string
   *                   resourceType:
   *                     type: string
   *                   resourceId:
   *                     type: string
   *                   timestamp:
   *                     type: string
   *                     format: date-time
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Admin access required
   */
  /**
   * @openapi
   * /api/audit-logs:
   *   get:
   *     summary: Get audit logs
   *     description: Retrieve comprehensive activity audit trail
   *     tags: [Audit Logs]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Audit logs list
   *       401:
   *         description: Not authenticated
   */
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
  /**
   * @openapi
   * /api/users/invitations/{id}:
   *   delete:
   *     summary: Cancel user invitation
   *     description: Delete a pending invitation
   *     tags: [Users]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Invitation cancelled
   *       401:
   *         description: Not authenticated
   */
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
  /**
   * @openapi
   * /api/current-health-system:
   *   get:
   *     summary: Get current health system context
   *     description: Retrieve health system info for current user session
   *     tags: [Health Systems]
   *     responses:
   *       200:
   *         description: Health system details
   */
  app.get("/api/current-health-system", async (req, res) => {
    res.json({ id: DEMO_HEALTH_SYSTEM_ID });
  });

  // Get current vendor ID (for demo purposes)
  /**
   * @openapi
   * /api/current-vendor:
   *   get:
   *     summary: Get current vendor context
   *     description: Retrieve vendor info for current user session
   *     tags: [Vendors]
   *     responses:
   *       200:
   *         description: Vendor details
   */
  app.get("/api/current-vendor", async (req, res) => {
    res.json({ id: DEMO_VENDOR_VIZAI_ID });
  });
  
  /**
   * @openapi
   * /api/health-systems/{id}:
   *   get:
   *     summary: Get health system by ID
   *     description: Retrieve health system details
   *     tags: [Health Systems]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Health system ID
   *     responses:
   *       200:
   *         description: Health system details
   *       404:
   *         description: Health system not found
   */
  app.get("/api/health-systems/:id", async (req, res) => {
    const healthSystem = await storage.getHealthSystem(req.params.id);
    if (!healthSystem) {
      return res.status(404).json({ error: "Health system not found" });
    }
    res.json(healthSystem);
  });

  /**
   * @openapi
   * /api/health-systems:
   *   post:
   *     summary: Create health system
   *     description: Register new healthcare organization
   *     tags: [Health Systems]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name:
   *                 type: string
   *               type:
   *                 type: string
   *     responses:
   *       201:
   *         description: Health system created
   *       400:
   *         description: Invalid data
   */
  app.post("/api/health-systems", async (req, res) => {
    try {
      const data = insertHealthSystemSchema.parse(req.body);
      const healthSystem = await storage.createHealthSystem(data);
      res.status(201).json(healthSystem);
    } catch (error) {
      res.status(400).json({ error: "Invalid health system data" });
    }
  });

  /**
   * @openapi
   * /api/vendors/public:
   *   get:
   *     summary: Get public vendor directory
   *     description: List all verified vendors in public directory (no authentication required)
   *     tags: [Vendors]
   *     responses:
   *       200:
   *         description: List of verified vendors
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                   name:
   *                     type: string
   *                   verified:
   *                     type: boolean
   */
  app.get("/api/vendors/public", async (req: Request, res: Response) => {
    try {
      const vendors = await storage.getPublicVendors();
      res.json(vendors);
    } catch (error: any) {
      logger.error({ err: error }, "Error fetching public vendors");
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  /**
   * @openapi
   * /api/ai-systems:
   *   get:
   *     summary: List AI systems
   *     description: Get all AI systems for authenticated health system
   *     tags: [AI Systems]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: List of AI systems
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/AISystem'
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied (health system only)
   */
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

  /**
   * @openapi
   * /api/ai-systems/{id}:
   *   get:
   *     summary: Get AI system by ID
   *     description: Retrieve detailed information for specific AI system
   *     tags: [AI Systems]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: AI system ID
   *     responses:
   *       200:
   *         description: AI system details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AISystem'
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied
   *       404:
   *         description: AI system not found
   */
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

  /**
   * @openapi
   * /api/ai-systems:
   *   post:
   *     summary: Create AI system
   *     description: Register new AI system in health system inventory
   *     tags: [AI Systems]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, department, riskLevel]
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               department:
   *                 type: string
   *               riskLevel:
   *                 type: string
   *                 enum: [low, medium, high, critical]
   *               vendorId:
   *                 type: string
   *     responses:
   *       201:
   *         description: AI system created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AISystem'
   *       400:
   *         description: Invalid data
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied (health system only)
   */
  app.post("/api/ai-systems", requireRole("health_system"), async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || !user.healthSystemId) {
        return res.status(403).json({ error: "No health system associated with this account" });
      }
      
      // ⚡ USAGE METERING: Enforce tier limits
      const { stripeBillingService } = await import("./services/stripe-billing");
      const usageCheck = await stripeBillingService.canAddAISystem(user.healthSystemId);
      
      if (!usageCheck.allowed) {
        return res.status(402).json({ 
          error: "Tier limit reached",
          message: usageCheck.message,
          current: usageCheck.current,
          limit: usageCheck.limit,
          upgradeRequired: true 
        });
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

  /**
   * @openapi
   * /api/ai-systems/{id}:
   *   patch:
   *     summary: Update AI system
   *     description: Modify AI system properties
   *     tags: [AI Systems]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: AI system ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               riskLevel:
   *                 type: string
   *                 enum: [low, medium, high, critical]
   *               status:
   *                 type: string
   *     responses:
   *       200:
   *         description: AI system updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AISystem'
   *       400:
   *         description: Invalid data
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied
   *       404:
   *         description: AI system not found
   */
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

  /**
   * @openapi
   * /api/ai-systems/{id}:
   *   delete:
   *     summary: Delete AI system
   *     description: Remove AI system from inventory
   *     tags: [AI Systems]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: AI system ID
   *     responses:
   *       204:
   *         description: AI system deleted
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied
   *       404:
   *         description: AI system not found
   */
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

  /**
   * @openapi
   * /api/alerts:
   *   get:
   *     summary: List unresolved alerts
   *     description: Get all unresolved monitoring alerts for health system
   *     tags: [Alerts]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: List of unresolved alerts
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Alert'
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied (health system only)
   */
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

  /**
   * @openapi
   * /api/alerts:
   *   post:
   *     summary: Create alert
   *     description: Create new monitoring alert for AI system
   *     tags: [Alerts]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [aiSystemId, severity, type, message]
   *             properties:
   *               aiSystemId:
   *                 type: string
   *               severity:
   *                 type: string
   *                 enum: [low, medium, high, critical]
   *               type:
   *                 type: string
   *               message:
   *                 type: string
   *     responses:
   *       201:
   *         description: Alert created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Alert'
   *       400:
   *         description: Invalid data
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied
   *       404:
   *         description: AI system not found
   */
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

  /**
   * @openapi
   * /api/alerts/{id}/resolve:
   *   patch:
   *     summary: Resolve alert
   *     description: Mark monitoring alert as resolved
   *     tags: [Alerts]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Alert ID
   *     responses:
   *       204:
   *         description: Alert resolved successfully
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied
   *       404:
   *         description: Alert not found
   */
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
  /**
   * @openapi
   * /api/health-systems/{healthSystemId}/predictive-alerts:
   *   get:
   *     summary: Get predictive alerts
   *     description: List ML-generated predictive alerts for health system
   *     tags: [Alerts]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: healthSystemId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of predictive alerts
   *       401:
   *         description: Not authenticated
   */
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

  /**
   * @openapi
   * /api/health-systems/{healthSystemId}/predictive-alerts/generate:
   *   post:
   *     summary: Generate predictive alerts
   *     description: Trigger ML-based predictive alert generation for AI systems
   *     tags: [Alerts]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: healthSystemId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Alerts generated
   *       401:
   *         description: Not authenticated
   */
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

  /**
   * @openapi
   * /api/predictive-alerts/{alertId}/dismiss:
   *   patch:
   *     summary: Dismiss predictive alert
   *     description: Mark predictive alert as dismissed with reason
   *     tags: [Alerts]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: alertId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               reason:
   *                 type: string
   *     responses:
   *       200:
   *         description: Alert dismissed
   *       401:
   *         description: Not authenticated
   */
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

  /**
   * @openapi
   * /api/vendors:
   *   get:
   *     summary: List all vendors
   *     description: Get list of all AI vendors in the platform
   *     tags: [Vendors]
   *     responses:
   *       200:
   *         description: List of vendors
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                   name:
   *                     type: string
   *                   verified:
   *                     type: boolean
   *                   description:
   *                     type: string
   */
  app.get("/api/vendors", async (req, res) => {
    const vendors = await storage.getVendors();
    res.json(vendors);
  });

  /**
   * @openapi
   * /api/vendors/{id}:
   *   get:
   *     summary: Get vendor by ID
   *     description: Retrieve detailed vendor information
   *     tags: [Vendors]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Vendor ID
   *     responses:
   *       200:
   *         description: Vendor details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                 name:
   *                   type: string
   *                 verified:
   *                   type: boolean
   *       401:
   *         description: Not authenticated
   *       404:
   *         description: Vendor not found
   */
  app.get("/api/vendors/:id", requireAuth, async (req, res) => {
    const vendor = await storage.getVendor(req.params.id);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    res.json(vendor);
  });

  /**
   * @openapi
   * /api/vendors:
   *   post:
   *     summary: Create vendor
   *     description: Register new AI vendor organization
   *     tags: [Vendors]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name:
   *                 type: string
   *               website:
   *                 type: string
   *     responses:
   *       201:
   *         description: Vendor created
   *       400:
   *         description: Invalid data
   */
  app.post("/api/vendors", async (req, res) => {
    try {
      const data = insertVendorSchema.parse(req.body);
      const vendor = await storage.createVendor(data);
      res.status(201).json(vendor);
    } catch (error) {
      res.status(400).json({ error: "Invalid vendor data" });
    }
  });

  /**
   * @openapi
   * /api/vendors/{vendorId}/analytics:
   *   get:
   *     summary: Get vendor analytics dashboard
   *     description: Retrieve comprehensive analytics for vendor (certifications, AI systems, deployments, compliance)
   *     tags: [Vendors]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: vendorId
   *         required: true
   *         schema:
   *           type: string
   *         description: Vendor ID
   *     responses:
   *       200:
   *         description: Vendor analytics data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 certificationApplications:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: integer
   *                     pending:
   *                       type: integer
   *                     approved:
   *                       type: integer
   *                 aiSystems:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: integer
   *                     averageComplianceRate:
   *                       type: number
   *                 deployments:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: integer
   *                     active:
   *                       type: integer
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Vendor only, own data only
   */
  /**
   * @openapi
   * /api/vendors/{vendorId}/analytics:
   *   get:
   *     summary: Get vendor analytics
   *     description: Comprehensive analytics dashboard for AI vendor (customer insights, marketplace metrics, performance trends)
   *     tags: [Vendors]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: vendorId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Vendor analytics data
   *       401:
   *         description: Not authenticated
   */
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

  /**
   * @openapi
   * /api/deployments:
   *   get:
   *     summary: List deployments
   *     description: Get AI system deployments for vendor or health system
   *     tags: [Deployments]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: List of deployments
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                   vendorId:
   *                     type: string
   *                   healthSystemId:
   *                     type: string
   *                   status:
   *                     type: string
   *                   deploymentDate:
   *                     type: string
   *                     format: date-time
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied
   */
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

  /**
   * @openapi
   * /api/deployments:
   *   post:
   *     summary: Create deployment
   *     description: Record AI system deployment at health system
   *     tags: [Deployments]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [aiSystemId]
   *             properties:
   *               aiSystemId:
   *                 type: string
   *               vendorId:
   *                 type: string
   *                 description: Required if user is health system
   *               healthSystemId:
   *                 type: string
   *                 description: Required if user is vendor
   *               status:
   *                 type: string
   *                 enum: [active, inactive, decommissioned]
   *     responses:
   *       201:
   *         description: Deployment created
   *       400:
   *         description: Invalid data
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied
   */
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

  /**
   * @openapi
   * /api/certifications:
   *   get:
   *     summary: List certifications
   *     description: Get all compliance certifications for vendor
   *     tags: [Certifications]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: List of certifications
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                   vendorId:
   *                     type: string
   *                   framework:
   *                     type: string
   *                   status:
   *                     type: string
   *                   expiryDate:
   *                     type: string
   *                     format: date-time
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied (vendor only)
   */
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

  /**
   * @openapi
   * /api/certifications:
   *   post:
   *     summary: Create certification
   *     description: Add new compliance certification for vendor
   *     tags: [Certifications]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [framework, status]
   *             properties:
   *               framework:
   *                 type: string
   *                 description: Compliance framework (HIPAA, SOC2, etc)
   *               status:
   *                 type: string
   *                 enum: [active, expired, pending]
   *               expiryDate:
   *                 type: string
   *                 format: date-time
   *     responses:
   *       201:
   *         description: Certification created
   *       400:
   *         description: Invalid data
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied (vendor only)
   */
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

  /**
   * @openapi
   * /api/vendors/{vendorId}/certifications/apply:
   *   post:
   *     summary: Apply for vendor certification
   *     description: Submit certification application for automated testing workflow (vendor only)
   *     tags: [Certifications]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: vendorId
   *         required: true
   *         schema:
   *           type: string
   *         description: Vendor ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [tierRequested]
   *             properties:
   *               tierRequested:
   *                 type: string
   *                 enum: [Silver, Gold, Platinum]
   *               documentationUrls:
   *                 type: array
   *                 items:
   *                   type: string
   *               complianceStatements:
   *                 type: object
   *     responses:
   *       201:
   *         description: Application submitted, automated testing queued
   *       400:
   *         description: Invalid tier or data
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Vendor only
   */
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

  /**
   * @openapi
   * /api/vendors/{vendorId}/certifications/applications:
   *   get:
   *     summary: List certification applications
   *     description: Get all certification applications for vendor (vendors see own, health systems see all)
   *     tags: [Certifications]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: vendorId
   *         required: true
   *         schema:
   *           type: string
   *         description: Vendor ID
   *     responses:
   *       200:
   *         description: List of certification applications
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                   tierRequested:
   *                     type: string
   *                   status:
   *                     type: string
   *                     enum: [pending, under_review, approved, rejected]
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied
   */
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

  /**
   * @openapi
   * /api/vendors/{vendorId}/certifications/applications/{id}/review:
   *   patch:
   *     summary: Review certification application
   *     description: Approve or reject vendor certification application (health system only)
   *     tags: [Certifications]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: vendorId
   *         required: true
   *         schema:
   *           type: string
   *         description: Vendor ID
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Application ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [approved, rejected]
   *               rejectionReason:
   *                 type: string
   *                 description: Required if status is rejected
   *               notes:
   *                 type: string
   *     responses:
   *       200:
   *         description: Application reviewed successfully
   *       400:
   *         description: Invalid status or missing rejection reason
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Health system access required
   *       404:
   *         description: Application not found
   */
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

  // ===== Healthcare-Specific Scoring Routes (A- Grade Transformation) =====

  // Get comprehensive healthcare portfolio score (PHI + Clinical + Regulatory + Operational)
  app.get("/api/health-systems/:id/analytics/healthcare-score", requireRole("health_system"), async (req, res) => {
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
      
      const { calculateHealthcarePortfolioScore } = await import("./services/analytics-healthcare-scoring");
      const score = await calculateHealthcarePortfolioScore(healthSystemId);
      
      res.json(score);
    } catch (error) {
      logger.error({ err: error }, "Healthcare score error");
      res.status(500).json({ error: "Failed to calculate healthcare portfolio score" });
    }
  });

  // Get response time metrics (for "2-minute rollback" claims)
  app.get("/api/health-systems/:id/analytics/response-times", requireRole("health_system"), async (req, res) => {
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
      
      const { getResponseTimeMetrics } = await import("./services/analytics-healthcare-scoring");
      const metrics = await getResponseTimeMetrics(healthSystemId);
      
      res.json(metrics);
    } catch (error) {
      logger.error({ err: error }, "Response time metrics error");
      res.status(500).json({ error: "Failed to calculate response time metrics" });
    }
  });

  // Get scoring pipeline health monitoring (M&A acquisition readiness)
  app.get("/api/health-systems/:id/analytics/scoring-health", requireRole("health_system"), async (req, res) => {
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
      
      const { checkPortfolioScoringHealth } = await import("./services/monitoring/scoring-health");
      const health = await checkPortfolioScoringHealth(healthSystemId);
      
      res.json(health);
    } catch (error) {
      logger.error({ err: error }, "Scoring health monitoring error");
      res.status(500).json({ error: "Failed to check scoring pipeline health" });
    }
  });

  // Get PHI risk score breakdown for individual AI system
  app.get("/api/ai-systems/:id/scoring/phi-risk", requireAuth, async (req, res) => {
    try {
      const { id: aiSystemId } = req.params;
      
      // Verify access
      const system = await storage.getAISystem(aiSystemId);
      if (!system) {
        return res.status(404).json({ error: "AI system not found" });
      }
      
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || user.healthSystemId !== system.healthSystemId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { calculateComprehensivePHIRisk } = await import("./services/scoring/phi-risk-scoring");
      const phiRisk = await calculateComprehensivePHIRisk(aiSystemId);
      
      res.json(phiRisk);
    } catch (error) {
      logger.error({ err: error }, "PHI risk scoring error");
      res.status(500).json({ error: "Failed to calculate PHI risk score" });
    }
  });

  // Get clinical safety score breakdown for individual AI system
  app.get("/api/ai-systems/:id/scoring/clinical-safety", requireAuth, async (req, res) => {
    try {
      const { id: aiSystemId } = req.params;
      
      // Verify access
      const system = await storage.getAISystem(aiSystemId);
      if (!system) {
        return res.status(404).json({ error: "AI system not found" });
      }
      
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || user.healthSystemId !== system.healthSystemId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { calculateClinicalSafetyScore } = await import("./services/scoring/clinical-safety-scoring");
      const clinicalSafety = await calculateClinicalSafetyScore(aiSystemId);
      
      res.json(clinicalSafety);
    } catch (error) {
      logger.error({ err: error }, "Clinical safety scoring error");
      res.status(500).json({ error: "Failed to calculate clinical safety score" });
    }
  });

  // Get framework-specific compliance breakdown for individual AI system
  app.get("/api/ai-systems/:id/scoring/compliance-breakdown", requireAuth, async (req, res) => {
    try {
      const { id: aiSystemId } = req.params;
      
      // Verify access
      const system = await storage.getAISystem(aiSystemId);
      if (!system) {
        return res.status(404).json({ error: "AI system not found" });
      }
      
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || user.healthSystemId !== system.healthSystemId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { calculateComplianceBreakdown } = await import("./services/scoring/framework-compliance-scoring");
      const compliance = await calculateComplianceBreakdown(aiSystemId);
      
      res.json(compliance);
    } catch (error) {
      logger.error({ err: error }, "Compliance breakdown error");
      res.status(500).json({ error: "Failed to calculate compliance breakdown" });
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

  // ===== Compliance Control Versioning API =====

  /**
   * @openapi
   * /api/compliance-controls/{controlId}/versions:
   *   get:
   *     summary: Get control version history
   *     description: Retrieve version history for a compliance control
   *     tags: [Compliance]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: controlId
   *         required: true
   *         schema:
   *           type: string
   *         description: Compliance control ID
   *     responses:
   *       200:
   *         description: Version history
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   version:
   *                     type: string
   *                   createdAt:
   *                     type: string
   *                     format: date-time
   *                   changes:
   *                     type: object
   *       401:
   *         description: Not authenticated
   */
  app.get("/api/compliance-controls/:controlId/versions", requireAuth, async (req, res) => {
    try {
      const { controlId } = req.params;
      const { controlVersioningService } = await import("./services/compliance-control-versioning");
      
      const history = await controlVersioningService.getVersionHistory(controlId);
      res.json(history);
    } catch (error) {
      logger.error({ err: error }, "Get control version history error");
      res.status(500).json({ error: "Failed to fetch version history" });
    }
  });

  // Get current version for a control
  app.get("/api/compliance-controls/:controlId/current-version", requireAuth, async (req, res) => {
    try {
      const { controlId} = req.params;
      const { controlVersioningService } = await import("./services/compliance-control-versioning");
      
      const currentVersion = await controlVersioningService.getCurrentVersion(controlId);
      if (!currentVersion) {
        return res.status(404).json({ error: "No version found for this control" });
      }
      
      res.json({ controlId, version: currentVersion });
    } catch (error) {
      logger.error({ err: error }, "Get current version error");
      res.status(500).json({ error: "Failed to fetch current version" });
    }
  });

  /**
   * @openapi
   * /api/compliance-controls/{controlId}/versions:
   *   post:
   *     summary: Create control version
   *     description: Create new version for compliance control (admin only)
   *     tags: [Compliance]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: controlId
   *         required: true
   *         schema:
   *           type: string
   *         description: Compliance control ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [versionType, changes]
   *             properties:
   *               versionType:
   *                 type: string
   *                 enum: [major, minor, patch]
   *               changes:
   *                 type: object
   *                 properties:
   *                   added:
   *                     type: array
   *                     items:
   *                       type: string
   *                   removed:
   *                     type: array
   *                     items:
   *                       type: string
   *                   reason:
   *                     type: string
   *     responses:
   *       201:
   *         description: Version created successfully
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Admin access required
   */
  app.post("/api/compliance-controls/:controlId/versions", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser || currentUser.permissions !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { controlId } = req.params;
      const schema = z.object({
        versionType: z.enum(['major', 'minor', 'patch']),
        changes: z.object({
          added: z.array(z.string()).optional(),
          removed: z.array(z.string()).optional(),
          modified: z.array(z.object({
            field: z.string(),
            oldValue: z.any(),
            newValue: z.any(),
          })).optional(),
          reason: z.string().optional(),
        }),
        effectiveDate: z.string().optional(),
      });

      const data = schema.parse(req.body);
      const { controlVersioningService } = await import("./services/compliance-control-versioning");

      const version = await controlVersioningService.createVersion(
        controlId,
        data.versionType,
        data.changes,
        data.effectiveDate ? new Date(data.effectiveDate) : undefined
      );

      // Create audit log
      await storage.createAuditLog({
        userId: currentUser.id,
        action: 'create_control_version',
        resourceType: 'compliance_control_version',
        resourceId: version.id,
        resourceName: `${controlId} v${version.version}`,
        metadata: { versionType: data.versionType, changes: data.changes },
        healthSystemId: currentUser.healthSystemId,
        vendorId: currentUser.vendorId,
      });

      res.status(201).json(version);
    } catch (error) {
      logger.error({ err: error }, "Create control version error");
      res.status(400).json({ error: "Failed to create version" });
    }
  });

  // Get versioning statistics (admin only)
  app.get("/api/compliance-controls/versions/stats", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser || currentUser.permissions !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { controlVersioningService } = await import("./services/compliance-control-versioning");
      const stats = await controlVersioningService.getVersionStats();
      
      res.json(stats);
    } catch (error) {
      logger.error({ err: error }, "Get version stats error");
      res.status(500).json({ error: "Failed to fetch version statistics" });
    }
  });

  // Initialize versions for all controls (admin only, one-time operation)
  app.post("/api/compliance-controls/versions/initialize", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser || currentUser.permissions !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { controlVersioningService } = await import("./services/compliance-control-versioning");
      await controlVersioningService.initializeAllControlVersions();
      
      // Create audit log
      await storage.createAuditLog({
        userId: currentUser.id,
        action: 'initialize_control_versions',
        resourceType: 'compliance_control_version',
        resourceId: 'all',
        resourceName: 'All compliance controls',
        metadata: {},
        healthSystemId: currentUser.healthSystemId,
        vendorId: currentUser.vendorId,
      });

      res.json({ message: "Control versions initialized successfully" });
    } catch (error) {
      logger.error({ err: error }, "Initialize control versions error");
      res.status(500).json({ error: "Failed to initialize control versions" });
    }
  });

  // ===== Bias Testing API (Phase 3.3) =====

  /**
   * @openapi
   * /api/bias-testing/analyze:
   *   post:
   *     summary: Analyze model fairness using Fairlearn
   *     description: Run comprehensive bias analysis across demographic groups using Fairlearn library
   *     tags: [Certifications]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [predictions, groundTruth, sensitiveFeatures]
   *             properties:
   *               predictions:
   *                 type: array
   *                 items:
   *                   type: number
   *                 description: Model predictions
   *               groundTruth:
   *                 type: array
   *                 items:
   *                   type: number
   *                 description: True labels
   *               sensitiveFeatures:
   *                 type: object
   *                 description: Protected demographic attributes by group
   *               threshold:
   *                 type: number
   *                 description: Fairness threshold (default 0.8)
   *     responses:
   *       200:
   *         description: Bias analysis results with violations
   *       401:
   *         description: Not authenticated
   */
  app.post("/api/bias-testing/analyze", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        predictions: z.array(z.number()),
        groundTruth: z.array(z.number()),
        sensitiveFeatures: z.record(z.array(z.any())),
        threshold: z.number().min(0).max(1).optional(),
      });

      const body = schema.parse(req.body);
      const { biasTestingService } = await import("./services/bias-testing");

      const result = await biasTestingService.analyzeBias(
        body.predictions,
        body.groundTruth,
        body.sensitiveFeatures,
        { threshold: body.threshold }
      );

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "bias_analysis",
        resourceType: "bias_test",
        resourceId: null,
        metadata: {
          bias_detected: result.bias_detected,
          violations_count: result.violations.length,
        },
      });

      res.json(result);
    } catch (error: any) {
      logger.error({ error }, "Failed to analyze bias");
      res.status(400).json({ error: "Failed to analyze bias" });
    }
  });

  /**
   * @openapi
   * /api/bias-testing/disparate-impact:
   *   post:
   *     summary: Calculate disparate impact ratio
   *     description: Calculate the 80% rule (4/5ths rule) for fairness compliance
   *     tags: [Certifications]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [predictions, sensitiveFeature, privilegedGroup]
   *             properties:
   *               predictions:
   *                 type: array
   *                 items:
   *                   type: number
   *               sensitiveFeature:
   *                 type: array
   *               privilegedGroup:
   *                 type: any
   *     responses:
   *       200:
   *         description: Disparate impact ratio and pass/fail status
   *       401:
   *         description: Not authenticated
   */
  app.post("/api/bias-testing/disparate-impact", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        predictions: z.array(z.number()),
        sensitiveFeature: z.array(z.any()),
        privilegedGroup: z.any(),
      });

      const body = schema.parse(req.body);
      const { biasTestingService } = await import("./services/bias-testing");

      const result = await biasTestingService.calculateDisparateImpact(
        body.predictions,
        body.sensitiveFeature,
        body.privilegedGroup
      );

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "disparate_impact_test",
        resourceType: "bias_test",
        resourceId: null,
        metadata: {
          bias_detected: result.bias_detected,
          disparate_impact_ratio: result.disparate_impact_ratio,
        },
      });

      res.json(result);
    } catch (error: any) {
      logger.error({ error }, "Failed to calculate disparate impact");
      res.status(400).json({ error: "Failed to calculate disparate impact" });
    }
  });

  /**
   * @openapi
   * /api/ai-systems/{aiSystemId}/test-bias:
   *   post:
   *     summary: Test AI system for bias
   *     description: Run Fairlearn bias detection on AI system predictions
   *     tags: [Advanced Certification]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: aiSystemId
   *         required: true
   *         schema:
   *           type: string
   *         description: AI system ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [predictions, groundTruth, sensitiveFeatures]
   *             properties:
   *               predictions:
   *                 type: array
   *                 items:
   *                   type: number
   *               groundTruth:
   *                 type: array
   *                 items:
   *                   type: number
   *               sensitiveFeatures:
   *                 type: object
   *                 additionalProperties:
   *                   type: array
   *               threshold:
   *                 type: number
   *                 minimum: 0
   *                 maximum: 1
   *     responses:
   *       200:
   *         description: Bias test results
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 bias_detected:
   *                   type: boolean
   *                 violations:
   *                   type: array
   *                   items:
   *                     type: object
   *                 overall_metrics:
   *                   type: object
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied
   *       404:
   *         description: AI system not found
   */
  app.post("/api/ai-systems/:aiSystemId/test-bias", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        predictions: z.array(z.number()),
        groundTruth: z.array(z.number()),
        sensitiveFeatures: z.record(z.array(z.any())),
        threshold: z.number().min(0).max(1).optional(),
      });

      const body = schema.parse(req.body);
      const { aiSystemId } = req.params;
      const { biasTestingService } = await import("./services/bias-testing");

      // Verify AI system exists and user has access
      const aiSystem = await storage.getAISystem(aiSystemId);
      if (!aiSystem) {
        return res.status(404).json({ error: "AI system not found" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (user?.role === "health_system" && aiSystem.healthSystemId !== user.healthSystemId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const result = await biasTestingService.testAISystemBias(
        aiSystemId,
        {
          predictions: body.predictions,
          groundTruth: body.groundTruth,
          sensitiveFeatures: body.sensitiveFeatures,
        },
        { threshold: body.threshold }
      );

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "ai_system_bias_test",
        resourceType: "ai_system",
        resourceId: aiSystemId,
        metadata: {
          bias_detected: result.bias_detected,
          violations_count: result.violations.length,
          overall_accuracy: result.overall_metrics.accuracy,
        },
      });

      res.json(result);
    } catch (error: any) {
      logger.error({ error }, "Failed to test AI system bias");
      res.status(400).json({ error: "Failed to test AI system bias" });
    }
  });

  // ===== PHI Detection API (Phase 3.1) =====

  /**
   * @openapi
   * /api/phi-detection/scan:
   *   post:
   *     summary: Scan text for PHI using Presidio
   *     description: Detect Protected Health Information (PHI) in text using Microsoft Presidio analyzer
   *     tags: [Certifications]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [text]
   *             properties:
   *               text:
   *                 type: string
   *                 description: Text to scan for PHI
   *               threshold:
   *                 type: number
   *                 minimum: 0
   *                 maximum: 1
   *                 description: Detection confidence threshold
   *     responses:
   *       200:
   *         description: PHI detection results
   *       401:
   *         description: Not authenticated
   */
  app.post("/api/phi-detection/scan", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        text: z.string(),
        threshold: z.number().min(0).max(1).optional(),
      });

      const data = schema.parse(req.body);
      const { phiDetectionService } = await import("./services/phi-detection");

      const result = await phiDetectionService.detectPHI(data.text, {
        threshold: data.threshold,
      });

      // Create audit log
      const currentUser = await storage.getUser(req.session.userId!);
      await storage.createAuditLog({
        userId: currentUser!.id,
        action: 'phi_detection_scan',
        resourceType: 'phi_detection',
        resourceId: 'scan',
        resourceName: `PHI scan (${result.phi_count} entities found)`,
        metadata: { has_phi: result.has_phi, phi_count: result.phi_count, risk_score: result.risk_score },
        healthSystemId: currentUser!.healthSystemId,
        vendorId: currentUser!.vendorId,
      });

      res.json(result);
    } catch (error) {
      logger.error({ err: error }, "PHI detection scan error");
      res.status(400).json({ error: "Failed to scan text for PHI" });
    }
  });

  /**
   * @openapi
   * /api/phi-detection/scan-batch:
   *   post:
   *     summary: Batch PHI detection
   *     description: Scan multiple texts for PHI in a single request
   *     tags: [Certifications]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [texts]
   *             properties:
   *               texts:
   *                 type: array
   *                 items:
   *                   type: string
   *               threshold:
   *                 type: number
   *                 minimum: 0
   *                 maximum: 1
   *     responses:
   *       200:
   *         description: Array of PHI detection results
   *       401:
   *         description: Not authenticated
   */
  app.post("/api/phi-detection/scan-batch", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        texts: z.array(z.string()),
        threshold: z.number().min(0).max(1).optional(),
      });

      const data = schema.parse(req.body);
      const { phiDetectionService } = await import("./services/phi-detection");

      const results = await phiDetectionService.detectPHIBatch(data.texts, {
        threshold: data.threshold,
      });

      const totalPHI = results.reduce((sum, r) => sum + r.phi_count, 0);
      const textsWithPHI = results.filter(r => r.has_phi).length;

      // Create audit log
      const currentUser = await storage.getUser(req.session.userId!);
      await storage.createAuditLog({
        userId: currentUser!.id,
        action: 'phi_detection_batch_scan',
        resourceType: 'phi_detection',
        resourceId: 'batch-scan',
        resourceName: `PHI batch scan (${data.texts.length} texts, ${totalPHI} entities)`,
        metadata: { batch_size: data.texts.length, total_phi: totalPHI, texts_with_phi: textsWithPHI },
        healthSystemId: currentUser!.healthSystemId,
        vendorId: currentUser!.vendorId,
      });

      res.json(results);
    } catch (error) {
      logger.error({ err: error }, "PHI detection batch scan error");
      res.status(400).json({ error: "Failed to scan texts for PHI" });
    }
  });

  /**
   * @openapi
   * /api/ai-systems/{aiSystemId}/scan-phi:
   *   post:
   *     summary: Scan AI output for PHI
   *     description: ML-based PHI detection using Microsoft Presidio to detect protected health information exposure
   *     tags: [Advanced Certification]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: aiSystemId
   *         required: true
   *         schema:
   *           type: string
   *         description: AI system ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [output]
   *             properties:
   *               output:
   *                 type: string
   *                 description: AI system output text to scan
   *     responses:
   *       200:
   *         description: PHI scan results
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 passed:
   *                   type: boolean
   *                 phi_detected:
   *                   type: boolean
   *                 details:
   *                   type: object
   *                   properties:
   *                     phi_count:
   *                       type: integer
   *                     risk_score:
   *                       type: number
   *                     entities:
   *                       type: array
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied
   *       404:
   *         description: AI system not found
   */
  app.post("/api/ai-systems/:aiSystemId/scan-phi", requireAuth, async (req, res) => {
    try {
      const { aiSystemId } = req.params;
      const schema = z.object({
        output: z.string(),
      });

      const data = schema.parse(req.body);

      // Verify access to AI system
      const aiSystem = await storage.getAISystem(aiSystemId);
      if (!aiSystem) {
        return res.status(404).json({ error: "AI system not found" });
      }

      const currentUser = await storage.getUser(req.session.userId!);
      if (currentUser!.healthSystemId !== aiSystem.healthSystemId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { phiDetectionService } = await import("./services/phi-detection");
      const scanResult = await phiDetectionService.scanAIOutput(aiSystemId, data.output);

      // Create audit log
      await storage.createAuditLog({
        userId: currentUser!.id,
        action: 'ai_system_phi_scan',
        resourceType: 'ai_system',
        resourceId: aiSystemId,
        resourceName: aiSystem.name,
        metadata: { 
          passed: scanResult.passed,
          phi_detected: scanResult.phi_detected,
          phi_count: scanResult.details.phi_count,
          risk_score: scanResult.details.risk_score
        },
        healthSystemId: currentUser!.healthSystemId,
        vendorId: currentUser!.vendorId,
      });

      res.json(scanResult);
    } catch (error) {
      logger.error({ err: error }, "AI system PHI scan error");
      res.status(400).json({ error: "Failed to scan AI output for PHI" });
    }
  });

  // ===== Re-Certification Automation API (Phase 3.6) =====

  /**
   * @openapi
   * /api/recertification/pending:
   *   get:
   *     summary: Get pending recertifications
   *     description: List AI systems due for quarterly re-certification
   *     tags: [Certifications]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: List of pending recertification schedules
   *       401:
   *         description: Not authenticated
   */
  app.get("/api/recertification/pending", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      const { recertificationScheduler } = await import("./services/certification/recertification-scheduler");

      const schedules = await recertificationScheduler.getPendingRecertifications(
        user!.healthSystemId || undefined
      );

      res.json(schedules);
    } catch (error: any) {
      logger.error({ error }, "Failed to get pending recertifications");
      res.status(500).json({ error: "Failed to fetch recertification schedules" });
    }
  });

  /**
   * @openapi
   * /api/recertification/execute/{aiSystemId}:
   *   post:
   *     summary: Execute re-certification for AI system
   *     description: Run complete certification workflow (PHI detection, bias testing, threat modeling) for quarterly re-certification
   *     tags: [Certifications]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: aiSystemId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Re-certification results
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied
   *       404:
   *         description: AI system not found
   */
  app.post("/api/recertification/execute/:aiSystemId", requireAuth, async (req, res) => {
    try {
      const { aiSystemId } = req.params;
      const user = await storage.getUser(req.session.userId!);

      // Verify access
      const aiSystem = await storage.getAISystem(aiSystemId);
      if (!aiSystem) {
        return res.status(404).json({ error: "AI system not found" });
      }

      if (user?.role === "health_system" && aiSystem.healthSystemId !== user.healthSystemId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { recertificationScheduler } = await import("./services/certification/recertification-scheduler");

      const workflow = await recertificationScheduler.executeRecertification(
        `manual-${Date.now()}`,
        aiSystemId
      );

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "recertification_executed",
        resourceType: "ai_system",
        resourceId: aiSystemId,
        metadata: {
          overall_pass: workflow.overall_pass,
          steps_completed: workflow.steps.length,
          findings_count: workflow.findings.length,
        },
      });

      res.json(workflow);
    } catch (error: any) {
      logger.error({ error }, "Failed to execute recertification");
      res.status(500).json({ error: "Failed to execute recertification" });
    }
  });

  /**
   * @openapi
   * /api/recertification/bulk-execute:
   *   post:
   *     summary: Bulk execute re-certifications
   *     description: Execute re-certification for all AI systems due for health system
   *     tags: [Certifications]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Bulk execution results
   *       400:
   *         description: Health system ID required
   *       401:
   *         description: Not authenticated
   */
  app.post("/api/recertification/bulk-execute", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      
      if (!user?.healthSystemId) {
        return res.status(400).json({ error: "Health system ID required" });
      }

      const { recertificationScheduler } = await import("./services/certification/recertification-scheduler");

      const workflows = await recertificationScheduler.executeBulkRecertifications(
        user.healthSystemId
      );

      const summary = recertificationScheduler.generateSummaryReport(workflows);

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "bulk_recertification_executed",
        resourceType: "health_system",
        resourceId: user.healthSystemId,
        metadata: summary,
      });

      res.json({
        workflows,
        summary,
      });
    } catch (error: any) {
      logger.error({ error }, "Failed to execute bulk recertification");
      res.status(500).json({ error: "Failed to execute bulk recertification" });
    }
  });

  // ===== Compliance Report Generator API (Phase 3.5) =====

  /**
   * @openapi
   * /api/compliance/generate-report:
   *   post:
   *     summary: Generate compliance report
   *     description: Generate comprehensive 20-40 page PDF compliance audit report
   *     tags: [Compliance]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [healthSystemId]
   *             properties:
   *               healthSystemId:
   *                 type: string
   *               frameworks:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Compliance frameworks to include (HIPAA, NIST AI RMF, etc)
   *               includeAIInventory:
   *                 type: boolean
   *               includeViolations:
   *                 type: boolean
   *               includeAuditEvidence:
   *                 type: boolean
   *               includeThreatModel:
   *                 type: boolean
   *               includeBiasAnalysis:
   *                 type: boolean
   *               timePeriodDays:
   *                 type: number
   *     responses:
   *       200:
   *         description: Report generated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 report_id:
   *                   type: string
   *                 page_count:
   *                   type: integer
   *                 frameworks_covered:
   *                   type: array
   *                   items:
   *                     type: string
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied
   */
  app.post("/api/compliance/generate-report", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        healthSystemId: z.string(),
        frameworks: z.array(z.string()).optional(),
        includeAIInventory: z.boolean().optional(),
        includeViolations: z.boolean().optional(),
        includeAuditEvidence: z.boolean().optional(),
        includeThreatModel: z.boolean().optional(),
        includeBiasAnalysis: z.boolean().optional(),
        timePeriodDays: z.number().optional(),
      });

      const body = schema.parse(req.body);
      const user = await storage.getUser(req.session.userId!);

      // Validate access to health system
      if (user?.role === "health_system" && user.healthSystemId !== body.healthSystemId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { complianceReportGenerator } = await import("./services/compliance-reporting/report-generator");

      const report = await complianceReportGenerator.generateReport(
        body,
        user!.email
      );

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "compliance_report_generated",
        resourceType: "compliance_report",
        resourceId: report.report_id,
        metadata: {
          page_count: report.page_count,
          frameworks: report.frameworks_covered,
        },
      });

      res.json(report);
    } catch (error: any) {
      logger.error({ error }, "Failed to generate compliance report");
      res.status(500).json({ error: "Failed to generate compliance report" });
    }
  });

  // ===== Threat Modeling API (Phase 3.4) =====

  /**
   * @openapi
   * /api/ai-systems/{aiSystemId}/threat-model:
   *   post:
   *     summary: Generate threat model
   *     description: STRIDE + LINDDUN threat modeling analysis for AI system security and privacy
   *     tags: [Advanced Certification]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: aiSystemId
   *         required: true
   *         schema:
   *           type: string
   *         description: AI system ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [deployment_environment, data_access, integration_points, user_roles]
   *             properties:
   *               deployment_environment:
   *                 type: string
   *               data_access:
   *                 type: array
   *                 items:
   *                   type: string
   *               integration_points:
   *                 type: array
   *                 items:
   *                   type: string
   *               user_roles:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Threat modeling analysis results
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total_threats:
   *                   type: integer
   *                 critical_count:
   *                   type: integer
   *                 risk_score:
   *                   type: number
   *                 threats:
   *                   type: array
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Access denied
   *       404:
   *         description: AI system not found
   */
  app.post("/api/ai-systems/:aiSystemId/threat-model", requireAuth, async (req, res) => {
    try {
      const { aiSystemId } = req.params;
      const schema = z.object({
        deployment_environment: z.string(),
        data_access: z.array(z.string()),
        integration_points: z.array(z.string()),
        user_roles: z.array(z.string()),
      });

      const body = schema.parse(req.body);

      // Verify AI system exists and user has access
      const aiSystem = await storage.getAISystem(aiSystemId);
      if (!aiSystem) {
        return res.status(404).json({ error: "AI system not found" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (user?.role === "health_system" && aiSystem.healthSystemId !== user.healthSystemId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { threatModelingService } = await import("./services/threat-modeling/stride-linddun");
      
      const result = await threatModelingService.analyzeAISystem(aiSystemId, {
        name: aiSystem.name,
        category: "clinical", // Default category
        deployment_environment: body.deployment_environment,
        data_access: body.data_access,
        integration_points: body.integration_points,
        phi_handling: aiSystem.riskLevel === "high" || aiSystem.riskLevel === "medium",
        user_roles: body.user_roles,
      });

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "threat_modeling_analysis",
        resourceType: "ai_system",
        resourceId: aiSystemId,
        metadata: {
          total_threats: result.total_threats,
          critical_count: result.critical_count,
          risk_score: result.risk_score,
        },
      });

      res.json(result);
    } catch (error: any) {
      logger.error({ error }, "Failed to perform threat modeling");
      res.status(400).json({ error: "Failed to perform threat modeling analysis" });
    }
  });

  // ===== Clinical Validation Dataset API (Phase 3.2) =====

  /**
   * @openapi
   * /api/validation-datasets:
   *   get:
   *     summary: List clinical validation datasets
   *     description: Get all clinical validation datasets, optionally filtered by category
   *     tags: [Clinical Validation]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *           enum: [radiology, pathology, cardiology, oncology, general, emergency, pediatrics]
   *         description: Filter by medical category
   *     responses:
   *       200:
   *         description: List of validation datasets
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                   name:
   *                     type: string
   *                   category:
   *                     type: string
   *                   testCases:
   *                     type: array
   *       401:
   *         description: Not authenticated
   */
  app.get("/api/validation-datasets", requireAuth, async (req, res) => {
    try {
      const { category } = req.query;
      const { clinicalDatasetLibrary } = await import("./services/clinical-validation/dataset-library");

      const datasets = category
        ? await clinicalDatasetLibrary.getDatasetsByCategory(String(category))
        : await clinicalDatasetLibrary.getActiveDatasets();

      res.json(datasets);
    } catch (error) {
      logger.error({ err: error }, "Get validation datasets error");
      res.status(500).json({ error: "Failed to fetch validation datasets" });
    }
  });

  /**
   * @openapi
   * /api/validation-datasets/{datasetId}:
   *   get:
   *     summary: Get validation dataset by ID
   *     description: Retrieve specific clinical validation dataset with test cases
   *     tags: [Clinical Validation]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: datasetId
   *         required: true
   *         schema:
   *           type: string
   *         description: Dataset ID
   *     responses:
   *       200:
   *         description: Validation dataset details
   *       401:
   *         description: Not authenticated
   *       404:
   *         description: Dataset not found
   */
  app.get("/api/validation-datasets/:datasetId", requireAuth, async (req, res) => {
    try {
      const { datasetId } = req.params;
      const { clinicalDatasetLibrary } = await import("./services/clinical-validation/dataset-library");

      const dataset = await clinicalDatasetLibrary.getDataset(datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      res.json(dataset);
    } catch (error) {
      logger.error({ err: error }, "Get validation dataset error");
      res.status(500).json({ error: "Failed to fetch validation dataset" });
    }
  });

  /**
   * @openapi
   * /api/validation-datasets:
   *   post:
   *     summary: Create validation dataset
   *     description: Create new clinical validation dataset with test cases (admin only)
   *     tags: [Clinical Validation]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, category, testCases]
   *             properties:
   *               name:
   *                 type: string
   *               category:
   *                 type: string
   *                 enum: [radiology, pathology, cardiology, oncology, general, emergency, pediatrics]
   *               description:
   *                 type: string
   *               testCases:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     input:
   *                       type: object
   *                     ground_truth:
   *                       type: object
   *               metadataSource:
   *                 type: string
   *     responses:
   *       201:
   *         description: Dataset created
   *       400:
   *         description: Invalid data
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Admin access required
   */
  app.post("/api/validation-datasets", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser || currentUser.permissions !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const schema = z.object({
        name: z.string(),
        category: z.enum(['radiology', 'pathology', 'cardiology', 'oncology', 'general', 'emergency', 'pediatrics']),
        description: z.string().optional(),
        testCases: z.array(z.object({
          input: z.any(),
          expected_output: z.any().optional(),
          ground_truth: z.any(),
          metadata: z.record(z.any()).optional(),
        })),
        metadataSource: z.string().optional(),
      });

      const data = schema.parse(req.body);
      const { clinicalDatasetLibrary } = await import("./services/clinical-validation/dataset-library");

      const dataset = await clinicalDatasetLibrary.createDataset(data);

      // Create audit log
      await storage.createAuditLog({
        userId: currentUser.id,
        action: 'create_validation_dataset',
        resourceType: 'validation_dataset',
        resourceId: dataset.id,
        resourceName: dataset.name,
        metadata: { category: dataset.category, testCases: dataset.testCases.length },
        healthSystemId: currentUser.healthSystemId,
        vendorId: currentUser.vendorId,
      });

      res.status(201).json(dataset);
    } catch (error) {
      logger.error({ err: error }, "Create validation dataset error");
      res.status(400).json({ error: "Failed to create validation dataset" });
    }
  });

  /**
   * @openapi
   * /api/validation-datasets/{datasetId}:
   *   patch:
   *     summary: Update validation dataset
   *     description: Update clinical validation dataset details or test cases (admin only)
   *     tags: [Clinical Validation]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: datasetId
   *         required: true
   *         schema:
   *           type: string
   *         description: Dataset ID
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               testCases:
   *                 type: array
   *               active:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Dataset updated successfully
   *       400:
   *         description: Invalid data
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Admin access required
   */
  app.patch("/api/validation-datasets/:datasetId", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser || currentUser.permissions !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { datasetId } = req.params;
      const schema = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        testCases: z.array(z.object({
          input: z.any(),
          expected_output: z.any().optional(),
          ground_truth: z.any(),
          metadata: z.record(z.any()).optional(),
        })).optional(),
        metadataSource: z.string().optional(),
        active: z.boolean().optional(),
      });

      const data = schema.parse(req.body);
      const { clinicalDatasetLibrary } = await import("./services/clinical-validation/dataset-library");

      const dataset = await clinicalDatasetLibrary.updateDataset(datasetId, data);

      // Create audit log
      await storage.createAuditLog({
        userId: currentUser.id,
        action: 'update_validation_dataset',
        resourceType: 'validation_dataset',
        resourceId: dataset.id,
        resourceName: dataset.name,
        metadata: data,
        healthSystemId: currentUser.healthSystemId,
        vendorId: currentUser.vendorId,
      });

      res.json(dataset);
    } catch (error) {
      logger.error({ err: error }, "Update validation dataset error");
      res.status(400).json({ error: "Failed to update validation dataset" });
    }
  });

  /**
   * @openapi
   * /api/validation-datasets/{datasetId}:
   *   delete:
   *     summary: Delete validation dataset
   *     description: Remove clinical validation dataset (admin only)
   *     tags: [Clinical Validation]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: datasetId
   *         required: true
   *         schema:
   *           type: string
   *         description: Dataset ID
   *     responses:
   *       204:
   *         description: Dataset deleted successfully
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Admin access required
   *       404:
   *         description: Dataset not found
   */
  app.delete("/api/validation-datasets/:datasetId", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser || currentUser.permissions !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { datasetId } = req.params;
      const { clinicalDatasetLibrary } = await import("./services/clinical-validation/dataset-library");

      const dataset = await clinicalDatasetLibrary.getDataset(datasetId);
      if (!dataset) {
        return res.status(404).json({ error: "Dataset not found" });
      }

      await clinicalDatasetLibrary.deleteDataset(datasetId);

      // Create audit log
      await storage.createAuditLog({
        userId: currentUser.id,
        action: 'delete_validation_dataset',
        resourceType: 'validation_dataset',
        resourceId: datasetId,
        resourceName: dataset.name,
        metadata: {},
        healthSystemId: currentUser.healthSystemId,
        vendorId: currentUser.vendorId,
      });

      res.json({ message: "Dataset deleted successfully" });
    } catch (error) {
      logger.error({ err: error }, "Delete validation dataset error");
      res.status(500).json({ error: "Failed to delete validation dataset" });
    }
  });

  // Initialize sample datasets (admin only, one-time operation)
  app.post("/api/validation-datasets/initialize-samples", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser || currentUser.permissions !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { clinicalDatasetLibrary } = await import("./services/clinical-validation/dataset-library");
      await clinicalDatasetLibrary.initializeSampleDatasets();

      // Create audit log
      await storage.createAuditLog({
        userId: currentUser.id,
        action: 'initialize_sample_datasets',
        resourceType: 'validation_dataset',
        resourceId: 'all',
        resourceName: 'Sample Clinical Datasets',
        metadata: {},
        healthSystemId: currentUser.healthSystemId,
        vendorId: currentUser.vendorId,
      });

      res.json({ message: "Sample datasets initialized successfully" });
    } catch (error) {
      logger.error({ err: error }, "Initialize sample datasets error");
      res.status(500).json({ error: "Failed to initialize sample datasets" });
    }
  });

  // ===== AI Monitoring Webhook Routes (Public) =====
  
  /**
   * @openapi
   * /api/webhooks/langsmith/{aiSystemId}:
   *   post:
   *     summary: LangSmith AI telemetry webhook
   *     description: Receive AI monitoring events from LangSmith (HMAC-SHA256 verified)
   *     tags: [Webhooks]
   *     parameters:
   *       - in: path
   *         name: aiSystemId
   *         required: true
   *         schema:
   *           type: string
   *         description: AI system ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: LangSmith telemetry payload
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *       400:
   *         description: Invalid payload or signature
   *       404:
   *         description: AI system not found
   *       429:
   *         description: Rate limit exceeded
   */
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

  /**
   * @openapi
   * /api/webhooks/arize/{aiSystemId}:
   *   post:
   *     summary: Arize AI model monitoring webhook
   *     description: Receive model drift, bias, and performance monitoring events (HMAC-SHA256 verified)
   *     tags: [Webhooks]
   *     parameters:
   *       - in: path
   *         name: aiSystemId
   *         required: true
   *         schema:
   *           type: string
   *         description: AI system ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: Arize monitoring payload
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *       400:
   *         description: Invalid payload or signature
   *       404:
   *         description: AI system not found
   *       429:
   *         description: Rate limit exceeded
   */
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

  /**
   * @openapi
   * /api/webhooks/langfuse/{aiSystemId}:
   *   post:
   *     summary: LangFuse AI observability webhook
   *     description: Receive trace, generation, and evaluation events from LangFuse (HMAC-SHA256 verified)
   *     tags: [Webhooks]
   *     parameters:
   *       - in: path
   *         name: aiSystemId
   *         required: true
   *         schema:
   *           type: string
   *         description: AI system ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: LangFuse observability payload
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *       400:
   *         description: Invalid payload or signature
   *       404:
   *         description: AI system not found
   *       429:
   *         description: Rate limit exceeded
   */
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

  /**
   * @openapi
   * /api/webhooks/wandb/{aiSystemId}:
   *   post:
   *     summary: Weights & Biases ML tracking webhook
   *     description: Receive ML experiment and training events from W&B (HMAC-SHA256 verified)
   *     tags: [Webhooks]
   *     parameters:
   *       - in: path
   *         name: aiSystemId
   *         required: true
   *         schema:
   *           type: string
   *         description: AI system ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: W&B training/alert payload
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *       400:
   *         description: Invalid payload or signature
   *       404:
   *         description: AI system not found
   *       429:
   *         description: Rate limit exceeded
   */
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

  /**
   * @openapi
   * /api/webhooks/pagerduty:
   *   post:
   *     summary: PagerDuty incident management webhook
   *     description: Receive incident alerts from PagerDuty (HMAC-SHA256 verified)
   *     tags: [Webhooks]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: PagerDuty incident payload
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *       400:
   *         description: Invalid payload or signature
   *       429:
   *         description: Rate limit exceeded
   */
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

  /**
   * @openapi
   * /api/webhooks/datadog:
   *   post:
   *     summary: DataDog infrastructure monitoring webhook
   *     description: Receive infrastructure alerts from DataDog (HMAC-SHA256 verified)
   *     tags: [Webhooks]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: DataDog monitor alert payload
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *       400:
   *         description: Invalid payload or signature
   *       429:
   *         description: Rate limit exceeded
   */
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

  /**
   * @openapi
   * /api/webhooks/twilio:
   *   post:
   *     summary: Twilio SMS delivery webhook
   *     description: Receive SMS delivery status callbacks from Twilio (HMAC-SHA256 verified)
   *     tags: [Webhooks]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: Twilio SMS status payload
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *       400:
   *         description: Invalid payload or signature
   *       429:
   *         description: Rate limit exceeded
   */
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

  /**
   * @openapi
   * /api/webhooks/slack:
   *   post:
   *     summary: Slack interactive events webhook
   *     description: Receive Slack events and interactive messages (HMAC-SHA256 verified)
   *     tags: [Webhooks]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: Slack event payload
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *       400:
   *         description: Invalid payload or signature
   *       429:
   *         description: Rate limit exceeded
   */
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

  /**
   * @openapi
   * /api/webhooks/epic/{aiSystemId}:
   *   post:
   *     summary: Epic EHR FHIR webhook
   *     description: Receive Epic FHIR resource subscription notifications for clinical data tracking (HMAC-SHA256 verified)
   *     tags: [Webhooks]
   *     parameters:
   *       - in: path
   *         name: aiSystemId
   *         required: true
   *         schema:
   *           type: string
   *         description: AI system ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: Epic FHIR payload
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *       400:
   *         description: Invalid payload or signature
   *       404:
   *         description: AI system not found
   *       429:
   *         description: Rate limit exceeded
   */
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

  /**
   * @openapi
   * /api/webhooks/cerner/{aiSystemId}:
   *   post:
   *     summary: Cerner EHR FHIR webhook
   *     description: Receive Cerner FHIR resource subscription notifications for clinical data tracking (HMAC-SHA256 verified)
   *     tags: [Webhooks]
   *     parameters:
   *       - in: path
   *         name: aiSystemId
   *         required: true
   *         schema:
   *           type: string
   *         description: AI system ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: Cerner FHIR payload
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *       400:
   *         description: Invalid payload or signature
   *       404:
   *         description: AI system not found
   *       429:
   *         description: Rate limit exceeded
   */
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
  // BILLING & INVOICE API
  // ==========================================

  // Generate monthly invoices (admin only - typically run via cron)
  app.post("/api/billing/invoices/generate-monthly", requireAuth, async (req, res) => {
    try {
      const { billingMonth } = req.body; // ISO date string for the billing month
      
      const { automatedInvoicingService } = await import("./services/billing/automated-invoicing");
      const month = billingMonth ? new Date(billingMonth) : new Date();
      
      const generatedInvoices = await automatedInvoicingService.generateMonthlyInvoices(month);
      
      res.json({
        success: true,
        month: month.toISOString(),
        generatedCount: generatedInvoices.length,
        invoices: generatedInvoices,
      });
    } catch (error) {
      logger.error({ err: error }, "Invoice generation error");
      res.status(500).json({ error: "Failed to generate invoices" });
    }
  });

  /**
   * @openapi
   * /api/billing/invoices:
   *   get:
   *     summary: Get billing invoices
   *     description: Retrieve all invoices for user's billing account
   *     tags: [Billing]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: List of invoices
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                   billingAccountId:
   *                     type: string
   *                   totalAmount:
   *                     type: integer
   *                     description: Amount in cents
   *                   status:
   *                     type: string
   *                     enum: [draft, open, paid, void, uncollectible]
   *                   dueDate:
   *                     type: string
   *                     format: date-time
   *       401:
   *         description: Not authenticated
   *       404:
   *         description: Billing account not found
   */
  app.get("/api/billing/invoices", requireAuth, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Determine billing account based on user role
      const tenantId = user.role === "health_system" ? user.healthSystemId : user.vendorId;
      if (!tenantId) {
        return res.status(400).json({ error: "No billing account associated with this user" });
      }
      
      // Find billing account for this tenant
      const billingAccount = await storage.getBillingAccountByTenant(tenantId, user.role);
      if (!billingAccount) {
        return res.status(404).json({ error: "Billing account not found" });
      }
      
      const { automatedInvoicingService } = await import("./services/billing/automated-invoicing");
      const invoices = await automatedInvoicingService.getInvoicesByBillingAccount(billingAccount.id);
      
      res.json(invoices);
    } catch (error) {
      logger.error({ err: error }, "Error fetching invoices");
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  /**
   * @openapi
   * /api/billing/invoices/upcoming:
   *   get:
   *     summary: Get upcoming invoice preview
   *     description: Preview next billing cycle invoice with line items
   *     tags: [Billing]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Upcoming invoice preview
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 estimatedTotal:
   *                   type: integer
   *                   description: Amount in cents
   *                 periodStart:
   *                   type: string
   *                   format: date-time
   *                 periodEnd:
   *                   type: string
   *                   format: date-time
   *                 lineItems:
   *                   type: array
   *       401:
   *         description: Not authenticated
   */
  app.get("/api/billing/invoices/upcoming", requireAuth, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const tenantId = user.role === "health_system" ? user.healthSystemId : user.vendorId;
      if (!tenantId) {
        return res.status(400).json({ error: "No billing account associated with this user" });
      }
      
      // Find active subscription
      const subscription = await storage.getActiveSubscriptionByTenant(tenantId);
      if (!subscription) {
        return res.status(404).json({ error: "No active subscription found" });
      }
      
      const { automatedInvoicingService } = await import("./services/billing/automated-invoicing");
      const preview = await automatedInvoicingService.getUpcomingInvoicePreview(subscription.id);
      
      res.json({
        subscription: {
          id: subscription.id,
          planTier: subscription.planTier,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
        preview,
      });
    } catch (error) {
      logger.error({ err: error }, "Error fetching upcoming invoice");
      res.status(500).json({ error: "Failed to fetch upcoming invoice" });
    }
  });

  // Finalize an invoice (change from draft to open)
  app.post("/api/billing/invoices/:id/finalize", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const { automatedInvoicingService } = await import("./services/billing/automated-invoicing");
      const invoice = await automatedInvoicingService.finalizeInvoice(id);
      
      res.json(invoice);
    } catch (error) {
      logger.error({ err: error }, "Error finalizing invoice");
      res.status(500).json({ error: "Failed to finalize invoice" });
    }
  });

  // Mark invoice as paid (typically called by Stripe webhook)
  app.post("/api/billing/invoices/:id/mark-paid", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentIntentId } = req.body;
      
      const { automatedInvoicingService } = await import("./services/billing/automated-invoicing");
      const invoice = await automatedInvoicingService.markInvoicePaid(id, paymentIntentId);
      
      res.json(invoice);
    } catch (error) {
      logger.error({ err: error }, "Error marking invoice as paid");
      res.status(500).json({ error: "Failed to mark invoice as paid" });
    }
  });

  // Void an invoice
  app.post("/api/billing/invoices/:id/void", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const { automatedInvoicingService } = await import("./services/billing/automated-invoicing");
      const invoice = await automatedInvoicingService.voidInvoice(id, reason);
      
      res.json(invoice);
    } catch (error) {
      logger.error({ err: error }, "Error voiding invoice");
      res.status(500).json({ error: "Failed to void invoice" });
    }
  });

  // Get overdue invoices (admin only)
  app.get("/api/billing/invoices/overdue", requireAuth, async (req, res) => {
    try {
      const { automatedInvoicingService } = await import("./services/billing/automated-invoicing");
      const overdueInvoices = await automatedInvoicingService.getOverdueInvoices();
      
      res.json(overdueInvoices);
    } catch (error) {
      logger.error({ err: error }, "Error fetching overdue invoices");
      res.status(500).json({ error: "Failed to fetch overdue invoices" });
    }
  });

  // ==========================================
  // SUBSCRIPTION MANAGEMENT
  // ==========================================

  /**
   * @openapi
   * /api/billing/subscription:
   *   get:
   *     summary: Get active subscription
   *     description: Retrieve active subscription for user's organization with billing details
   *     tags: [Billing]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Active subscription details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                 planTier:
   *                   type: string
   *                   enum: [starter, professional, enterprise]
   *                 status:
   *                   type: string
   *                   enum: [active, cancelled, past_due]
   *                 currentPeriodStart:
   *                   type: string
   *                   format: date-time
   *                 currentPeriodEnd:
   *                   type: string
   *                   format: date-time
   *                 cancelAtPeriodEnd:
   *                   type: boolean
   *       401:
   *         description: Not authenticated
   *       404:
   *         description: No active subscription found
   */
  app.get("/api/billing/subscription", requireAuth, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const tenantId = user.role === "health_system" ? user.healthSystemId : user.vendorId;
      if (!tenantId) {
        return res.status(403).json({ error: "No organization associated with this account" });
      }

      const subscription = await storage.getActiveSubscriptionByTenant(tenantId);
      if (!subscription) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      res.json(subscription);
    } catch (error) {
      logger.error({ err: error }, "Error fetching subscription");
      res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });

  /**
   * @openapi
   * /api/billing/subscriptions/{id}/cancel:
   *   post:
   *     summary: Cancel subscription
   *     description: Cancel subscription at end of current billing period
   *     tags: [Billing]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Subscription ID
   *     responses:
   *       200:
   *         description: Subscription cancelled successfully
   *       401:
   *         description: Not authenticated
   *       404:
   *         description: Subscription not found or access denied
   */
  app.post("/api/billing/subscriptions/:id/cancel", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Verify subscription ownership
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.id, id),
        with: {
          billingAccount: true,
        },
      });

      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      const tenantId = user.role === "health_system" ? user.healthSystemId : user.vendorId;
      const accountTenantId = subscription.billingAccount.healthSystemId || subscription.billingAccount.vendorId;

      if (tenantId !== accountTenantId) {
        logger.warn({ userId: user.id, subscriptionId: id, tenantId, accountTenantId }, "Unauthorized subscription access attempt");
        return res.status(404).json({ error: "Subscription not found" });
      }
      
      const [updated] = await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: true })
        .where(eq(subscriptions.id, id))
        .returning();

      logger.info({ subscriptionId: id }, "Subscription cancelled at period end");
      res.json(updated);
    } catch (error) {
      logger.error({ err: error }, "Error cancelling subscription");
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // Reactivate cancelled subscription
  app.post("/api/billing/subscriptions/:id/reactivate", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Verify subscription ownership
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.id, id),
        with: {
          billingAccount: true,
        },
      });

      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      const tenantId = user.role === "health_system" ? user.healthSystemId : user.vendorId;
      const accountTenantId = subscription.billingAccount.healthSystemId || subscription.billingAccount.vendorId;

      if (tenantId !== accountTenantId) {
        logger.warn({ userId: user.id, subscriptionId: id, tenantId, accountTenantId }, "Unauthorized subscription access attempt");
        return res.status(404).json({ error: "Subscription not found" });
      }
      
      const [updated] = await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: false })
        .where(eq(subscriptions.id, id))
        .returning();

      logger.info({ subscriptionId: id }, "Subscription reactivated");
      res.json(updated);
    } catch (error) {
      logger.error({ err: error }, "Error reactivating subscription");
      res.status(500).json({ error: "Failed to reactivate subscription" });
    }
  });

  // ==========================================
  // USAGE METERING
  // ==========================================

  // Get usage meters for subscription
  app.get("/api/billing/usage-meters", requireAuth, async (req, res) => {
    try {
      const { subscriptionId } = req.query;
      
      if (!subscriptionId || typeof subscriptionId !== 'string') {
        return res.status(400).json({ error: "subscriptionId is required" });
      }

      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Verify subscription ownership before accessing usage meters
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.id, subscriptionId),
        with: {
          billingAccount: true,
        },
      });

      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      const tenantId = user.role === "health_system" ? user.healthSystemId : user.vendorId;
      const accountTenantId = subscription.billingAccount.healthSystemId || subscription.billingAccount.vendorId;

      if (tenantId !== accountTenantId) {
        logger.warn({ userId: user.id, subscriptionId, tenantId, accountTenantId }, "Unauthorized usage meter access attempt");
        return res.status(403).json({ error: "Access denied: subscription belongs to different organization" });
      }

      const meters = await db
        .select()
        .from(usageMeters)
        .where(eq(usageMeters.subscriptionId, subscriptionId));

      res.json(meters);
    } catch (error) {
      logger.error({ err: error }, "Error fetching usage meters");
      res.status(500).json({ error: "Failed to fetch usage meters" });
    }
  });

  // Get usage events with aggregation
  app.get("/api/billing/usage-events", requireAuth, async (req, res) => {
    try {
      const { subscriptionId } = req.query;
      
      if (!subscriptionId || typeof subscriptionId !== 'string') {
        return res.status(400).json({ error: "subscriptionId is required" });
      }

      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Verify subscription ownership before accessing usage events
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.id, subscriptionId),
        with: {
          billingAccount: true,
        },
      });

      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      const tenantId = user.role === "health_system" ? user.healthSystemId : user.vendorId;
      const accountTenantId = subscription.billingAccount.healthSystemId || subscription.billingAccount.vendorId;

      if (tenantId !== accountTenantId) {
        logger.warn({ userId: user.id, subscriptionId, tenantId, accountTenantId }, "Unauthorized usage events access attempt");
        return res.status(403).json({ error: "Access denied: subscription belongs to different organization" });
      }

      const meters = await db
        .select()
        .from(usageMeters)
        .where(eq(usageMeters.subscriptionId, subscriptionId));

      const aggregations = await Promise.all(
        meters.map(async (meter) => {
          const events = await db
            .select()
            .from(usageEvents)
            .where(eq(usageEvents.meterId, meter.id))
            .orderBy(desc(usageEvents.timestamp));

          const totalUnits = events.reduce((sum, e) => sum + e.quantity, 0);
          const unitPrice = parseFloat(meter.unitPrice);
          const totalCost = totalUnits * unitPrice;

          return {
            meterId: meter.id,
            meterType: meter.meterType,
            totalUnits,
            unitPrice,
            totalCost,
            events,
          };
        })
      );

      res.json(aggregations);
    } catch (error) {
      logger.error({ err: error }, "Error fetching usage events");
      res.status(500).json({ error: "Failed to fetch usage events" });
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

  // 💰 ROI Metrics API Endpoints
  app.get("/api/roi-metrics", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let metrics;
      if (user.role === "health_system" && user.healthSystemId) {
        metrics = await storage.getROIMetricsByHealthSystem(user.healthSystemId);
      } else if (user.role === "vendor" && user.vendorId) {
        metrics = await storage.getROIMetricsByVendor(user.vendorId);
      } else {
        metrics = [];
      }

      res.json(metrics);
    } catch (error) {
      logger.error({ err: error }, "Failed to get ROI metrics");
      res.status(500).json({ error: "Failed to load ROI metrics" });
    }
  });

  app.post("/api/roi-metrics", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.healthSystemId && !user.vendorId) {
        return res.status(403).json({ error: "User must belong to a health system or vendor" });
      }

      const validationSchema = z.object({
        metricType: z.string(),
        metricCategory: z.string(),
        value: z.number().int(),
        unit: z.string(),
        description: z.string(),
        aiSystemId: z.string().optional(),
        certificationId: z.string().optional(),
        metadata: z.any().optional(),
      });

      const validated = validationSchema.parse(req.body);

      const metricData = {
        ...validated,
        healthSystemId: user.healthSystemId || null,
        vendorId: user.vendorId || null,
      };

      const metric = await storage.createROIMetric(metricData);
      res.status(201).json(metric);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error({ err: error }, "Failed to create ROI metric");
      res.status(500).json({ error: "Failed to create ROI metric" });
    }
  });

  // 🌐 Network Effects API Endpoints
  app.get("/api/network-metrics/latest", async (req: Request, res: Response) => {
    try {
      const { networkMetricsCalculator } = await import("./services/network-metrics-calculator");
      const snapshot = await networkMetricsCalculator.getLatestSnapshot();
      res.json(snapshot || {});
    } catch (error) {
      logger.error({ err: error }, "Failed to get network metrics");
      res.status(500).json({ error: "Failed to load network metrics" });
    }
  });

  app.get("/api/network-metrics/effects-score", async (req: Request, res: Response) => {
    try {
      const { networkMetricsCalculator } = await import("./services/network-metrics-calculator");
      const score = await networkMetricsCalculator.calculateNetworkEffectsScore();
      res.json(score);
    } catch (error) {
      logger.error({ err: error }, "Failed to get network effects score");
      res.status(500).json({ error: "Failed to calculate network effects score" });
    }
  });

  app.get("/api/spectral-standard/adopters", async (req: Request, res: Response) => {
    try {
      const { spectralStandardTracker } = await import("./services/spectral-standard-tracker");
      const adopters = await spectralStandardTracker.getAllAdoptions();
      res.json(adopters);
    } catch (error) {
      logger.error({ err: error }, "Failed to get Spectral Standard adopters");
      res.status(500).json({ error: "Failed to load adopters" });
    }
  });

  app.get("/api/vendors/:vendorId/network-metrics", validateVendorAccess, async (req: Request, res: Response) => {
    try {
      const vendorId = req.params.vendorId;
      const { vendorAcceptanceWorkflow } = await import("./services/vendor-acceptance-workflow");
      const metrics = await vendorAcceptanceWorkflow.getVendorNetworkMetrics(vendorId);
      res.json(metrics);
    } catch (error) {
      logger.error({ err: error }, "Failed to get vendor network metrics");
      res.status(500).json({ error: "Failed to load vendor network metrics" });
    }
  });

  app.get("/api/vendors/:vendorId/health-system-acceptances", validateVendorAccess, async (req: Request, res: Response) => {
    try {
      const vendorId = req.params.vendorId;
      const { spectralStandardTracker } = await import("./services/spectral-standard-tracker");
      const adopters = await spectralStandardTracker.getPublicAdoptions();
      res.json(adopters.map(a => ({ id: a.healthSystem.id, name: a.healthSystem.name, state: a.healthSystem.state, adoptionType: a.adoptionType })));
    } catch (error) {
      logger.error({ err: error }, "Failed to get health system acceptances");
      res.status(500).json({ error: "Failed to load health system acceptances" });
    }
  });

  // 🔒 Policy Administration Routes (IP Moat)
  const { registerPolicyAdminRoutes } = await import("./routes/policy-admin");
  registerPolicyAdminRoutes(app);
  
  const { registerBillingRoutes } = await import("./routes/billing");
  registerBillingRoutes(app);

  const httpServer = createServer(app);
  
  // Initialize WebSocket server for real-time updates
  const { websocketServer } = await import("./services/websocket/websocket-server");
  websocketServer.initialize(httpServer);
  
  // Initialize WebSocket broadcaster for event helpers
  const { initializeWebSocketBroadcaster } = await import("./services/websocket/events");
  await initializeWebSocketBroadcaster();
  
  return httpServer;
}
