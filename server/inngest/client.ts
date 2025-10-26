import { Inngest, EventSchemas } from "inngest";

/**
 * Event types for Spectral platform
 */
type Events = {
  "certification/application.submitted": {
    data: {
      applicationId: string;
      vendorId: string;
      testSuiteId?: string;
    };
  };
  "certification/test.completed": {
    data: {
      applicationId: string;
      testType: string;
      passed: boolean;
    };
  };
  "alerts/predictive.generate": {
    data: {
      healthSystemId: string;
    };
  };
  "actions/automated.execute": {
    data: {
      actionId: string;
      alertId: string;
      actionType: string;
    };
  };
  "telemetry/violation.detected": {
    data: {
      violationId: string;
      aiSystemId: string;
      severity: string;
    };
  };
};

/**
 * Inngest client for Spectral Healthcare AI
 * Handles durable workflows for certification, alerts, and automated actions
 */
export const inngest = new Inngest({
  id: "spectral-healthcare-ai",
  schemas: new EventSchemas().fromRecord<Events>(),
  eventKey: process.env.INNGEST_EVENT_KEY,
});
