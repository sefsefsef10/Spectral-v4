# E2E Test Suite

## Overview
End-to-end tests for Spectral Healthcare AI Governance Platform using Playwright.

## Test Fixtures
- `fixtures/test-users.json` - Pre-configured test users for different tiers (Foundation, Growth, Enterprise)
- `fixtures/test-ai-systems.json` - Sample AI systems for testing certification workflows

## Test Coverage
- **Compliance Workflow** (`compliance-workflow.spec.ts`) - Full certification flow from registration to PHI testing
- **Network Effects** (`network-effects.spec.ts`) - Marketplace features, vendor filtering, ROI calculator
- **Alert Management** (`alert-management.spec.ts`) - Alert dashboard and severity filtering
- **Executive Reporting** (`executive-reporting.spec.ts`) - Board-ready reports and analytics
- **Translation Engine Customization** (`translation-engine-customization.spec.ts`) - Threshold overrides and custom controls

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run specific test file
```bash
npx playwright test e2e/compliance-workflow.spec.ts
```

### Run in UI mode (debug)
```bash
npx playwright test --ui
```

## Test Users

### Foundation Tier
- Email: `admin@foundation.com`
- Password: `Test123!`
- Features: Basic compliance monitoring

### Growth Tier
- Email: `admin@growth.com`
- Password: `Test123!`
- Features: Advanced analytics, alerts

### Enterprise Tier
- Email: `admin@enterprise.com`
- Password: `Test123!`
- Features: Full customization, super admin controls

## CI/CD Integration
Tests run automatically on:
- Pull requests
- Main branch commits
- Nightly builds

## Debugging Failed Tests
1. Check `test-results/` for screenshots and traces
2. Run with `--debug` flag for step-by-step execution
3. Use `page.pause()` in tests for interactive debugging
