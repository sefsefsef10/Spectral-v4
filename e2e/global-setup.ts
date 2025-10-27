/**
 * Playwright Global Setup
 * Runs once before all E2E tests to setup test data
 */

import { chromium, FullConfig } from '@playwright/test';
import { setupAllTestUsers } from './helpers/test-data-setup';

async function globalSetup(config: FullConfig) {
  const baseURL = config.use?.baseURL || 'http://localhost:5000';
  
  console.log('\n=== E2E Test Global Setup ===');
  console.log(`Base URL: ${baseURL}`);
  
  // Create browser and context for API calls
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL,
  });
  
  try {
    // Setup all test users from fixtures
    await setupAllTestUsers(context.request);
    
    console.log('=== Setup Complete ===\n');
  } catch (error) {
    console.error('Setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
