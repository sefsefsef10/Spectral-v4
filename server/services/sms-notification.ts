/**
 * Twilio SMS Notification Service
 * 
 * Sends critical compliance alerts via SMS to admin users
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */

import { logger } from "../logger";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client if credentials are available
let twilioClient: any = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  } catch (error) {
    logger.warn("Twilio package not installed - SMS notifications disabled");
  }
}

export interface SMSAlertData {
  aiSystemName: string;
  severity: string;
  message: string;
  alertId: string;
}

/**
 * Send critical alert via SMS
 * Returns true if sent successfully, false if Twilio not configured (graceful skip)
 */
export async function sendCriticalAlertSMS(
  phoneNumber: string,
  alertData: SMSAlertData
): Promise<boolean> {
  // If Twilio is not configured, return true (graceful skip - not a failure)
  if (!twilioClient || !TWILIO_PHONE_NUMBER) {
    logger.debug({ phoneNumber }, '[SMS] Twilio not configured - skipping SMS notification');
    return false; // Still return false to signal "not sent", but caller should treat as skip
  }

  try {
    const message = `🚨 CRITICAL AI ALERT
System: ${alertData.aiSystemName}
Severity: ${alertData.severity}
${alertData.message}

Alert ID: ${alertData.alertId}`;

    await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    logger.info({ phoneNumber }, `[SMS] Critical alert sent to ${phoneNumber}`);
    return true;
  } catch (error) {
    logger.error({ err: error }, "[SMS] Failed to send alert");
    return false;
  }
}

/**
 * Send bulk SMS to multiple recipients
 */
export async function sendBulkAlertSMS(
  phoneNumbers: string[],
  alertData: SMSAlertData
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const phoneNumber of phoneNumbers) {
    const success = await sendCriticalAlertSMS(phoneNumber, alertData);
    if (success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}
