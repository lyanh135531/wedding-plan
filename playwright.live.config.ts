import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/live',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  maxFailures: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/live', open: 'never' }], ['json', { outputFile: 'test-results/g11/live-results.json' }]],
  outputDir: 'test-results/live',
  use: { actionTimeout: 15_000, baseURL: process.env.PLAYWRIGHT_BASE_URL, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'Live 360', use: { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true } },
    { name: 'Live 390', use: { ...devices['iPhone 14'] } },
    { name: 'Live 768', use: { ...devices['iPad Mini'] } },
    { name: 'Live 1440', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
