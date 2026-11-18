import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Wedding Management Web (Milestone R1).
 * Configured with 4 mandatory viewports:
 * 1. Mobile Narrow: 360 x 640 (Galaxy S8 / Minimal Android Spec)
 * 2. Mobile Standard: 390 x 844 (iPhone 12/13/14 / Safari Mobile)
 * 3. Tablet: 768 x 1024 (iPad Mini / Portrait)
 * 4. Desktop: 1440 x 900 (Desktop Chrome / 240px Permanent Sidebar)
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/components', open: 'never' }],
  ],
  outputDir: 'test-results/components',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Mobile Narrow (360x640)',
      use: {
        viewport: { width: 360, height: 640 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'Mobile Standard (390x844)',
      use: {
        ...(devices['iPhone 14'] || {}),
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'Tablet (768x1024)',
      use: {
        ...(devices['iPad Mini'] || {}),
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'Desktop (1440x900)',
      use: {
        ...(devices['Desktop Chrome'] || {}),
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  /* Optional local dev web server */
  ...(process.env.START_SERVER
    ? {
        webServer: {
          command: 'pnpm dev',
          url: 'http://127.0.0.1:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
