/**
 * One-time script to create a demo API key for VizAI vendor
 * Run with: npx tsx server/create-demo-api-key.ts
 */

import { db } from "./db";
import { vendorApiKeys, vendors } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateApiKey } from "./utils/api-key-generator";

async function createDemoApiKey() {
  try {
    // Get VizAI vendor
    const [vizai] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.name, "VizAI Inc."));
    
    if (!vizai) {
      console.error("❌ VizAI vendor not found. Please run seed script first.");
      process.exit(1);
    }

    // Check if API key already exists
    const existing = await db
      .select()
      .from(vendorApiKeys)
      .where(eq(vendorApiKeys.vendorId, vizai.id));
    
    if (existing.length > 0) {
      console.log("⚠️  API key already exists for VizAI");
      console.log("Existing key prefix:", existing[0].keyPrefix);
      return;
    }

    // Generate new API key
    const apiKeyData = await generateApiKey("test");
    
    await db.insert(vendorApiKeys).values({
      vendorId: vizai.id,
      keyHash: apiKeyData.keyHash,
      keyPrefix: apiKeyData.keyPrefix,
      name: "VizAI Partner API Key",
      active: true,
    });

    console.log("\n" + "=".repeat(80));
    console.log("🔑 DEMO VENDOR API KEY (VizAI Inc.)");
    console.log("=".repeat(80));
    console.log("Vendor ID:", vizai.id);
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
    
    console.log("✅ API key created successfully!");
  } catch (error) {
    console.error("❌ Error creating API key:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

createDemoApiKey();
