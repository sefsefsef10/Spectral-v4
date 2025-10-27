import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-integration-secret';
  process.env.ENCRYPTION_KEY = 'test-integration-encryption-key32';
});

afterAll(async () => {
  // Cleanup test database connections
});
