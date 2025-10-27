import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'server/**/*.test.ts',
      'shared/**/*.test.ts',
      'tests/**/*.test.ts'  // New Clean Architecture test structure
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['server/**/*.ts', 'shared/**/*.ts'],
      exclude: [
        'server/**/*.test.ts',
        'tests/**/*.test.ts',
        'server/db.ts',
        'server/index.ts',
        'server/test/**',  // Legacy tests
        '**/node_modules/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@server': path.resolve(__dirname, './server'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
});
