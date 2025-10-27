import { test, expect } from '@playwright/test';

test.describe('Executive Reporting (Constellation) E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Login as executive/admin
    await page.fill('input[name="email"]', 'ceo@healthcare.com');
    await page.fill('input[name="password"]', 'ExecutivePass123!');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Constellation')).toBeVisible();
  });

  test('View AI portfolio overview dashboard', async ({ page }) => {
    await page.click('text=Constellation');
    
    // Verify key metrics are displayed
    await expect(page.locator('[data-testid="total-ai-systems"]')).toBeVisible();
    await expect(page.locator('[data-testid="overall-compliance-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="critical-violations"]')).toBeVisible();
    
    // Verify charts are rendered
    await expect(page.locator('[data-testid="risk-distribution-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="compliance-trend-chart"]')).toBeVisible();
  });

  test('Generate board-ready executive summary', async ({ page }) => {
    await page.click('text=Constellation');
    await page.click('button:has-text("Generate Executive Summary")');
    
    // Verify summary generation
    await expect(page.locator('[data-testid="executive-summary"]')).toBeVisible();
    
    // Check for narrative generation
    const narrative = await page.locator('[data-testid="ai-narrative"]').textContent();
    expect(narrative?.length).toBeGreaterThan(200);
  });

  test('Export compliance report for board meeting', async ({ page }) => {
    await page.click('text=Constellation');
    
    // Export report
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export PDF Report")');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/board-report.*\.pdf/);
  });

  test('View AI system risk heatmap', async ({ page }) => {
    await page.click('text=Constellation');
    await page.click('[data-testid="risk-heatmap-tab"]');
    
    // Verify heatmap visualization
    await expect(page.locator('[data-testid="risk-heatmap"]')).toBeVisible();
    
    // Click on high-risk system
    const highRiskSystems = page.locator('[data-risk="high"]');
    if (await highRiskSystems.count() > 0) {
      await highRiskSystems.first().click();
      
      // Verify system details modal
      await expect(page.locator('[data-testid="system-details-modal"]')).toBeVisible();
    }
  });

  test('Filter AI systems by department', async ({ page }) => {
    await page.click('text=Constellation');
    
    // Apply department filter
    await page.click('[data-testid="department-filter"]');
    await page.click('text=Radiology');
    
    // Verify filtered results
    const systemCards = page.locator('[data-testid="ai-system-card"]');
    if (await systemCards.count() > 0) {
      await expect(systemCards.first().locator('[data-field="department"]')).toContainText('Radiology');
    }
  });

  test('Schedule automated monthly reports', async ({ page }) => {
    await page.click('text=Constellation');
    await page.click('[data-testid="schedule-reports"]');
    
    // Configure report schedule
    await page.selectOption('select[name="frequency"]', 'monthly');
    await page.fill('input[name="recipientEmail"]', 'board@healthcare.com');
    await page.click('button:has-text("Save Schedule")');
    
    // Verify success
    await expect(page.locator('text=Report schedule saved')).toBeVisible();
  });

  test('View compliance framework breakdown', async ({ page }) => {
    await page.click('text=Constellation');
    await page.click('[data-testid="framework-breakdown-tab"]');
    
    // Verify framework sections
    await expect(page.locator('text=HIPAA Compliance')).toBeVisible();
    await expect(page.locator('text=NIST AI RMF')).toBeVisible();
    await expect(page.locator('text=FDA SaMD')).toBeVisible();
    
    // Check compliance percentages
    const hipaaScore = await page.locator('[data-framework="HIPAA"]').locator('[data-testid="score"]').textContent();
    expect(parseInt(hipaaScore || '0')).toBeGreaterThanOrEqual(0);
    expect(parseInt(hipaaScore || '0')).toBeLessThanOrEqual(100);
  });
});
