/**
 * 🔒 POLICY MIGRATION SCRIPT
 * 
 * One-time script to seed encrypted compliance policies into the database.
 * Run this to activate the IP moat.
 * 
 * Usage: tsx server/scripts/seed-policies.ts
 */

import { migratePolicies, validatePolicyCompleteness } from '../services/translation-engine/policy-migration';
import { logger } from '../logger';

const SYSTEM_USER_ID = 'system-migration';

async function main() {
  try {
    logger.info('🔒 Starting policy migration - activating IP moat...');
    
    // Seed all static policies into encrypted database
    await migratePolicies(SYSTEM_USER_ID);
    
    // Validate completeness
    const isComplete = await validatePolicyCompleteness();
    
    if (isComplete) {
      logger.info('✅ Policy migration complete - IP MOAT ACTIVATED');
      logger.info('🔒 All compliance policies are now encrypted and versioned in database');
      process.exit(0);
    } else {
      logger.error('❌ Policy migration incomplete - some policies missing');
      process.exit(1);
    }
  } catch (error) {
    logger.error({ error }, '❌ Policy migration failed');
    process.exit(1);
  }
}

main();
