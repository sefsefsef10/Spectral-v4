import { db } from "./db";
import { healthSystems, vendors, vendorApiKeys, aiSystems, monitoringAlerts, deployments, complianceCertifications, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { seedComplianceControls } from "./seed-compliance-controls";
import { hashPassword } from "./auth";
import { generateApiKey } from "./utils/api-key-generator";

// Fixed IDs for demo data to ensure idempotency
const DEMO_HEALTH_SYSTEM_ID = "demo-health-system-001";
const DEMO_VENDOR_VIZAI_ID = "demo-vendor-vizai-001";
const DEMO_VENDOR_EPIC_ID = "demo-vendor-epic-001";
const DEMO_VENDOR_NUANCE_ID = "demo-vendor-nuance-001";
const DEMO_VENDOR_AIDOC_ID = "demo-vendor-aidoc-001";

export async function seedDatabase() {
  try {
    // Check if already seeded
    const existing = await db.select().from(healthSystems).where(eq(healthSystems.id, DEMO_HEALTH_SYSTEM_ID));
    if (existing.length > 0) {
      console.log("Database already seeded, skipping...");
      return;
    }

    // Create a demo health system with fixed ID
    const [healthSystem] = await db.insert(healthSystems).values({
      id: DEMO_HEALTH_SYSTEM_ID,
      name: "Main Hospital System",
    }).returning();

    console.log("Created health system:", healthSystem.id);

    // Create demo vendors with fixed IDs
    const [vizai] = await db.insert(vendors).values({
      id: DEMO_VENDOR_VIZAI_ID,
      name: "VizAI Inc.",
      verified: true,
      trustPageUrl: "https://trust.spectral.health/vizai",
    }).returning();

    const [epic] = await db.insert(vendors).values({
      id: DEMO_VENDOR_EPIC_ID,
      name: "Epic Systems",
      verified: true,
      trustPageUrl: "https://trust.spectral.health/epic",
    }).returning();

    const [nuance] = await db.insert(vendors).values({
      id: DEMO_VENDOR_NUANCE_ID,
      name: "Nuance Communications",
      verified: true,
      trustPageUrl: "https://trust.spectral.health/nuance",
    }).returning();

    const [aidoc] = await db.insert(vendors).values({
      id: DEMO_VENDOR_AIDOC_ID,
      name: "Aidoc Medical",
      verified: true,
      trustPageUrl: "https://trust.spectral.health/aidoc",
    }).returning();

    console.log("Created vendors");

    // Create API key for VizAI vendor (for Partner API testing)
    const apiKeyData = await generateApiKey("test");
    await db.insert(vendorApiKeys).values({
      vendorId: vizai.id,
      keyHash: apiKeyData.keyHash,
      keyPrefix: apiKeyData.keyPrefix,
      name: "VizAI Partner API Key",
      active: true,
    });
    
    console.log("=".repeat(80));
    console.log("🔑 DEMO VENDOR API KEY (VizAI Inc.)");
    console.log("=".repeat(80));
    console.log("API Key:", apiKeyData.key);
    console.log("");
    console.log("Use this key to test Partner API endpoints:");
    console.log("  POST /api/partner/applications");
    console.log("  GET  /api/partner/applications");
    console.log("  GET  /api/partner/applications/:id");
    console.log("  GET  /api/partner/compliance-scores");
    console.log("");
    console.log("Example:");
    console.log('  curl -H "Authorization: Bearer ' + apiKeyData.key + '" \\');
    console.log('       http://localhost:5000/api/partner/compliance-scores');
    console.log("=".repeat(80));
    console.log("");

    // Create AI systems
    const systemsData = [
      { name: "Epic Ambient AI", department: "Clinical", riskLevel: "Medium", status: "drift", vendorId: epic.id, lastCheck: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      { name: "Radiology AI 2.1", department: "Imaging", riskLevel: "High", status: "drift", vendorId: vizai.id, lastCheck: new Date(Date.now() - 4 * 60 * 60 * 1000) },
      { name: "Nuance DAX", department: "Clinical", riskLevel: "Medium", status: "verified", vendorId: nuance.id, lastCheck: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { name: "Aidoc Stroke", department: "Imaging", riskLevel: "High", status: "verified", vendorId: aidoc.id, lastCheck: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      { name: "Internal Chatbot", department: "IT", riskLevel: "Low", status: "testing", vendorId: null, lastCheck: new Date() },
      { name: "Coding AI", department: "RCM", riskLevel: "Medium", status: "verified", vendorId: null, lastCheck: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      { name: "PathAI Diagnostic", department: "Pathology", riskLevel: "High", status: "verified", vendorId: null, lastCheck: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { name: "Cleerly Heart", department: "Cardiology", riskLevel: "High", status: "verified", vendorId: null, lastCheck: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
    ];

    const createdSystems = await db.insert(aiSystems).values(
      systemsData.map(s => ({ ...s, healthSystemId: healthSystem.id }))
    ).returning();

    console.log("Created AI systems");

    // Create monitoring alert for first system
    await db.insert(monitoringAlerts).values({
      aiSystemId: createdSystems[0].id,
      type: "Model Drift",
      severity: "medium",
      message: "Performance degradation detected in clinical documentation accuracy",
      resolved: false,
    });

    console.log("Created monitoring alerts");

    // Create deployment for VizAI
    await db.insert(deployments).values({
      vendorId: vizai.id,
      healthSystemId: healthSystem.id,
      status: "active",
    });

    console.log("Created deployments");

    // Create compliance certifications for VizAI
    await db.insert(complianceCertifications).values([
      { vendorId: vizai.id, type: "HIPAA Security Rule", status: "verified", verifiedDate: new Date("2025-01-15") },
      { vendorId: vizai.id, type: "NIST AI RMF", status: "verified", verifiedDate: new Date("2025-01-15") },
      { vendorId: vizai.id, type: "FDA SaMD Guidance", status: "verified", verifiedDate: new Date("2025-01-15") },
      { vendorId: vizai.id, type: "ISO 27001", status: "verified", verifiedDate: new Date("2024-06-01") },
    ]);

    console.log("Created compliance certifications");

    // Create a demo user with hashed password
    const hashedPassword = await hashPassword("demo123");
    await db.insert(users).values({
      username: "demo",
      password: hashedPassword,
      role: "health_system",
      healthSystemId: healthSystem.id,
      vendorId: null,
    });

    console.log("Database seeded successfully!");
    console.log("Demo credentials: username=demo, password=demo123");
    console.log("Health System ID:", DEMO_HEALTH_SYSTEM_ID);

    // Seed Translation Engine compliance controls
    await seedComplianceControls();

  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}
