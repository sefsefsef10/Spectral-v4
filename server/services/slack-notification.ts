/**
 * Slack Notification Service
 * 
 * Sends real-time compliance alerts to Slack channels via webhooks
 * Requires SLACK_WEBHOOK_URL
 */

import { logger } from "../logger";

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

export interface SlackAlertData {
  aiSystemName: string;
  healthSystemName: string;
  severity: string;
  message: string;
  alertId: string;
  timestamp: Date;
}

/**
 * Send critical alert to Slack
 * Returns true if sent successfully, false if webhook not configured (graceful skip)
 */
export async function sendCriticalAlertSlack(
  alertData: SlackAlertData
): Promise<boolean> {
  // If Slack webhook is not configured, return false (graceful skip - not a failure)
  if (!SLACK_WEBHOOK_URL) {
    logger.debug('[Slack] Webhook not configured - skipping Slack notification');
    return false; // Return false to signal "not sent", but caller should treat as skip
  }

  try {
    const severityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    }[alertData.severity] || '⚪';

    const payload = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${severityEmoji} ${alertData.severity.toUpperCase()} AI Compliance Alert`,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Health System:*\n${alertData.healthSystemName}`,
            },
            {
              type: "mrkdwn",
              text: `*AI System:*\n${alertData.aiSystemName}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Alert Message:*\n${alertData.message}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Alert ID: \`${alertData.alertId}\` | ${alertData.timestamp.toLocaleString()}`,
            },
          ],
        },
      ],
    };

    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }

    logger.info('[Slack] Critical alert sent successfully');
    return true;
  } catch (error) {
    logger.error({ err: error }, "[Slack] Failed to send alert");
    return false;
  }
}

/**
 * Send compliance violation summary to Slack
 */
export async function sendComplianceViolationSlack(
  violationData: {
    framework: string;
    controlId: string;
    controlName: string;
    aiSystemName: string;
    healthSystemName: string;
    severity: string;
    description: string;
  }
): Promise<boolean> {
  if (!SLACK_WEBHOOK_URL) {
    logger.info({ violationData }, '[Slack] Webhook not configured - would send violation');
    return false;
  }

  try {
    const payload = {
      text: `⚠️ Compliance Violation Detected`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `⚠️ ${violationData.framework} Compliance Violation`,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Control:*\n${violationData.controlId} - ${violationData.controlName}`,
            },
            {
              type: "mrkdwn",
              text: `*Severity:*\n${violationData.severity}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Description:*\n${violationData.description}`,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Health System:*\n${violationData.healthSystemName}`,
            },
            {
              type: "mrkdwn",
              text: `*AI System:*\n${violationData.aiSystemName}`,
            },
          ],
        },
      ],
    };

    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }

    logger.info('[Slack] Compliance violation notification sent');
    return true;
  } catch (error) {
    logger.error({ err: error }, "[Slack] Failed to send violation notification");
    return false;
  }
}
