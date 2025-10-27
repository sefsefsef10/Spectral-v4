import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Global test setup
beforeAll(async () => {
  // Initialize test environment
  // Can add test database setup here later if needed
  console.log('🧪 Test environment initialized');
});

afterAll(async () => {
  // Cleanup test environment
  console.log('✅ Test environment cleaned up');
});

beforeEach(() => {
  // Reset state before each test
  // Clear mocks, reset test data, etc.
});

afterEach(() => {
  // Cleanup after each test
});

// Global test utilities
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export function createTestDate(daysFromNow: number = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
}
