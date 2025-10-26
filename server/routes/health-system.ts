import type { Express } from "express";
import { DEMO_HEALTH_SYSTEM_ID } from "../constants";

export function registerHealthSystemRoutes(app: Express) {
  // Get current health system ID (for demo purposes)
  app.get("/api/current-health-system", async (req, res) => {
    res.json({ id: DEMO_HEALTH_SYSTEM_ID });
  });
}
