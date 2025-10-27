import { test, expect } from '@playwright/test';

test.describe('Translation Engine Customization (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Login as Enterprise customer
    await page.fill('input[name="email"]', 'enterprise@bighealth.com');
    await page.fill('input[name="password"]', 'EnterprisePass123!');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Constellation')).toBeVisible();
  });

  test('Enterprise: Override threshold for model drift', async ({ page }) => {
    await page.click('text=Customization');
    
    // Click override threshold button
    await page.click('button:has-text("Override Threshold")');
    
    // Fill override form
    await page.selectOption('select[name="eventType"]', 'model_drift');
    await page.fill('input[name="currentThreshold"]', '0.10');
    await page.fill('input[name="newThreshold"]', '0.15');
    await page.fill('textarea[name="justification"]', 'Clinical validation shows drift up to 15% is acceptable for this specific radiology use case');
    await page.fill('input[name="evidenceUrl"]', 'https://clinicaltrials.gov/study/NCT12345');
    
    // Submit for approval
    await page.click('button:has-text("Submit for Approval")');
    
    // Verify submission success
    await expect(page.locator('text=Customization request submitted')).toBeVisible();
  });

  test('Enterprise: Toggle non-critical control (allowed)', async ({ page }) => {
    await page.click('text=Customization');
    await page.click('[data-testid="control-toggles"]');
    
    // Find toggleable control
    const toggle = page.locator('[data-control="data_quality_issue"]').locator('input[type="checkbox"]');
    await toggle.click();
    
    // Save changes
    await page.click('button:has-text("Save Changes")');
    
    // Verify success
    await expect(page.locator('text=Controls updated successfully')).toBeVisible();
  });

  test('Enterprise: Cannot disable HIPAA controls (regulatory guardrail)', async ({ page }) => {
    await page.click('text=Customization');
    await page.click('[data-testid="control-toggles"]');
    
    // Attempt to disable HIPAA control
    const hipaaToggle = page.locator('[data-control="phi_exposure"]').locator('input[type="checkbox"]');
    
    // Should be disabled (not clickable)
    await expect(hipaaToggle).toBeDisabled();
    
    // Verify tooltip explanation
    await page.hover('[data-control="phi_exposure"]');
    await expect(page.locator('text=HIPAA controls cannot be disabled')).toBeVisible();
  });

  test('Enterprise: Request custom compliance control', async ({ page }) => {
    await page.click('text=Customization');
    await page.click('button:has-text("Request Custom Control")');
    
    // Fill custom control form
    await page.fill('input[name="controlName"]', 'Institutional Ethics Board Review');
    await page.fill('textarea[name="controlDescription"]', 'Require ethics board approval for all clinical AI deployments');
    await page.selectOption('select[name="triggerEventType"]', 'deployment_unauthorized');
    await page.selectOption('select[name="severity"]', 'critical');
    await page.fill('textarea[name="businessJustification"]', 'Our institution requires ethics board review per internal policy');
    
    // Submit request
    await page.click('button:has-text("Submit Custom Control Request")');
    
    // Verify submission
    await expect(page.locator('text=Custom control request submitted for approval')).toBeVisible();
  });

  test('Super Admin: Approve customization request', async ({ page }) => {
    // Logout and login as super admin
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Logout');
    
    await page.fill('input[name="email"]', 'superadmin@spectral.health');
    await page.fill('input[name="password"]', 'SuperAdminPass123!');
    await page.click('button[type="submit"]');
    
    // Navigate to pending approvals
    await page.click('text=Customization Approvals');
    
    // View pending request
    const pendingRequests = page.locator('[data-testid="pending-request"]');
    if (await pendingRequests.count() > 0) {
      await pendingRequests.first().click();
      
      // Review request details
      await expect(page.locator('h2:has-text("Customization Request")')).toBeVisible();
      
      // Approve
      await page.fill('textarea[name="reviewNotes"]', 'Clinical evidence supports this threshold adjustment');
      await page.click('button:has-text("Approve Request")');
      
      // Verify approval
      await expect(page.locator('text=Request approved')).toBeVisible();
    }
  });

  test('Super Admin: Reject customization request with feedback', async ({ page }) => {
    // Login as super admin
    await page.fill('input[name="email"]', 'superadmin@spectral.health');
    await page.fill('input[name="password"]', 'SuperAdminPass123!');
    await page.click('button[type="submit"]');
    
    await page.click('text=Customization Approvals');
    
    const pendingRequests = page.locator('[data-testid="pending-request"]');
    if (await pendingRequests.count() > 1) {
      await pendingRequests.nth(1).click();
      
      // Reject with feedback
      await page.fill('textarea[name="reviewNotes"]', 'Insufficient clinical evidence. Please provide peer-reviewed studies.');
      await page.click('button:has-text("Reject Request")');
      
      // Verify rejection
      await expect(page.locator('text=Request rejected')).toBeVisible();
    }
  });

  test('Foundation Tier: Cannot access customization (paywall)', async ({ page }) => {
    // Logout and login as Foundation tier customer
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Logout');
    
    await page.fill('input[name="email"]', 'foundation@smallclinic.com');
    await page.fill('input[name="password"]', 'FoundationPass123!');
    await page.click('button[type="submit"]');
    
    // Attempt to access customization
    await page.click('text=Customization');
    
    // Should see upgrade prompt
    await expect(page.locator('text=Upgrade to Enterprise')).toBeVisible();
    await expect(page.locator('button:has-text("Override Threshold")')).not.toBeVisible();
  });

  test('Enterprise: View audit trail of customizations', async ({ page }) => {
    await page.click('text=Customization');
    await page.click('[data-testid="audit-trail"]');
    
    // Verify audit entries
    await expect(page.locator('h2:has-text("Customization Audit Trail")')).toBeVisible();
    
    const auditEntries = page.locator('[data-testid="audit-entry"]');
    if (await auditEntries.count() > 0) {
      const firstEntry = auditEntries.first();
      
      // Verify required fields
      await expect(firstEntry.locator('[data-field="timestamp"]')).toBeVisible();
      await expect(firstEntry.locator('[data-field="action"]')).toBeVisible();
      await expect(firstEntry.locator('[data-field="user"]')).toBeVisible();
      await expect(firstEntry.locator('[data-field="status"]')).toBeVisible();
    }
  });
});
