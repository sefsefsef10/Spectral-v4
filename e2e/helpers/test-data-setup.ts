/**
 * E2E Test Data Setup Helpers
 * Programmatically creates test users and data via API calls
 */

import { APIRequestContext } from '@playwright/test';
import testUsers from '../fixtures/test-users.json' assert { type: 'json' };

export interface TestUser {
  email: string;
  password: string;
  name: string;
  tier: string;
  role: string;
}

/**
 * Create a test health system user via API
 */
export async function createTestHealthSystem(
  request: APIRequestContext,
  user: TestUser
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    const response = await request.post('/api/auth/register', {
      data: {
        email: user.email,
        password: user.password,
        organizationName: user.name,
        fullName: user.name,
      },
    });

    if (response.ok()) {
      const data = await response.json();
      return { success: true, userId: data.userId || data.id };
    }

    // User might already exist - that's OK for E2E tests
    if (response.status() === 409 || response.status() === 400) {
      return { success: true }; // Already exists
    }

    return {
      success: false,
      error: `Registration failed: ${response.status()} ${response.statusText()}`,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Setup all test users from fixtures
 */
export async function setupAllTestUsers(request: APIRequestContext): Promise<void> {
  console.log('Setting up test users from fixtures...');

  for (const user of testUsers.healthSystems) {
    const result = await createTestHealthSystem(request, user as TestUser);
    if (result.success) {
      console.log(`✓ User ${user.email} ready`);
    } else {
      console.warn(`✗ User ${user.email} failed: ${result.error}`);
    }
  }

  console.log('Test user setup complete');
}

/**
 * Login as a test user and return session cookie
 */
export async function loginAsTestUser(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<{ success: boolean; cookie?: string; error?: string }> {
  try {
    const response = await request.post('/api/auth/login', {
      data: { email, password },
    });

    if (response.ok()) {
      const cookies = response.headers()['set-cookie'];
      return { success: true, cookie: cookies };
    }

    return {
      success: false,
      error: `Login failed: ${response.status()} ${response.statusText()}`,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get test user by tier
 */
export function getTestUserByTier(tier: 'foundation' | 'growth' | 'enterprise'): TestUser {
  const user = testUsers.healthSystems.find((u) => u.tier === tier);
  if (!user) {
    throw new Error(`No test user found for tier: ${tier}`);
  }
  return user as TestUser;
}

/**
 * Get all test users
 */
export function getAllTestUsers(): TestUser[] {
  return testUsers.healthSystems as TestUser[];
}
