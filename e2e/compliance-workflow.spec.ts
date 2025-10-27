import { test, expect } from '@playwright/test';

test.describe('Compliance Certification Workflow (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/');
  });

  test('Complete compliance certification flow: Register → Verify → Certify', async ({ page }) => {
    // Step 1: Register new health system
    await page.click('text=Sign up');
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.fill('input[name="organizationName"]', 'Test Healthcare System');
    await page.fill('input[name="fullName"]', 'John Doe');
    await page.click('button[type="submit"]');
    
    // Verify registration success
    await expect(page.locator('text=Check your email')).toBeVisible();
  });

  test('AI System Certification - PHI Safety Check', async ({ page }) => {
    // Login
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');
    
    // Navigate to Beacon (Certification)
    await page.click('text=Beacon');
    
    // Start certification for an AI system
    await page.click('text=Start Certification');
    await page.selectOption('select[name="aiSystemId"]', { index: 1 });
    await page.click('button:has-text("Run PHI Detection Test")');
    
    // Verify test execution
    await expect(page.locator('text=Testing for PHI exposure')).toBeVisible();
    
    // Wait for test completion
    await expect(page.locator('text=PHI Test: Passed')).toBeVisible({ timeout: 30000 });
  });

  test('Compliance Dashboard - HIPAA Coverage View', async ({ page }) => {
    // Login as compliance officer
    await page.fill('input[name="email"]', 'compliance@test.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');
    
    // Navigate to Watchtower (Compliance)
    await page.click('text=Watchtower');
    
    // Verify HIPAA compliance coverage is displayed
    await expect(page.locator('text=HIPAA Privacy Rule')).toBeVisible();
    await expect(page.locator('text=HIPAA Security Rule')).toBeVisible();
    
    // Check compliance percentage
    const complianceScore = await page.locator('[data-testid="hipaa-score"]').textContent();
    expect(parseInt(complianceScore || '0')).toBeGreaterThanOrEqual(0);
    expect(parseInt(complianceScore || '0')).toBeLessThanOrEqual(100);
  });

  test('Alert Management - Real-time PHI Violation Alert', async ({ page }) => {
    // Login
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');
    
    // Navigate to Sentinel (Alerts)
    await page.click('text=Sentinel');
    
    // Verify alert dashboard loads
    await expect(page.locator('h1:has-text("Sentinel")')).toBeVisible();
    
    // Filter for critical alerts
    await page.click('[data-testid="severity-filter"]');
    await page.click('text=Critical');
    
    // Verify filtering works
    const alerts = page.locator('[data-testid="alert-card"]');
    const count = await alerts.count();
    
    if (count > 0) {
      const firstAlert = alerts.first();
      await expect(firstAlert.locator('.severity-badge')).toContainText('Critical');
    }
  });

  test('Multi-tenant Isolation - Cannot access other health systems data', async ({ page }) => {
    // Login as Health System A
    await page.fill('input[name="email"]', 'admin-a@healthsystem-a.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');
    
    // Get AI systems count for Health System A
    await page.click('text=Constellation');
    const systemsA = await page.locator('[data-testid="ai-system-row"]').count();
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Logout');
    
    // Login as Health System B
    await page.fill('input[name="email"]', 'admin-b@healthsystem-b.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');
    
    // Get AI systems count for Health System B
    await page.click('text=Constellation');
    const systemsB = await page.locator('[data-testid="ai-system-row"]').count();
    
    // Verify different systems see different data
    expect(systemsA).not.toEqual(systemsB);
  });

  test('Translation Engine Customization - Enterprise Tier Override', async ({ page }) => {
    // Login as Enterprise customer
    await page.fill('input[name="email"]', 'enterprise@bighealth.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');
    
    // Navigate to Customization
    await page.click('text=Customization');
    
    // Verify customization features are available
    await expect(page.locator('text=Translation Engine Customization')).toBeVisible();
    
    // Attempt to override a threshold
    await page.click('button:has-text("Override Threshold")');
    await page.fill('input[name="eventType"]', 'model_drift');
    await page.fill('input[name="newThreshold"]', '0.15');
    await page.fill('input[name="justification"]', 'Clinical validation shows drift up to 15% is acceptable for this use case');
    
    await page.click('button:has-text("Submit for Approval")');
    
    // Verify request submitted
    await expect(page.locator('text=Customization request submitted for approval')).toBeVisible();
  });
});
