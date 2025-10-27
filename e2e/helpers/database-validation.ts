/**
 * E2E Database Validation Helpers
 * 
 * Provides utilities to verify database state during E2E tests
 * Ensures data integrity and correct persistence across workflows
 * 
 * NOTE: All validation functions require authenticated API requests.
 * Use getAuthenticatedContext() to create an authenticated request context
 * from a logged-in page session.
 */

import { APIRequestContext, Page } from '@playwright/test';

/**
 * Get authenticated API request context from logged-in page
 * Extracts session cookies and creates new context with auth
 */
export async function getAuthenticatedContext(
  page: Page,
  request: APIRequestContext
): Promise<APIRequestContext> {
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name === 'connect.sid' || c.name === 'session');
  
  if (!sessionCookie) {
    throw new Error('No session cookie found - ensure page is logged in before database validation');
  }

  // Create new request context with session cookie
  return await page.context().newPage().then(p => p.request);
}

export interface DatabaseValidationOptions {
  timeout?: number;
  pollInterval?: number;
}

/**
 * Verify health system exists in database via API
 */
export async function verifyHealthSystemExists(
  request: APIRequestContext,
  healthSystemId: string,
  options: DatabaseValidationOptions = {}
): Promise<boolean> {
  const { timeout = 5000, pollInterval = 500 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await request.get(`/api/health-systems/${healthSystemId}`);
      if (response.ok()) {
        return true;
      }
    } catch (error) {
      // Continue polling
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return false;
}

/**
 * Verify AI system exists in database
 */
export async function verifyAISystemExists(
  request: APIRequestContext,
  aiSystemId: string,
  options: DatabaseValidationOptions = {}
): Promise<{ exists: boolean; data?: any }> {
  const { timeout = 5000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await request.get(`/api/ai-systems/${aiSystemId}`);
      if (response.ok()) {
        const data = await response.json();
        return { exists: true, data };
      }
    } catch (error) {
      // Continue polling
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { exists: false };
}

/**
 * Verify telemetry event was created in database
 */
export async function verifyTelemetryEventExists(
  request: APIRequestContext,
  eventFilter: { aiSystemId?: string; eventType?: string; minTimestamp?: Date },
  options: DatabaseValidationOptions = {}
): Promise<{ exists: boolean; count: number }> {
  const { timeout = 5000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const queryParams = new URLSearchParams();
      if (eventFilter.aiSystemId) queryParams.append('aiSystemId', eventFilter.aiSystemId);
      if (eventFilter.eventType) queryParams.append('eventType', eventFilter.eventType);
      if (eventFilter.minTimestamp) queryParams.append('since', eventFilter.minTimestamp.toISOString());

      const response = await request.get(`/api/telemetry-events?${queryParams.toString()}`);
      if (response.ok()) {
        const data = await response.json();
        const count = Array.isArray(data) ? data.length : data.count || 0;
        if (count > 0) {
          return { exists: true, count };
        }
      }
    } catch (error) {
      // Continue polling
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { exists: false, count: 0 };
}

/**
 * Verify compliance alert was created
 */
export async function verifyComplianceAlertExists(
  request: APIRequestContext,
  alertFilter: { healthSystemId?: string; severity?: string; controlId?: string },
  options: DatabaseValidationOptions = {}
): Promise<{ exists: boolean; alert?: any }> {
  const { timeout = 5000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const queryParams = new URLSearchParams();
      if (alertFilter.healthSystemId) queryParams.append('healthSystemId', alertFilter.healthSystemId);
      if (alertFilter.severity) queryParams.append('severity', alertFilter.severity);
      if (alertFilter.controlId) queryParams.append('controlId', alertFilter.controlId);

      const response = await request.get(`/api/alerts?${queryParams.toString()}`);
      if (response.ok()) {
        const data = await response.json();
        const alerts = Array.isArray(data) ? data : data.alerts || [];
        if (alerts.length > 0) {
          return { exists: true, alert: alerts[0] };
        }
      }
    } catch (error) {
      // Continue polling
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { exists: false };
}

/**
 * Verify certification application exists and has correct status
 */
export async function verifyCertificationApplication(
  request: APIRequestContext,
  applicationId: string,
  expectedStatus?: string,
  options: DatabaseValidationOptions = {}
): Promise<{ exists: boolean; status?: string; data?: any }> {
  const { timeout = 5000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await request.get(`/api/certifications/applications/${applicationId}`);
      if (response.ok()) {
        const data = await response.json();
        
        if (!expectedStatus || data.status === expectedStatus) {
          return { exists: true, status: data.status, data };
        }
      }
    } catch (error) {
      // Continue polling
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { exists: false };
}

/**
 * Verify customization request was saved to database
 */
export async function verifyCustomizationExists(
  request: APIRequestContext,
  customizationFilter: { healthSystemId: string; controlId?: string; type?: string },
  options: DatabaseValidationOptions = {}
): Promise<{ exists: boolean; customization?: any }> {
  const { timeout = 5000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await request.get(`/api/customizations?healthSystemId=${customizationFilter.healthSystemId}`);
      if (response.ok()) {
        const data = await response.json();
        const customizations = Array.isArray(data) ? data : data.customizations || [];
        
        let filtered = customizations;
        if (customizationFilter.controlId) {
          filtered = filtered.filter((c: any) => c.controlId === customizationFilter.controlId);
        }
        if (customizationFilter.type) {
          filtered = filtered.filter((c: any) => c.type === customizationFilter.type);
        }

        if (filtered.length > 0) {
          return { exists: true, customization: filtered[0] };
        }
      }
    } catch (error) {
      // Continue polling
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { exists: false };
}

/**
 * Verify audit log entry exists for an action
 */
export async function verifyAuditLogExists(
  request: APIRequestContext,
  logFilter: { userId?: string; action?: string; resourceType?: string; resourceId?: string },
  options: DatabaseValidationOptions = {}
): Promise<{ exists: boolean; log?: any }> {
  const { timeout = 5000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const queryParams = new URLSearchParams();
      if (logFilter.userId) queryParams.append('userId', logFilter.userId);
      if (logFilter.action) queryParams.append('action', logFilter.action);
      if (logFilter.resourceType) queryParams.append('resourceType', logFilter.resourceType);
      if (logFilter.resourceId) queryParams.append('resourceId', logFilter.resourceId);

      const response = await request.get(`/api/audit-logs?${queryParams.toString()}`);
      if (response.ok()) {
        const data = await response.json();
        const logs = Array.isArray(data) ? data : data.logs || [];
        if (logs.length > 0) {
          return { exists: true, log: logs[0] };
        }
      }
    } catch (error) {
      // Continue polling
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { exists: false };
}

/**
 * Get count of records matching filter
 */
export async function getRecordCount(
  request: APIRequestContext,
  endpoint: string,
  filter?: Record<string, string>
): Promise<number> {
  try {
    const queryParams = filter ? new URLSearchParams(filter) : '';
    const url = queryParams ? `${endpoint}?${queryParams}` : endpoint;
    
    const response = await request.get(url);
    if (response.ok()) {
      const data = await response.json();
      if (typeof data.count === 'number') return data.count;
      if (Array.isArray(data)) return data.length;
      if (data.total) return data.total;
    }
  } catch (error) {
    // Return 0 on error
  }
  
  return 0;
}

/**
 * Wait for record count to match expected value
 */
export async function waitForRecordCount(
  request: APIRequestContext,
  endpoint: string,
  expectedCount: number,
  filter?: Record<string, string>,
  options: DatabaseValidationOptions = {}
): Promise<boolean> {
  const { timeout = 5000, pollInterval = 500 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const count = await getRecordCount(request, endpoint, filter);
    if (count === expectedCount) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return false;
}
