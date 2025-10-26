import { inngest } from "../client";
import { logger } from "../../logger";
import { storage } from "../../storage";
import { processCertificationApplication } from "../../services/certification-processor";

/**
 * Durable certification workflow with automatic retries
 * Runs PHI exposure, clinical accuracy, bias detection, and security scans
 */
export const certificationWorkflow = inngest.createFunction(
  {
    id: "certification-workflow",
    retries: 3,
  },
  { event: "certification/application.submitted" },
  async ({ event, step }) => {
    const { applicationId, vendorId, testSuiteId } = event.data;

    // Step 1: Load application data
    const application = await step.run("load-application", async () => {
      const app = await storage.getCertificationApplication(applicationId);
      if (!app) {
        throw new Error(`Application ${applicationId} not found`);
      }
      logger.info({ applicationId, vendorId }, "Starting certification workflow");
      return app;
    });

    // Step 2: Process certification (runs all tests, calculates score, updates status)
    const result = await step.run("process-certification", async () => {
      const result = await processCertificationApplication(applicationId);
      logger.info({ applicationId, result }, "Certification processing complete");
      return result;
    });

    // Step 3: Send notification email (if enabled and if vendor has email)
    if (process.env.SENDGRID_API_KEY && result.vendorEmail) {
      await step.run("send-notification", async () => {
        const { sendCertificationResultEmail } = await import(
          "../../services/email-notification"
        );
        await sendCertificationResultEmail(
          result.vendorEmail,
          result.vendorName || "Vendor",
          result.passed,
          result.overallScore
        );
      });
    }

    return result;
  }
);
