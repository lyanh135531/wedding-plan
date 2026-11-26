import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  type OverviewPayload,
  buildUrgentActions,
  computeOverviewRates,
  computeWeddingCountdown,
  formatAgendaSlot,
} from '@/components/modules/overview/overviewHelpers';
import { LiveOverviewDashboard } from '@/components/modules/overview/LiveOverviewDashboard';

describe('Live Overview Helpers & Luxury Home Dashboard', () => {
  it('computes accurate countdown badges in Asia/Ho_Chi_Minh timezone', () => {
    const now = new Date('2026-11-26T08:00:00.000Z'); // 15:00 ICT on 2026-11-26

    expect(computeWeddingCountdown('2026-12-06', true, now)).toEqual({
      label: 'Còn 10 ngày',
      daysRemaining: 10,
      isToday: false,
    });

    expect(computeWeddingCountdown('2026-11-26', true, now)).toEqual({
      label: 'Hôm nay là ngày trọng đại',
      daysRemaining: 0,
      isToday: true,
    });

    expect(computeWeddingCountdown('2026-11-20', true, now)).toEqual({
      label: 'Đã kỷ niệm 6 ngày',
      daysRemaining: -6,
      isToday: false,
    });

    expect(computeWeddingCountdown('2026-12-06', false, now)).toEqual({
      label: '',
      daysRemaining: null,
      isToday: false,
    });
  });

  it('formats agenda slots with relative today/tomorrow Vietnamese labels', () => {
    const now = new Date('2026-11-26T08:00:00.000Z');

    const today = formatAgendaSlot('2026-11-26T11:30:00.000Z', now);
    expect(today.dayLabel).toBe('Hôm nay');
    expect(today.timeLabel).toBe('18:30');
    expect(today.isToday).toBe(true);

    const tomorrow = formatAgendaSlot('2026-11-27T02:00:00.000Z', now);
    expect(tomorrow.dayLabel).toBe('Ngày mai');
    expect(tomorrow.timeLabel).toBe('09:00');
    expect(tomorrow.isToday).toBe(false);
  });

  it('computes bounded progress percentages and urgent actions cleanly', () => {
    const payload: OverviewPayload = {
      guests: {
        confirmedCount: 90,
        declinedCount: 10,
        uncertainCount: 20,
        confirmedSeats: 88,
        totalAttendanceInstances: 120,
        totalUniqueGuests: 120,
      },
      tasks: {
        totalTasks: 40,
        completedTasks: 30,
        overdueTasks: 2,
      },
      invitations: {
        totalCards: 80,
        sentCards: 60,
        preparingCards: 20,
        saveTheDateCards: 0,
      },
      seating: {
        totalTables: 10,
        totalCapacity: 100,
        seatedCount: 66,
      },
      finance: {
        budgetSummary: {
          totalProjectedCost: '200000000',
          totalNetPaid: '50000000',
          totalProjectedRemaining: '150000000',
          missingPricesCount: 3,
        },
        overduePaymentsCount: 1,
        topExpenses: [],
      },
      agenda7Days: [],
      events: [],
    };

    expect(computeOverviewRates(payload)).toEqual({
      guestPercent: 75,
      invitationPercent: 75,
      seatingPercent: 75,
      budgetPaidPercent: 25,
      taskPercent: 75,
    });

    const urgent = buildUrgentActions(payload);
    expect(urgent.map((u) => u.id)).toEqual([
      'overdue-tasks',
      'overdue-payments',
      'missing-prices',
    ]);

    const cleanPayload: OverviewPayload = {
      ...payload,
      tasks: { ...payload.tasks, overdueTasks: 0 },
      finance: {
        ...payload.finance!,
        overduePaymentsCount: 0,
        budgetSummary: { ...payload.finance!.budgetSummary, missingPricesCount: 0 },
      },
    };
    expect(buildUrgentActions(cleanPayload)).toEqual([]);
  });

  it('renders loading skeleton placeholder gracefully during initial SSR', () => {
    const html = renderToStaticMarkup(React.createElement(LiveOverviewDashboard));

    expect(html).toContain('role="status"');
    expect(html).toContain('animate-pulse');
    expect(html).toContain('Đang tải tổng quan...');
  });
});
