import { test, expect } from '@playwright/test';

test.describe('E2E Infrastructure Smoke Test', () => {
  test('verifies Playwright test runner and viewport configuration', async ({ page }) => {
    // Assert viewport is properly configured per project
    const viewport = page.viewportSize();
    expect(viewport).toBeDefined();
    expect(viewport?.width).toBeGreaterThan(0);
    expect(viewport?.height).toBeGreaterThan(0);
  });
});
