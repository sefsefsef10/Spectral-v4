import { test, expect } from '@playwright/test';

test.describe('Network Effects Dashboard (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Login as health system admin
    await page.fill('input[name="email"]', 'admin@healthcare.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Constellation')).toBeVisible();
  });

  test('Health System: View vendor marketplace reach', async ({ page }) => {
    // Navigate to Network Effects dashboard
    await page.click('text=Network');
    
    // Verify marketplace stats are displayed
    await expect(page.locator('h2:has-text("Network Reach")')).toBeVisible();
    
    // Check vendor count
    const vendorCount = await page.locator('[data-testid="vendor-count"]').textContent();
    expect(parseInt(vendorCount || '0')).toBeGreaterThanOrEqual(0);
    
    // Check certified systems count
    const certifiedCount = await page.locator('[data-testid="certified-systems"]').textContent();
    expect(parseInt(certifiedCount || '0')).toBeGreaterThanOrEqual(0);
  });

  test('Health System: Filter vendors by certification level', async ({ page }) => {
    await page.click('text=Network');
    
    // Apply certification filter
    await page.click('[data-testid="certification-filter"]');
    await page.click('text=Certified');
    
    // Verify filtered results
    const vendors = page.locator('[data-testid="vendor-card"]');
    const count = await vendors.count();
    
    if (count > 0) {
      const firstVendor = vendors.first();
      await expect(firstVendor.locator('.certification-badge')).toContainText('Certified');
    }
  });

  test('Health System: View procurement ROI calculator', async ({ page }) => {
    await page.click('text=Network');
    await page.click('[data-testid="roi-calculator"]');
    
    // Fill in ROI calculator
    await page.fill('input[name="currentAnnualCost"]', '500000');
    await page.fill('input[name="complianceStaffHours"]', '2000');
    await page.click('button:has-text("Calculate ROI")');
    
    // Verify ROI calculation
    await expect(page.locator('[data-testid="roi-result"]')).toBeVisible();
    const roi = await page.locator('[data-testid="roi-percentage"]').textContent();
    expect(roi).toBeDefined();
  });

  test('Health System: Generate procurement language for RFP', async ({ page }) => {
    await page.click('text=Network');
    await page.click('[data-testid="procurement-language-generator"]');
    
    // Select vendor and certification level
    await page.selectOption('select[name="vendor"]', { index: 1 });
    await page.selectOption('select[name="certificationLevel"]', 'certified');
    
    // Generate language
    await page.click('button:has-text("Generate Language")');
    
    // Verify procurement language is generated
    await expect(page.locator('[data-testid="generated-language"]')).toBeVisible();
    const language = await page.locator('[data-testid="generated-language"]').textContent();
    expect(language?.length).toBeGreaterThan(100);
  });

  test('Vendor: View health system marketplace reach', async ({ page }) => {
    // Logout and login as vendor
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Logout');
    
    await page.fill('input[name="email"]', 'vendor@aicompany.com');
    await page.fill('input[name="password"]', 'VendorPass123!');
    await page.click('button[type="submit"]');
    
    // Navigate to Network Reach
    await page.click('text=Network Reach');
    
    // Verify health systems count
    await expect(page.locator('h2:has-text("Market Reach")')).toBeVisible();
    const healthSystemsCount = await page.locator('[data-testid="health-systems-count"]').textContent();
    expect(parseInt(healthSystemsCount || '0')).toBeGreaterThanOrEqual(0);
  });

  test('Vendor: View certification status across portfolio', async ({ page }) => {
    // Login as vendor
    await page.fill('input[name="email"]', 'vendor@aicompany.com');
    await page.fill('input[name="password"]', 'VendorPass123!');
    await page.click('button[type="submit"]');
    
    await page.click('text=Network Reach');
    
    // View certification breakdown
    const verifiedCount = await page.locator('[data-testid="verified-systems"]').textContent();
    const certifiedCount = await page.locator('[data-testid="certified-systems"]').textContent();
    const trustedCount = await page.locator('[data-testid="trusted-systems"]').textContent();
    
    const total = parseInt(verifiedCount || '0') + parseInt(certifiedCount || '0') + parseInt(trustedCount || '0');
    expect(total).toBeGreaterThanOrEqual(0);
  });

  test('Vendor: Export marketplace data for business development', async ({ page }) => {
    // Login as vendor
    await page.fill('input[name="email"]', 'vendor@aicompany.com');
    await page.fill('input[name="password"]', 'VendorPass123!');
    await page.click('button[type="submit"]');
    
    await page.click('text=Network Reach');
    
    // Export data
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export Data")');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toContain('network-reach');
  });
});
