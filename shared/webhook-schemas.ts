/**
 * Webhook Payload Validation Schemas
 * 
 * Zod schemas for validating incoming webhook payloads from external services.
 * Ensures type safety and prevents malformed data from being processed.
 */

import { z } from 'zod';

// ===== AI MONITORING WEBHOOKS =====

/**
 * LangSmith webhook payload schema
 */
export const langSmithWebhookSchema = z.object({
  event_type: z.enum(['trace_created', 'feedback_submitted', 'run_completed']),
  run_id: z.string().uuid(),
  trace_id: z.string().uuid().optional(),
  model_name: z.string().optional(),
  input: z.any(),
  output: z.any(),
  error: z.string().optional(),
  latency_ms: z.number().optional(),
  token_count: z.number().optional(),
  metadata: z.record(z.any()).optional(),
  timestamp: z.string().datetime(),
});

export type LangSmithWebhookPayload = z.infer<typeof langSmithWebhookSchema>;

/**
 * Arize AI webhook payload schema
 */
export const arizeWebhookSchema = z.object({
  event_type: z.enum(['prediction', 'ground_truth', 'drift_detected', 'performance_degradation']),
  model_id: z.string(),
  model_version: z.string().optional(),
  prediction_id: z.string(),
  prediction: z.any(),
  features: z.record(z.any()).optional(),
  actual: z.any().optional(),
  drift_score: z.number().optional(),
  accuracy_score: z.number().optional(),
  timestamp: z.number(),
});

export type ArizeWebhookPayload = z.infer<typeof arizeWebhookSchema>;

/**
 * LangFuse webhook payload schema
 */
export const langFuseWebhookSchema = z.object({
  type: z.enum(['trace-create', 'generation-create', 'score-create']),
  id: z.string(),
  name: z.string().optional(),
  input: z.any().optional(),
  output: z.any().optional(),
  model: z.string().optional(),
  usage: z.object({
    promptTokens: z.number().optional(),
    completionTokens: z.number().optional(),
    totalTokens: z.number().optional(),
  }).optional(),
  timestamp: z.string().datetime(),
});

export type LangFuseWebhookPayload = z.infer<typeof langFuseWebhookSchema>;

/**
 * Weights & Biases webhook payload schema
 */
export const wandbWebhookSchema = z.object({
  event_type: z.enum(['run_started', 'run_finished', 'alert_triggered']),
  run_id: z.string(),
  run_name: z.string().optional(),
  project: z.string(),
  entity: z.string(),
  metrics: z.record(z.number()).optional(),
  config: z.record(z.any()).optional(),
  summary: z.record(z.any()).optional(),
  state: z.string().optional(),
  created_at: z.string(),
});

export type WandbWebhookPayload = z.infer<typeof wandbWebhookSchema>;

// ===== EHR SYSTEM WEBHOOKS =====

/**
 * Epic FHIR webhook payload schema
 */
export const epicWebhookSchema = z.object({
  event_type: z.enum(['patient.access', 'medication.order', 'observation.create']),
  resource_type: z.string(),
  resource_id: z.string(),
  patient_id: z.string().optional(),
  timestamp: z.string().datetime(),
  data: z.record(z.any()),
});

export type EpicWebhookPayload = z.infer<typeof epicWebhookSchema>;

/**
 * Cerner FHIR webhook payload schema
 */
export const cernerWebhookSchema = z.object({
  event: z.string(),
  resourceType: z.string(),
  id: z.string(),
  timestamp: z.string().datetime(),
  resource: z.record(z.any()),
});

export type CernerWebhookPayload = z.infer<typeof cernerWebhookSchema>;

/**
 * Athenahealth webhook payload schema
 */
export const athenahealthWebhookSchema = z.object({
  eventtype: z.string(),
  patientid: z.string().optional(),
  appointmentid: z.string().optional(),
  departmentid: z.string().optional(),
  data: z.record(z.any()).optional(),
  timestamp: z.string(),
});

export type AthenalhealthWebhookPayload = z.infer<typeof athenahealthWebhookSchema>;

// ===== INCIDENT MANAGEMENT WEBHOOKS =====

/**
 * PagerDuty webhook payload schema
 */
export const pagerDutyWebhookSchema = z.object({
  event: z.object({
    event_type: z.enum(['incident.triggered', 'incident.acknowledged', 'incident.resolved']),
    id: z.string(),
    created_on: z.string().datetime(),
    resource_type: z.string(),
    data: z.object({
      id: z.string(),
      type: z.string(),
      summary: z.string().optional(),
      html_url: z.string().optional(),
      service: z.object({
        id: z.string(),
        summary: z.string().optional(),
      }).optional(),
    }),
  }),
});

export type PagerDutyWebhookPayload = z.infer<typeof pagerDutyWebhookSchema>;

/**
 * DataDog webhook payload schema
 */
export const dataDogWebhookSchema = z.object({
  body: z.string(),
  title: z.string(),
  alert_type: z.enum(['error', 'warning', 'info', 'success']),
  alert_transition: z.enum(['Triggered', 'Recovered', 'No Data']).optional(),
  event_type: z.string().optional(),
  priority: z.enum(['normal', 'low']).optional(),
  date: z.number(),
  id: z.string().optional(),
  metric: z.string().optional(),
  snapshot: z.string().optional(),
});

export type DataDogWebhookPayload = z.infer<typeof dataDogWebhookSchema>;

// ===== NOTIFICATION WEBHOOKS =====

/**
 * Twilio webhook payload schema
 */
export const twilioWebhookSchema = z.object({
  MessageSid: z.string(),
  SmsSid: z.string().optional(),
  AccountSid: z.string(),
  MessagingServiceSid: z.string().optional(),
  From: z.string(),
  To: z.string(),
  Body: z.string(),
  MessageStatus: z.enum(['queued', 'sending', 'sent', 'failed', 'delivered', 'undelivered', 'receiving', 'received']),
  NumMedia: z.string().optional(),
  NumSegments: z.string().optional(),
  ErrorCode: z.string().optional(),
  ErrorMessage: z.string().optional(),
});

export type TwilioWebhookPayload = z.infer<typeof twilioWebhookSchema>;

/**
 * Slack webhook payload schema (interactive actions)
 */
export const slackWebhookSchema = z.object({
  type: z.string(),
  team: z.object({
    id: z.string(),
    domain: z.string().optional(),
  }).optional(),
  user: z.object({
    id: z.string(),
    username: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
  channel: z.object({
    id: z.string(),
    name: z.string().optional(),
  }).optional(),
  action_ts: z.string().optional(),
  message_ts: z.string().optional(),
  text: z.string().optional(),
  trigger_id: z.string().optional(),
});

export type SlackWebhookPayload = z.infer<typeof slackWebhookSchema>;

// ===== STRIPE WEBHOOKS (for Phase 4) =====

/**
 * Stripe webhook payload schema
 */
export const stripeWebhookSchema = z.object({
  id: z.string(),
  object: z.literal('event'),
  type: z.string(), // e.g., 'invoice.paid', 'customer.subscription.updated'
  created: z.number(),
  data: z.object({
    object: z.record(z.any()),
    previous_attributes: z.record(z.any()).optional(),
  }),
  livemode: z.boolean(),
  pending_webhooks: z.number(),
  request: z.object({
    id: z.string().nullable(),
    idempotency_key: z.string().nullable(),
  }).nullable(),
  api_version: z.string().nullable(),
});

export type StripeWebhookPayload = z.infer<typeof stripeWebhookSchema>;

// Helper function to validate webhook payload
export function validateWebhookPayload<T>(
  schema: z.ZodSchema<T>,
  payload: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
