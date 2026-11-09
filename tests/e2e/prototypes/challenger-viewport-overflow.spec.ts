import { test, expect } from '@playwright/test';
import React from 'react';
import { getFullPageHtml } from './test-helpers';
import { SetupWizard } from '../../../src/components/modules/auth/SetupWizard';
import { OverviewDashboard } from '../../../src/components/modules/overview/OverviewDashboard';
import { GuestsDirectory } from '../../../src/components/modules/guests/GuestsDirectory';
import { BudgetScreen } from '../../../src/components/modules/finance/BudgetScreen';
import { PaymentsLedgerScreen } from '../../../src/components/modules/finance/PaymentsLedgerScreen';
import { TasksManager } from '../../../src/components/modules/tasks/TasksManager';
import { CalendarAgendaView } from '../../../src/components/modules/calendar/CalendarAgendaView';
import { SeatingManager } from '../../../src/components/modules/seating/SeatingManager';
import { TimelineManager } from '../../../src/components/modules/timeline/TimelineManager';

const screens = [
  { name: 'S01 SetupWizard', comp: SetupWizard },
  { name: 'S03 OverviewDashboard', comp: OverviewDashboard },
  { name: 'S05 GuestsDirectory', comp: GuestsDirectory },
  { name: 'S08 BudgetScreen', comp: BudgetScreen },
  { name: 'S10 PaymentsLedgerScreen', comp: PaymentsLedgerScreen },
  { name: 'S12 TasksManager', comp: TasksManager },
  { name: 'S13 CalendarAgendaView', comp: CalendarAgendaView },
  { name: 'S18 SeatingManager', comp: SeatingManager },
  { name: 'S25 TimelineManager', comp: TimelineManager },
];

test.describe('Empirical Challenger: Reflow & Overflow Stress Test Across All 9 Screens', () => {
  for (const { name, comp: Comp } of screens) {
    test(`Screen ${name}: Zero horizontal overflow on 360px viewport`, async ({ page }) => {
      const html = getFullPageHtml(
        React.createElement(
          'div',
          { className: 'p-4 max-w-7xl mx-auto' },
          React.createElement(Comp, { initialState: 'populated' })
        ),
        { role: 'owner' }
      );

      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      // Check root container scroll width
      const overflowMetrics = await page.evaluate(() => {
        const root = document.querySelector('#__next');
        const container = root?.firstElementChild as HTMLElement | null;
        const clientWidth = window.innerWidth;
        const scrollWidth = container ? container.scrollWidth : document.documentElement.scrollWidth;

        // Check if any element protrudes past clientWidth
        const allElements = Array.from(document.querySelectorAll('*'));
        let maxRight = clientWidth;
        let protrudingTag = '';
        for (const el of allElements) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.right > maxRight + 2) {
            maxRight = rect.right;
            protrudingTag = `${el.tagName}.${el.className} (right=${rect.right}, width=${rect.width})`;
          }
        }

        return {
          clientWidth,
          scrollWidth,
          maxRight,
          protrudingTag,
        };
      });

      expect(
        overflowMetrics.scrollWidth,
        `Horizontal overflow in ${name}: scrollWidth (${overflowMetrics.scrollWidth}) > clientWidth (${overflowMetrics.clientWidth}). Culprit: ${overflowMetrics.protrudingTag}`
      ).toBeLessThanOrEqual(overflowMetrics.clientWidth + 1);
    });
  }
});
