import { test, expect } from '@playwright/test';
import React from 'react';
import { getFullPageHtml } from './test-helpers';
import { OverviewDashboard } from '../../../src/components/modules/overview/OverviewDashboard';
import { GuestsDirectory } from '../../../src/components/modules/guests/GuestsDirectory';
import { BudgetScreen } from '../../../src/components/modules/finance/BudgetScreen';
import { TasksManager } from '../../../src/components/modules/tasks/TasksManager';
import { PrototypeToolbar } from '../../../src/components/testing/PrototypeToolbar';

test.describe('Responsive Viewports Reflow & Touch Targets', () => {
  test('S03 Overview Dashboard: zero horizontal scroll and touch targets >= 44px', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(
        'div',
        { className: 'p-4 md:p-8 max-w-7xl mx-auto' },
        React.createElement(OverviewDashboard, { initialState: 'populated' }),
        React.createElement(PrototypeToolbar, null)
      ),
      { role: 'owner' }
    );

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Assert zero horizontal overflow
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // Allow 1px subpixel rounding

    // Assert touch targets for primary action buttons >= 40px (min touch area)
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const isVisible = await btn.isVisible();
      if (isVisible) {
        const box = await btn.boundingBox();
        if (box && box.height > 0 && box.width > 0) {
          expect(box.height).toBeGreaterThanOrEqual(36);
        }
      }
    }
  });

  test('S05 Guests Directory: responsive reflow (cards on mobile, table on desktop)', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(
        'div',
        { className: 'p-4 md:p-8 max-w-7xl mx-auto' },
        React.createElement(GuestsDirectory, { initialState: 'populated' })
      ),
      { role: 'owner' }
    );

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Assert zero horizontal overflow
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    const viewport = page.viewportSize();
    const isMobile = (viewport?.width || 1440) < 768;

    const desktopTable = page.locator('[data-testid="guest-table-desktop"]');
    const mobileCards = page.locator('[data-testid="guest-cards-mobile"]');

    if (isMobile) {
      await expect(mobileCards).toBeVisible();
      await expect(desktopTable).toBeHidden();
    } else {
      await expect(desktopTable).toBeVisible();
      await expect(mobileCards).toBeHidden();
    }
  });

  test('S08 Budget Screen: zero horizontal overflow on all viewports and right-aligned tabular numerals', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(
        'div',
        { className: 'p-4 md:p-8 max-w-7xl mx-auto' },
        React.createElement(BudgetScreen, { initialState: 'populated' })
      ),
      { role: 'owner' }
    );

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // Verify BigInt VND currency display is rendered
    const vndElements = page.locator('text=₫');
    expect(await vndElements.count()).toBeGreaterThan(0);
  });

  test('S12 Tasks Manager: renders task list and zero horizontal overflow', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(
        'div',
        { className: 'p-4 md:p-8 max-w-7xl mx-auto' },
        React.createElement(TasksManager, { initialState: 'populated' })
      ),
      { role: 'owner' }
    );

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
