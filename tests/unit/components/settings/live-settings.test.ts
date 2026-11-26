import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import {
  type WeddingConfigurationDto,
  type WeddingEventDto,
  computeSettingsSummary,
  formatCeremonyTimeRange,
  fromVietnamDateTimeInput,
  sortCeremoniesForSettings,
  toVietnamDateTimeInput,
} from '@/components/modules/settings/settingsHelpers';
import { LiveSettingsWorkspace } from '@/components/modules/settings/LiveSettingsWorkspace';
import { PinSecuritySettings } from '@/components/modules/PinSecuritySettings';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
}));

function makeEvent(partial: Partial<WeddingEventDto>): WeddingEventDto {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Buổi lễ mẫu',
    eventType: 'wedding_party',
    status: 'tentative',
    startTime: null,
    endTime: null,
    locationName: null,
    locationAddress: null,
    mapUrl: null,
    contactPerson: null,
    contactPhone: null,
    publicNotes: null,
    privateNotes: null,
    isCheckInEnabled: true,
    version: 1,
    ...partial,
  };
}

describe('Settings Helpers & Streamlined Settings UI', () => {
  it('converts Vietnam datetime-local values accurately between UTC+7 and ISO strings', () => {
    // 11:30 ICT == 04:30 UTC
    const iso = '2026-06-28T04:30:00.000Z';
    expect(toVietnamDateTimeInput(iso)).toBe('2026-06-28T11:30');
    expect(fromVietnamDateTimeInput('2026-06-28T11:30')).toBe(iso);

    expect(toVietnamDateTimeInput(null)).toBe('');
    expect(fromVietnamDateTimeInput('   ')).toBeNull();
  });

  it('formats ceremony time ranges clearly for unscheduled, single-day, and multi-day events', () => {
    expect(formatCeremonyTimeRange(null, null)).toEqual({
      dateLabel: 'Chưa ấn định ngày giờ',
      timeLabel: null,
      isScheduled: false,
    });

    const sameDay = formatCeremonyTimeRange(
      '2026-06-28T04:00:00.000Z', // 11:00 ICT
      '2026-06-28T07:00:00.000Z' // 14:00 ICT
    );
    expect(sameDay.isScheduled).toBe(true);
    expect(sameDay.timeLabel).toBe('11:00 – 14:00');
    expect(sameDay.dateLabel).toContain('28/06/2026');

    const multiDay = formatCeremonyTimeRange(
      '2026-06-28T11:00:00.000Z', // 18:00 ICT 28/06
      '2026-06-29T02:00:00.000Z' // 09:00 ICT 29/06
    );
    expect(multiDay.isScheduled).toBe(true);
    expect(multiDay.timeLabel).toContain('28/06');
    expect(multiDay.timeLabel).toContain('29/06');
  });

  it('sorts representative active ceremony first, then chronologically, with cancelled last', () => {
    const cancelledRep = makeEvent({
      id: 'ev-cancelled',
      title: 'Lễ đã hủy',
      status: 'cancelled',
      startTime: '2026-06-20T03:00:00.000Z',
    });
    const earlier = makeEvent({
      id: 'ev-earlier',
      title: 'Lễ ăn hỏi',
      eventType: 'engagement',
      status: 'confirmed',
      startTime: '2026-06-25T02:00:00.000Z',
    });
    const rep = makeEvent({
      id: 'ev-rep',
      title: 'Tiệc cưới chính',
      status: 'confirmed',
      startTime: '2026-06-28T04:00:00.000Z',
    });
    const unscheduled = makeEvent({
      id: 'ev-unscheduled',
      title: 'Lễ báo hỷ',
      status: 'tentative',
      startTime: null,
    });

    const sorted = sortCeremoniesForSettings([cancelledRep, unscheduled, earlier, rep], 'ev-rep');
    expect(sorted.map((e) => e.id)).toEqual(['ev-rep', 'ev-earlier', 'ev-unscheduled', 'ev-cancelled']);
  });

  it('computes summary counts, couple display title, and optional BigInt budgets safely', () => {
    const config: WeddingConfigurationDto = {
      id: 'cfg-1',
      groomName: 'Lê Anh',
      brideName: 'Thảo Nguyên',
      shortTitle: 'Anh & Nguyên Wedding',
      tentativeDateNote: 'Tháng 6 năm 2026',
      isDateConfirmed: true,
      representativeEventId: 'ev-1',
      budgetTarget: '500000000',
      contingencyBudget: '50000000',
      version: 3,
    };

    const events = [
      makeEvent({ id: 'ev-1', status: 'confirmed', title: 'Tiệc cưới chính' }),
      makeEvent({ id: 'ev-2', status: 'tentative', title: 'Lễ ăn hỏi' }),
      makeEvent({ id: 'ev-3', status: 'cancelled', title: 'Lễ phụ' }),
    ];

    const summary = computeSettingsSummary(events, config);
    expect(summary.activeCount).toBe(2);
    expect(summary.confirmedCount).toBe(1);
    expect(summary.tentativeCount).toBe(1);
    expect(summary.cancelledCount).toBe(1);
    expect(summary.coupleDisplayTitle).toBe('Anh & Nguyên Wedding');
    expect(summary.representativeEvent?.id).toBe('ev-1');
    expect(summary.budgetTarget).toBe(500000000n);
    expect(summary.contingencyBudget).toBe(50000000n);
  });

  it('renders LiveSettingsWorkspace initial loading skeleton and PinSecuritySettings cleanly', () => {
    const workspaceHtml = renderToStaticMarkup(
      React.createElement(
        RoleProvider,
        { initialRole: 'owner' },
        React.createElement(LiveSettingsWorkspace)
      )
    );
    expect(workspaceHtml).toContain('role="status"');
    expect(workspaceHtml).toContain('Đang tải cài đặt...');

    const pinHtml = renderToStaticMarkup(React.createElement(PinSecuritySettings));
    expect(pinHtml).toContain('Bảo mật mã PIN 6 số');
    expect(pinHtml).toContain('Hiện số');
    expect(pinHtml).toContain('0/6');
  });
});
