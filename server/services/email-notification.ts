import { logger } from "../logger";
import sgMail from '@sendgrid/mail';

// Email notification service for critical compliance alerts
// Requires SENDGRID_API_KEY environment variable

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;

// Initialize SendGrid if API key is available
if (SENDGRID_API_KEY && FROM_EMAIL) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else if (SENDGRID_API_KEY && !FROM_EMAIL) {
  logger.warn('SENDGRID_API_KEY is set but FROM_EMAIL is not configured');
}

export interface AlertEmailData {
  aiSystemName: string;
  severity: string;
  message: string;
  timestamp: Date;
  healthSystemName: string;
  alertId: string;
}

export async function sendCriticalAlertEmail(
  recipientEmail: string,
  recipientName: string,
  alertData: AlertEmailData
): Promise<boolean> {
  // If SendGrid is not configured, log and return
  if (!SENDGRID_API_KEY || !FROM_EMAIL) {
    logger.info({ recipientEmail, alertData }, '[Email] SendGrid not configured - would send alert email');
    return false;
  }

  try {
    const msg = {
      to: recipientEmail,
      from: FROM_EMAIL,
      subject: `🚨 Critical AI Compliance Alert - ${alertData.aiSystemName}`,
      text: generatePlainTextEmail(recipientName, alertData),
      html: generateHtmlEmail(recipientName, alertData),
    };

    await sgMail.send(msg);
    logger.info({ recipientEmail }, `[Email] Critical alert email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    logger.error({ err: error }, "[Email] Failed to send alert email");
    return false;
  }
}

export async function sendUserInvitationEmail(
  recipientEmail: string,
  inviterName: string,
  organizationName: string,
  invitationUrl: string
): Promise<boolean> {
  if (!SENDGRID_API_KEY || !FROM_EMAIL) {
    logger.info({ recipientEmail }, '[Email] SendGrid not configured - would send invitation');
    return false;
  }

  try {
    const msg = {
      to: recipientEmail,
      from: FROM_EMAIL,
      subject: `You've been invited to join ${organizationName} on Spectral`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎯 Invitation to Join Spectral</h1>
  </div>
  <div class="content">
    <p>Hello,</p>
    <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on Spectral AI Governance Platform.</p>
    <p>Spectral helps healthcare organizations govern AI systems with real-time compliance monitoring, automated reporting, and regulatory framework mapping.</p>
    <center>
      <a href="${invitationUrl}" class="button">Accept Invitation →</a>
    </center>
    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">This invitation expires in 7 days.</p>
    <div class="footer">
      <p><strong>Spectral AI Governance Platform</strong></p>
      <p style="font-size: 12px; color: #9ca3af;">Secure AI oversight for healthcare organizations</p>
    </div>
  </div>
</body>
</html>
      `,
    };

    await sgMail.send(msg);
    logger.info({ recipientEmail }, `[Email] Invitation email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    logger.error({ err: error }, "[Email] Failed to send invitation email");
    return false;
  }
}

export async function sendCertificationApprovedEmail(
  recipientEmail: string,
  vendorName: string,
  productName: string,
  certificationTier: string,
  trustPageUrl: string
): Promise<boolean> {
  if (!SENDGRID_API_KEY || !FROM_EMAIL) {
    logger.info({ recipientEmail }, '[Email] SendGrid not configured - would send certification email');
    return false;
  }

  try {
    const msg = {
      to: recipientEmail,
      from: FROM_EMAIL,
      subject: `🎉 Congratulations! ${productName} is now Spectral ${certificationTier}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px; }
    .badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 6px; display: inline-block; margin: 15px 0; font-weight: 700; }
    .button { display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 Certification Approved!</h1>
  </div>
  <div class="content">
    <p>Congratulations ${vendorName}!</p>
    <p>Your AI product <strong>${productName}</strong> has successfully completed Spectral's rigorous compliance testing and verification process.</p>
    <center>
      <div class="badge">Spectral ${certificationTier}</div>
    </center>
    <h3>What This Means:</h3>
    <ul>
      <li>✅ Verified HIPAA compliance</li>
      <li>✅ Independent third-party validation</li>
      <li>✅ Public trust page for prospects</li>
      <li>✅ Accelerated healthcare procurement</li>
    </ul>
    <h3>Next Steps:</h3>
    <ol>
      <li>Share your public trust page with prospects and customers</li>
      <li>Add the "Spectral ${certificationTier}" badge to your website</li>
      <li>Reference your certification in RFP responses</li>
    </ol>
    <center>
      <a href="${trustPageUrl}" class="button">View Your Trust Page →</a>
    </center>
    <div class="footer">
      <p><strong>Spectral AI Governance Platform</strong></p>
      <p style="font-size: 12px; color: #9ca3af;">Accelerating safe AI adoption in healthcare</p>
    </div>
  </div>
</body>
</html>
      `,
    };

    await sgMail.send(msg);
    logger.info({ recipientEmail }, `[Email] Certification approval email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    logger.error({ err: error }, "[Email] Failed to send certification email");
    return false;
  }
}

function generatePlainTextEmail(recipientName: string, alertData: AlertEmailData): string {
  return `
Hello ${recipientName},

CRITICAL COMPLIANCE ALERT

A critical compliance issue has been detected in your AI system portfolio.

AI System: ${alertData.aiSystemName}
Severity: ${alertData.severity.toUpperCase()}
Alert: ${alertData.message}
Time: ${alertData.timestamp.toLocaleString()}

This alert requires immediate attention to maintain compliance standards.

RECOMMENDED ACTIONS:
1. Review the alert details in your Spectral dashboard
2. Investigate the root cause of the compliance issue
3. Take corrective action to resolve the alert
4. Document remediation steps for audit trail

View Alert: https://spectral-ai.com/dashboard/alerts/${alertData.alertId}

---
Spectral AI Governance Platform
${alertData.healthSystemName}

This is an automated alert. Spectral continuously monitors your AI systems for compliance drift.
`.trim();
}

export async function sendEmailVerificationEmail(
  recipientEmail: string,
  recipientName: string,
  verificationUrl: string
): Promise<boolean> {
  if (!SENDGRID_API_KEY || !FROM_EMAIL) {
    logger.info({ recipientEmail, verificationUrl }, '[Email] SendGrid not configured - would send verification email');
    return false;
  }

  try {
    const msg = {
      to: recipientEmail,
      from: FROM_EMAIL,
      subject: `Verify your email address for Spectral`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>✅ Verify Your Email</h1>
  </div>
  <div class="content">
    <p>Hello ${recipientName},</p>
    <p>Thank you for registering with Spectral AI Governance Platform. Please verify your email address to complete your account setup.</p>
    <center>
      <a href="${verificationUrl}" class="button">Verify Email Address →</a>
    </center>
    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">This verification link expires in 24 hours.</p>
    <p style="color: #6b7280; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
    <div class="footer">
      <p><strong>Spectral AI Governance Platform</strong></p>
      <p style="font-size: 12px; color: #9ca3af;">Secure AI oversight for healthcare organizations</p>
    </div>
  </div>
</body>
</html>
      `,
    };

    await sgMail.send(msg);
    logger.info({ recipientEmail }, `[Email] Verification email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    logger.error({ err: error }, "[Email] Failed to send verification email");
    return false;
  }
}

export async function sendPasswordResetEmail(
  recipientEmail: string,
  recipientName: string,
  resetUrl: string
): Promise<boolean> {
  if (!SENDGRID_API_KEY || !FROM_EMAIL) {
    logger.info({ recipientEmail, resetUrl }, '[Email] SendGrid not configured - would send password reset email');
    return false;
  }

  try {
    const msg = {
      to: recipientEmail,
      from: FROM_EMAIL,
      subject: `Reset your Spectral password`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .warning { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔐 Reset Your Password</h1>
  </div>
  <div class="content">
    <p>Hello ${recipientName},</p>
    <p>We received a request to reset your password for your Spectral account. Click the button below to create a new password.</p>
    <center>
      <a href="${resetUrl}" class="button">Reset Password →</a>
    </center>
    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">This password reset link expires in 1 hour.</p>
    <div class="warning">
      <p style="margin: 0; color: #dc2626; font-weight: 600;">⚠️ Security Notice</p>
      <p style="margin: 10px 0 0 0; font-size: 14px;">If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
    </div>
    <div class="footer">
      <p><strong>Spectral AI Governance Platform</strong></p>
      <p style="font-size: 12px; color: #9ca3af;">Secure AI oversight for healthcare organizations</p>
    </div>
  </div>
</body>
</html>
      `,
    };

    await sgMail.send(msg);
    logger.info({ recipientEmail }, `[Email] Password reset email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    logger.error({ err: error }, "[Email] Failed to send password reset email");
    return false;
  }
}

function generateHtmlEmail(recipientName: string, alertData: AlertEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 8px 8px 0 0;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-top: none;
      padding: 30px;
      border-radius: 0 0 8px 8px;
    }
    .alert-box {
      background: #fef2f2;
      border-left: 4px solid #dc2626;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .alert-box h2 {
      color: #dc2626;
      margin-top: 0;
      font-size: 18px;
    }
    .detail-row {
      display: flex;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .detail-label {
      font-weight: 600;
      width: 120px;
      color: #6b7280;
    }
    .detail-value {
      flex: 1;
      color: #111827;
    }
    .severity-critical {
      background: #dc2626;
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      display: inline-block;
      font-weight: 600;
      font-size: 14px;
    }
    .actions {
      background: #f9fafb;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .actions h3 {
      margin-top: 0;
      color: #111827;
      font-size: 16px;
    }
    .actions ol {
      margin: 10px 0;
      padding-left: 20px;
    }
    .actions li {
      margin: 8px 0;
      color: #374151;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚨 Critical Compliance Alert</h1>
  </div>
  
  <div class="content">
    <p>Hello ${recipientName},</p>
    
    <div class="alert-box">
      <h2>Compliance Issue Detected</h2>
      <p>A critical compliance issue has been detected in your AI system portfolio.</p>
    </div>
    
    <div class="detail-row">
      <span class="detail-label">AI System:</span>
      <span class="detail-value"><strong>${alertData.aiSystemName}</strong></span>
    </div>
    
    <div class="detail-row">
      <span class="detail-label">Severity:</span>
      <span class="detail-value"><span class="severity-critical">${alertData.severity.toUpperCase()}</span></span>
    </div>
    
    <div class="detail-row">
      <span class="detail-label">Alert:</span>
      <span class="detail-value">${alertData.message}</span>
    </div>
    
    <div class="detail-row">
      <span class="detail-label">Time:</span>
      <span class="detail-value">${alertData.timestamp.toLocaleString()}</span>
    </div>
    
    <div class="actions">
      <h3>Recommended Actions:</h3>
      <ol>
        <li>Review the alert details in your Spectral dashboard</li>
        <li>Investigate the root cause of the compliance issue</li>
        <li>Take corrective action to resolve the alert</li>
        <li>Document remediation steps for audit trail</li>
      </ol>
    </div>
    
    <center>
      <a href="https://spectral-ai.com/dashboard/alerts/${alertData.alertId}" class="button">
        View Alert in Dashboard →
      </a>
    </center>
    
    <div class="footer">
      <p><strong>Spectral AI Governance Platform</strong><br>
      ${alertData.healthSystemName}</p>
      <p style="font-size: 12px; color: #9ca3af;">
        This is an automated alert. Spectral continuously monitors your AI systems for compliance drift.
      </p>
    </div>
  </div>
</body>
</html>
`.trim();
}
