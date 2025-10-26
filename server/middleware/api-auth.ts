import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage";
import { logger } from "../logger";

// Extend Express Request to include authenticated vendor info
declare global {
  namespace Express {
    interface Request {
      apiVendor?: {
        id: string;
        name: string;
        apiKeyId: string;
      };
    }
  }
}

/**
 * Middleware to authenticate partner API requests using API keys.
 * Expects header: Authorization: Bearer <api_key>
 * 
 * Unlike session-based authentication for the web UI, this uses API key auth
 * suitable for programmatic access by AI vendors.
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing or invalid Authorization header. Expected format: Bearer <api_key>"
      });
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

    if (!apiKey || apiKey.length < 32) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid API key format"
      });
    }

    // Hash the provided API key to compare with stored hash
    // Note: We'll need to iterate through potential matches by prefix
    // For now, we'll do a simple hash comparison (production would optimize this)
    
    // Extract prefix for faster lookup (first 12 chars of the key)
    const keyPrefix = apiKey.substring(0, 12);
    
    // Get all API keys for this prefix (in production, we'd index by prefix)
    // For MVP, we'll check all active keys (small dataset)
    const allKeys = await getAllActiveApiKeys();
    
    let matchedKey = null;
    let matchedVendor = null;

    for (const storedKey of allKeys) {
      // Compare prefix first for performance
      if (storedKey.keyPrefix === keyPrefix) {
        // Then verify full hash
        const isValid = await bcrypt.compare(apiKey, storedKey.keyHash);
        if (isValid) {
          matchedKey = storedKey;
          // Get vendor info
          matchedVendor = await storage.getVendor(storedKey.vendorId);
          break;
        }
      }
    }

    if (!matchedKey || !matchedVendor) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid API key"
      });
    }

    // Update last used timestamp (async, don't await)
    storage.updateApiKeyLastUsed(matchedKey.id).catch(err => {
      logger.error({ err, apiKeyId: matchedKey.id }, "Failed to update API key last used timestamp");
    });

    // Attach vendor info to request
    req.apiVendor = {
      id: matchedVendor.id,
      name: matchedVendor.name,
      apiKeyId: matchedKey.id,
    };

    next();
  } catch (error) {
    logger.error({ err: error }, "API key authentication error");
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to authenticate API key"
    });
  }
}

/**
 * Helper to get all active API keys (for MVP)
 * In production, this would be optimized with database indexing by prefix
 */
async function getAllActiveApiKeys() {
  // For MVP, we'll query all vendors and their keys
  // This is acceptable for small datasets
  const vendors = await storage.getVendors();
  const allKeys = [];
  
  for (const vendor of vendors) {
    const keys = await storage.getVendorApiKeys(vendor.id);
    allKeys.push(...keys.filter(k => k.active));
  }
  
  return allKeys;
}
