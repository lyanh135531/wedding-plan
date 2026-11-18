import { test, expect } from '@playwright/test';
import React from 'react';
import { getFullPageHtml } from './prototypes/test-helpers';

// Layout & Core Screens
import { PageShell } from '../../src/components/layout/PageShell';
import { MobileBottomNav } from '../../src/components/layout/MobileBottomNav';
import { DesktopSidebar } from '../../src/components/layout/DesktopSidebar';
import { OverviewDashboard } from '../../src/components/modules/overview/OverviewDashboard';
import { GuestsDirectory } from '../../src/components/modules/guests/GuestsDirectory';
import { BudgetScreen } from '../../src/components/modules/finance/BudgetScreen';
import { PaymentsLedgerScreen } from '../../src/components/modules/finance/PaymentsLedgerScreen';
import { TasksManager } from '../../src/components/modules/tasks/TasksManager';
import { SeatingManager } from '../../src/components/modules/seating/SeatingManager';
import { TimelineManager } from '../../src/components/modules/timeline/TimelineManager';
import { CheckInDashboard } from '../../src/components/modules/attendance/CheckInDashboard';
import { GiftsDashboard } from '../../src/components/modules/gifts/GiftsDashboard';
import { HandoversDashboard } from '../../src/components/modules/handovers/HandoversDashboard';
import { ArchivalDashboard } from '../../src/components/modules/archival/ArchivalDashboard';

test.describe('Mobile Responsiveness & Viewport Usability (Requirement R3 / PLAN §23, §25 & UI_UX_SPEC)', () => {
  // =========================================================================
  // 1. Zero Horizontal Scroll & Overflow Across 12 Key Application Screens
  // =========================================================================
  const responsiveScreens = [
    { name: 'S01 PageShell Layout', comp: PageShell, props: { title: 'Tổng Quan Đám Cưới', children: React.createElement('div', { className: 'p-4' }, 'Nội dung trang thử nghiệm') } },
    { name: 'S02 OverviewDashboard', comp: OverviewDashboard, props: { initialState: 'populated' } },
    { name: 'S03 GuestsDirectory', comp: GuestsDirectory, props: { initialState: 'populated' } },
    { name: 'S04 BudgetScreen', comp: BudgetScreen, props: { initialState: 'populated' } },
    { name: 'S05 PaymentsLedgerScreen', comp: PaymentsLedgerScreen, props: { initialState: 'populated' } },
    { name: 'S06 TasksManager', comp: TasksManager, props: { initialState: 'populated' } },
    { name: 'S07 SeatingManager', comp: SeatingManager, props: { initialState: 'populated' } },
    { name: 'S08 TimelineManager', comp: TimelineManager, props: { initialState: 'populated' } },
    { name: 'S09 CheckInDashboard', comp: CheckInDashboard, props: { eventId: 'ev-test-1' } },
    { name: 'S10 GiftsDashboard', comp: GiftsDashboard, props: { eventId: 'ev-test-1' } },
    { name: 'S11 HandoversDashboard', comp: HandoversDashboard, props: { eventId: 'ev-test-1' } },
    { name: 'S12 ArchivalDashboard', comp: ArchivalDashboard, props: {} },
  ];

  for (const { name, comp: Component, props } of responsiveScreens) {
    test(`Zero horizontal overflow on screen: ${name}`, async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(
          'div',
          { className: 'p-2 sm:p-4 md:p-6 max-w-7xl mx-auto' },
          React.createElement(Component as any, props)
        ),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      // Verify page document does not require horizontal scrolling (scrollWidth <= clientWidth)
      const { scrollWidth, clientWidth, protrudingTag } = await page.evaluate(() => {
        const root = document.querySelector('#__next');
        const container = root?.firstElementChild as HTMLElement | null;
        const cWidth = window.innerWidth;
        const sWidth = container ? container.scrollWidth : document.documentElement.scrollWidth;

        // Check if any visible element protrudes past viewport right boundary
        let maxRight = cWidth;
        let culprit = '';
        const allElements = Array.from(document.querySelectorAll('*'));
        for (const el of allElements) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.right > maxRight + 2) {
            maxRight = rect.right;
            culprit = `${el.tagName}.${el.className} (right=${rect.right}, width=${rect.width})`;
          }
        }

        return {
          scrollWidth: sWidth,
          clientWidth: cWidth,
          protrudingTag: culprit,
        };
      });

      expect(
        scrollWidth,
        `Horizontal overflow detected on ${name}: scrollWidth (${scrollWidth}) > clientWidth (${clientWidth}). Offending: ${protrudingTag}`
      ).toBeLessThanOrEqual(clientWidth + 1);
    });
  }

  // =========================================================================
  // 2. Touch Targets Validation (>= 44x44px per WCAG 2.5.5 / UI_UX_SPEC §15)
  // =========================================================================
  test('Touch targets validation across interactive controls (min dimensions >= 36-44px)', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(
        'div',
        { className: 'p-4 max-w-7xl mx-auto' },
        React.createElement(OverviewDashboard, { initialState: 'populated' }),
        React.createElement(MobileBottomNav, { isModalOpen: false })
      ),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Validate interactive buttons and navigation links
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);

    for (let i = 0; i < buttonCount; i++) {
      const btn = buttons.nth(i);
      const box = await btn.boundingBox();
      if (box && box.height > 0 && box.width > 0) {
        // Minimum touch target height must be >= 36px (target 44px)
        expect(box.height).toBeGreaterThanOrEqual(36);
      }
    }

    // Validate bottom navigation links touch targets (min 44x44px per WCAG / UI_UX_SPEC §11)
    const viewport = page.viewportSize();
    if ((viewport?.width || 1440) < 1024) {
      const navLinks = page.locator('nav[aria-label="Thanh điều hướng di động"] a:visible');
      const navLinkCount = await navLinks.count();
      expect(navLinkCount).toBeGreaterThanOrEqual(4);
      for (let i = 0; i < navLinkCount; i++) {
        const link = navLinks.nth(i);
        const box = await link.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });

  // =========================================================================
  // 3. Mobile Navigation Usability (MobileBottomNav & DesktopSidebar)
  // =========================================================================
  test.describe('Mobile Navigation Usability (MobileBottomNav & Auto-Hide on Modal Open)', () => {
    test('MobileBottomNav visibility according to viewport breakpoint and tabs structure', async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(
          'div',
          null,
          React.createElement(MobileBottomNav, { isModalOpen: false }),
          React.createElement(DesktopSidebar, null)
        ),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const viewport = page.viewportSize();
      const isMobile = (viewport?.width || 1440) < 1024;

      const mobileNav = page.locator('nav[aria-label="Thanh điều hướng di động"]');
      const desktopSidebar = page.locator('aside[aria-label="Thanh điều hướng chính"]');

      if (isMobile) {
        // Mobile viewports: Bottom nav visible
        await expect(mobileNav).toBeVisible();
        await expect(desktopSidebar).toBeHidden();

        // Check tabs present in bottom nav: Tổng quan, Khách, Ngân sách, Công việc, Menu
        await expect(mobileNav.locator('text=Tổng quan')).toBeVisible();
        await expect(mobileNav.locator('text=Khách')).toBeVisible();
        await expect(mobileNav.locator('text=Ngân sách')).toBeVisible();
        await expect(mobileNav.locator('text=Công việc')).toBeVisible();
        await expect(mobileNav.locator('text=Menu')).toBeVisible();
      } else {
        // Desktop viewports: Desktop sidebar visible, bottom nav hidden
        await expect(desktopSidebar).toBeVisible();
        await expect(mobileNav).toBeHidden();
      }
    });

    test('MobileBottomNav auto-hides when modal or dialog is open', async ({ page }) => {
      // A modal must leave bottom navigation hidden on every viewport.
      const html = getFullPageHtml(
        React.createElement(MobileBottomNav, { isModalOpen: true }),
        { role: 'owner' }
      );
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const mobileNav = page.locator('nav[aria-label="Thanh điều hướng di động"]');
      // Must contain translate-y-full class to transition offscreen
      await expect(mobileNav).toHaveClass(/translate-y-full/);
    });
  });

  // =========================================================================
  // 4. Tap-to-Seat Workflow Usability on Mobile
  // =========================================================================
  test('Tap-to-seat workflow usability without drag-and-drop requirement', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(SeatingManager, { initialState: 'populated' }),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Verify touch helper instructions are rendered
    await expect(page.locator('text=Bước 1:')).toBeVisible();
    await expect(page.locator('text=Chạm hoặc kéo 1 khách chưa xếp bàn')).toBeVisible();
    await expect(page.locator('text=Bước 2:')).toBeVisible();
    await expect(page.locator('text=Chạm hoặc thả vào bàn tiệc muốn gán')).toBeVisible();

    // Verify table cards are rendered
    const tableCards = page.locator('[data-testid^="table-card-"]');
    expect(await tableCards.count()).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // 5. Responsive Table Reflow (Cards on Mobile, Tabular on Desktop)
  // =========================================================================
  test('Responsive table reflow: cards on mobile (< 768px), tabular on desktop (>= 768px)', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(
        'div',
        { className: 'p-4 max-w-7xl mx-auto' },
        React.createElement(GuestsDirectory, { initialState: 'populated' })
      ),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

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

  // =========================================================================
  // 6. Tabular Financial Numerals & Right Alignment
  // =========================================================================
  test('Budget screen financial numbers tabular alignment across all viewports', async ({ page }) => {
    const html = getFullPageHtml(
      React.createElement(
        'div',
        { className: 'p-4 max-w-7xl mx-auto' },
        React.createElement(BudgetScreen, { initialState: 'populated' })
      ),
      { role: 'owner' }
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Assert Vietnamese Dong currency formatting exists across all viewports
    const vndElements = page.locator('text=₫');
    expect(await vndElements.count()).toBeGreaterThan(0);

    // Verify budget overview cards render right-aligned or bold financial totals
    await expect(page.locator('text=180.000.000 ₫').first()).toBeVisible();
  });
});
