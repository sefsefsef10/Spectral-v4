import { beforeAll, afterAll, beforeEach } from 'vitest';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-secret-key-for-testing-only';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes!!';
});

afterAll(async () => {
  // Cleanup after all tests
});

beforeEach(() => {
  // Reset mocks before each test
});
