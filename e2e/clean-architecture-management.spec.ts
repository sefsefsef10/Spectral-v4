/**
 * E2E Tests for Clean Architecture Management Interface
 * 
 * Tests user management, alert management, and deployment management flows
 * with full UI interaction validation.
 */

import { test, expect } from '@playwright/test';

test.describe('Clean Architecture Management Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/management');
  });

  test.describe('User Management', () => {
    test('should display user management tab and register new user', async ({ page }) => {
      await expect(page.getByRole('tab', { name: /user management/i })).toBeVisible();
      await page.getByRole('tab', { name: /user management/i }).click();

      await expect(page.getByRole('heading', { name: /register new user/i })).toBeVisible();
      
      await page.getByLabel(/email/i).fill('test.user@spectral.health');
      await page.getByLabel(/password/i).fill('SecurePass123!');
      await page.getByLabel(/health system id/i).fill('hs-test-001');
      await page.getByLabel(/role/i).selectOption('analyst');

      await page.getByRole('button', { name: /register user/i }).click();

      await expect(page.getByText(/user registered successfully/i)).toBeVisible({ timeout: 5000 });
    });

    test('should validate password requirements', async ({ page }) => {
      await page.getByRole('tab', { name: /user management/i }).click();
      
      await page.getByLabel(/email/i).fill('weak@spectral.health');
      await page.getByLabel(/password/i).fill('short');
      await page.getByLabel(/health system id/i).fill('hs-test-001');
      
      await page.getByRole('button', { name: /register user/i }).click();

      await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible({ timeout: 5000 });
    });

    test('should update user role', async ({ page }) => {
      await page.getByRole('tab', { name: /user management/i }).click();

      const roleUpdateSection = page.locator('text=Update User Role').locator('..');
      await roleUpdateSection.getByLabel(/user id/i).fill('user-123');
      await roleUpdateSection.getByLabel(/new role/i).selectOption('admin');

      await roleUpdateSection.getByRole('button', { name: /update role/i }).click();

      await expect(page.getByText(/role updated successfully/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Alert Management', () => {
    test('should display alert management tab and create critical alert', async ({ page }) => {
      await page.getByRole('tab', { name: /alert management/i }).click();

      await expect(page.getByRole('heading', { name: /create new alert/i })).toBeVisible();

      await page.getByLabel(/ai system id/i).fill('ai-system-critical-001');
      await page.getByLabel(/alert type/i).selectOption('phi_exposure');
      await page.getByLabel(/message/i).fill('Critical PHI exposure detected in production logs');

      await page.getByRole('button', { name: /create alert/i }).click();

      await expect(page.getByText(/alert created successfully/i)).toBeVisible({ timeout: 5000 });
      
      await expect(page.getByText(/severity: critical/i)).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/sla deadline:/i)).toBeVisible();
    });

    test('should display SLA countdown timer for alerts', async ({ page }) => {
      await page.getByRole('tab', { name: /alert management/i }).click();

      await page.getByLabel(/ai system id/i).fill('ai-system-test-sla');
      await page.getByLabel(/alert type/i).selectOption('performance_degradation');
      await page.getByLabel(/message/i).fill('Test alert for SLA validation');

      await page.getByRole('button', { name: /create alert/i }).click();
      
      await expect(page.getByText(/time remaining:/i)).toBeVisible({ timeout: 5000 });
    });

    test('should acknowledge and resolve alert', async ({ page }) => {
      await page.getByRole('tab', { name: /alert management/i }).click();

      await page.getByLabel(/ai system id/i).fill('ai-system-resolve-test');
      await page.getByLabel(/alert type/i).selectOption('bias_detected');
      await page.getByLabel(/message/i).fill('Bias detected in model predictions');
      
      await page.getByRole('button', { name: /create alert/i }).click();
      await expect(page.getByText(/alert created successfully/i)).toBeVisible({ timeout: 5000 });

      const alertRow = page.locator('text=Bias detected in model predictions').locator('..');
      
      await alertRow.getByRole('button', { name: /acknowledge/i }).click();
      await expect(page.getByText(/alert acknowledged/i)).toBeVisible({ timeout: 5000 });

      await alertRow.getByRole('button', { name: /resolve/i }).click();
      await expect(page.getByText(/alert resolved/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Deployment Management', () => {
    test('should display deployment management tab and create canary deployment', async ({ page }) => {
      await page.getByRole('tab', { name: /deployment management/i }).click();

      await expect(page.getByRole('heading', { name: /create new deployment/i })).toBeVisible();

      await page.getByLabel(/ai system id/i).fill('ai-system-deploy-001');
      await page.getByLabel(/version/i).fill('v2.5.0');
      await page.getByLabel(/strategy/i).selectOption('canary');

      await page.getByRole('button', { name: /create deployment/i }).click();

      await expect(page.getByText(/deployment created successfully/i)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/canary percentage: 10%/i)).toBeVisible({ timeout: 3000 });
    });

    test('should execute health check on deployment', async ({ page }) => {
      await page.getByRole('tab', { name: /deployment management/i }).click();

      await page.getByLabel(/ai system id/i).fill('ai-system-health-check');
      await page.getByLabel(/version/i).fill('v3.0.0');
      await page.getByLabel(/strategy/i).selectOption('blue_green');

      await page.getByRole('button', { name: /create deployment/i }).click();
      await expect(page.getByText(/deployment created successfully/i)).toBeVisible({ timeout: 5000 });

      const deploymentRow = page.locator('text=v3.0.0').locator('..');
      
      await deploymentRow.getByRole('button', { name: /run health check/i }).click();
      await expect(page.getByText(/health check (completed|passed)/i)).toBeVisible({ timeout: 5000 });
    });

    test('should advance canary deployment', async ({ page }) => {
      await page.getByRole('tab', { name: /deployment management/i }).click();

      await page.getByLabel(/ai system id/i).fill('ai-system-canary-advance');
      await page.getByLabel(/version/i).fill('v4.0.0');
      await page.getByLabel(/strategy/i).selectOption('canary');

      await page.getByRole('button', { name: /create deployment/i }).click();
      await expect(page.getByText(/deployment created successfully/i)).toBeVisible({ timeout: 5000 });

      const deploymentRow = page.locator('text=v4.0.0').locator('..');
      
      await deploymentRow.getByRole('button', { name: /advance canary/i }).click();
      await expect(page.getByText(/canary (advanced|percentage: 20%)/i)).toBeVisible({ timeout: 5000 });
    });

    test('should trigger rollback on deployment', async ({ page }) => {
      await page.getByRole('tab', { name: /deployment management/i }).click();

      await page.getByLabel(/ai system id/i).fill('ai-system-rollback-test');
      await page.getByLabel(/version/i).fill('v5.0.0-beta');
      await page.getByLabel(/strategy/i).selectOption('rolling');

      await page.getByRole('button', { name: /create deployment/i }).click();
      await expect(page.getByText(/deployment created successfully/i)).toBeVisible({ timeout: 5000 });

      const deploymentRow = page.locator('text=v5.0.0-beta').locator('..');
      
      await deploymentRow.getByRole('button', { name: /rollback/i }).click();
      await expect(page.getByText(/rollback (initiated|successful)/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Cross-Tab Integration', () => {
    test('should switch between management tabs without losing state', async ({ page }) => {
      await page.getByRole('tab', { name: /user management/i }).click();
      await expect(page.getByRole('heading', { name: /register new user/i })).toBeVisible();

      await page.getByRole('tab', { name: /alert management/i }).click();
      await expect(page.getByRole('heading', { name: /create new alert/i })).toBeVisible();

      await page.getByRole('tab', { name: /deployment management/i }).click();
      await expect(page.getByRole('heading', { name: /create new deployment/i })).toBeVisible();

      await page.getByRole('tab', { name: /user management/i }).click();
      await expect(page.getByRole('heading', { name: /register new user/i })).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await expect(page.getByRole('tab', { name: /user management/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /alert management/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /deployment management/i })).toBeVisible();
    });

    test('should display correctly on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await page.getByRole('tab', { name: /user management/i }).click();
      await expect(page.getByRole('heading', { name: /register new user/i })).toBeVisible();
    });
  });
});
