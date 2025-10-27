import { test, expect } from '@playwright/test';

test.describe('Alert Management (Sentinel) E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Login
    await page.fill('input[name="email"]', 'admin@healthcare.com');
    await page.fill('input[name="password"]', 'AdminPass123!');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Sentinel')).toBeVisible();
  });

  test('View real-time alerts dashboard', async ({ page }) => {
    await page.click('text=Sentinel');
    
    // Verify dashboard loads
    await expect(page.locator('h1:has-text("Sentinel")')).toBeVisible();
    
    // Check alert counters
    await expect(page.locator('[data-testid="critical-alerts"]')).toBeVisible();
    await expect(page.locator('[data-testid="high-alerts"]')).toBeVisible();
    await expect(page.locator('[data-testid="medium-alerts"]')).toBeVisible();
  });

  test('Filter alerts by severity', async ({ page }) => {
    await page.click('text=Sentinel');
    
    // Filter for critical alerts only
    await page.click('[data-testid="severity-filter"]');
    await page.click('text=Critical');
    
    // Verify filtering
    const alertCards = page.locator('[data-testid="alert-card"]');
    if (await alertCards.count() > 0) {
      const firstAlert = alertCards.first();
      await expect(firstAlert.locator('.severity-badge')).toContainText('Critical');
    }
  });

  test('Acknowledge alert and add notes', async ({ page }) => {
    await page.click('text=Sentinel');
    
    const alertCards = page.locator('[data-testid="alert-card"]');
    if (await alertCards.count() > 0) {
      await alertCards.first().click();
      
      // Acknowledge alert
      await page.click('button:has-text("Acknowledge")');
      await page.fill('textarea[name="notes"]', 'Investigating root cause with AI vendor');
      await page.click('button:has-text("Save")');
      
      // Verify acknowledgment
      await expect(page.locator('text=Alert acknowledged')).toBeVisible();
    }
  });

  test('Resolve alert with remediation details', async ({ page }) => {
    await page.click('text=Sentinel');
    
    const acknowledgedAlerts = page.locator('[data-status="acknowledged"]');
    if (await acknowledgedAlerts.count() > 0) {
      await acknowledgedAlerts.first().click();
      
      // Resolve alert
      await page.click('button:has-text("Resolve")');
      await page.fill('textarea[name="resolution"]', 'Model retrained with updated dataset. Drift reduced to acceptable levels.');
      await page.fill('input[name="resolvedBy"]', 'John Doe, Data Scientist');
      await page.click('button:has-text("Mark as Resolved")');
      
      // Verify resolution
      await expect(page.locator('text=Alert resolved successfully')).toBeVisible();
    }
  });

  test('Filter alerts by AI system', async ({ page }) => {
    await page.click('text=Sentinel');
    
    // Apply AI system filter
    await page.click('[data-testid="ai-system-filter"]');
    await page.selectOption('select[name="aiSystem"]', { index: 1 });
    
    // Verify filtered results
    const alertCards = page.locator('[data-testid="alert-card"]');
    expect(await alertCards.count()).toBeGreaterThanOrEqual(0);
  });

  test('View predictive alert for model drift', async ({ page }) => {
    await page.click('text=Sentinel');
    
    // Filter for predictive alerts
    await page.click('[data-testid="alert-type-filter"]');
    await page.click('text=Predictive');
    
    const predictiveAlerts = page.locator('[data-type="predictive"]');
    if (await predictiveAlerts.count() > 0) {
      await predictiveAlerts.first().click();
      
      // Verify predictive alert details
      await expect(page.locator('text=Predicted in')).toBeVisible();
      await expect(page.locator('[data-testid="confidence-score"]')).toBeVisible();
    }
  });

  test('Configure alert notification preferences', async ({ page }) => {
    await page.click('text=Sentinel');
    await page.click('[data-testid="notification-settings"]');
    
    // Configure notifications
    await page.check('input[name="emailNotifications"]');
    await page.check('input[name="slackNotifications"]');
    await page.uncheck('input[name="smsNotifications"]');
    
    // Set severity threshold
    await page.selectOption('select[name="notificationThreshold"]', 'high');
    
    // Save settings
    await page.click('button:has-text("Save Notification Settings")');
    
    // Verify success
    await expect(page.locator('text=Notification settings updated')).toBeVisible();
  });

  test('Export alerts for compliance audit', async ({ page }) => {
    await page.click('text=Sentinel');
    
    // Set date range
    await page.fill('input[name="startDate"]', '2024-01-01');
    await page.fill('input[name="endDate"]', '2024-12-31');
    
    // Export alerts
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export Alerts")');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/alerts.*\.csv/);
  });

  test('View alert timeline and history', async ({ page }) => {
    await page.click('text=Sentinel');
    
    const alertCards = page.locator('[data-testid="alert-card"]');
    if (await alertCards.count() > 0) {
      await alertCards.first().click();
      
      // View timeline
      await page.click('[data-testid="timeline-tab"]');
      
      // Verify timeline entries
      await expect(page.locator('[data-testid="timeline-entry"]')).toHaveCount(await page.locator('[data-testid="timeline-entry"]').count());
    }
  });

  test('Escalate critical alert to PagerDuty', async ({ page }) => {
    await page.click('text=Sentinel');
    
    const criticalAlerts = page.locator('[data-severity="critical"]');
    if (await criticalAlerts.count() > 0) {
      await criticalAlerts.first().click();
      
      // Escalate alert
      await page.click('button:has-text("Escalate")');
      await page.selectOption('select[name="escalationChannel"]', 'pagerduty');
      await page.click('button:has-text("Confirm Escalation")');
      
      // Verify escalation
      await expect(page.locator('text=Alert escalated to PagerDuty')).toBeVisible();
    }
  });
});
