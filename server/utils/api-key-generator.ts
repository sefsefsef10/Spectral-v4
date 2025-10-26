import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

/**
 * Generate a secure API key for vendor partner API access.
 * 
 * Format: sk_live_<32_random_chars>
 * Example: sk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
 * 
 * The key is designed to be:
 * - Secure: 32 random bytes encoded in base64
 * - Identifiable: Prefix indicates environment (sk_live_ or sk_test_)
 * - Easy to store: We store bcrypt hash + prefix for validation
 * 
 * @param environment - "live" for production, "test" for development
 * @returns Object with plaintext key (show once) and hash + prefix (store in DB)
 */
export async function generateApiKey(environment: "live" | "test" = "live") {
  // Generate 32 random bytes
  const randomPart = randomBytes(32).toString("base64")
    .replace(/\+/g, "A")
    .replace(/\//g, "B")
    .replace(/=/g, "C")
    .substring(0, 32);
  
  const prefix = environment === "live" ? "sk_live_" : "sk_test_";
  const fullKey = `${prefix}${randomPart}`;
  
  // Hash the full key for storage
  const keyHash = await bcrypt.hash(fullKey, 10);
  
  // Store first 12 chars for quick lookup/identification
  const keyPrefix = fullKey.substring(0, 12);
  
  return {
    // Show this ONCE to the user, then never again
    key: fullKey,
    
    // Store these in the database
    keyHash,
    keyPrefix,
  };
}

/**
 * Validate an API key format (without database lookup)
 * Useful for quick validation before expensive hash comparison
 */
export function isValidApiKeyFormat(key: string): boolean {
  const pattern = /^sk_(live|test)_[A-Za-z0-9]{32}$/;
  return pattern.test(key);
}
