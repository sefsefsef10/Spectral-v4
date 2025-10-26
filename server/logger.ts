/**
 * Structured Logging with Pino
 * 
 * Provides production-ready structured logging with:
 * - JSON output for log aggregation (production)
 * - Pretty-printed output for development
 * - Request correlation IDs
 * - Automatic error serialization
 * - User context tracking
 * - Performance metrics
 */

import pino from 'pino';
import type { Request, Response } from 'express';

// Create base logger instance
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  
  // Use pretty printing in development, JSON in production
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    }
  } : undefined,
  
  // Base configuration
  base: {
    env: process.env.NODE_ENV || 'development',
    service: 'spectral-healthcare-ai',
  },
  
  // Serialize errors with stack traces
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  
  // Redact sensitive fields from logs
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token', 'apiKey'],
    censor: '[REDACTED]',
  },
});

/**
 * Create child logger with request context
 */
export function createRequestLogger(req: Request) {
  return logger.child({
    requestId: generateRequestId(),
    method: req.method,
    path: req.path,
    userId: (req.session as any)?.userId,
    ip: req.ip,
  });
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log HTTP request/response
 */
export function logHttpRequest(req: Request, res: Response, duration: number) {
  const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
  
  logger[level]({
    type: 'http_request',
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration,
    userId: (req.session as any)?.userId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
}

/**
 * Log business events
 */
export function logEvent(event: {
  type: string;
  action: string;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}) {
  logger.info({
    logType: 'business_event',
    eventType: event.type,
    action: event.action,
    userId: event.userId,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    metadata: event.metadata,
  }, `${event.type}: ${event.action}`);
}

/**
 * Log security events
 */
export function logSecurityEvent(event: {
  type: 'auth_success' | 'auth_failure' | 'csrf_violation' | 'unauthorized_access' | 'permission_denied';
  userId?: string;
  ip?: string;
  path?: string;
  metadata?: Record<string, any>;
}) {
  logger.warn({
    logType: 'security_event',
    eventType: event.type,
    userId: event.userId,
    ip: event.ip,
    path: event.path,
    metadata: event.metadata,
  }, `Security: ${event.type}`);
}

/**
 * Log database operations
 */
export function logDbOperation(operation: {
  type: 'query' | 'insert' | 'update' | 'delete';
  table: string;
  duration: number;
  error?: Error;
}) {
  if (operation.error) {
    logger.error({
      logType: 'db_operation',
      operationType: operation.type,
      table: operation.table,
      duration: operation.duration,
      err: operation.error,
    }, `DB ${operation.type} failed on ${operation.table}`);
  } else {
    logger.debug({
      logType: 'db_operation',
      operationType: operation.type,
      table: operation.table,
      duration: operation.duration,
    }, `DB ${operation.type} on ${operation.table} (${operation.duration}ms)`);
  }
}

/**
 * Log performance metrics
 */
export function logMetric(metric: {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'bytes';
  tags?: Record<string, string>;
}) {
  logger.info({
    type: 'metric',
    ...metric,
  }, `Metric: ${metric.name} = ${metric.value}${metric.unit}`);
}
