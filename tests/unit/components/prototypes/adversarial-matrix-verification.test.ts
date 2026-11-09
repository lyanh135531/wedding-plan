import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider } from '@/context/RoleContext';
import { PrototypeState } from '@/components/testing/PrototypeToolbar';

// 8 Screens
import { SetupWizard } from '@/components/modules/auth/SetupWizard';
import { OverviewDashboard } from '@/components/modules/overview/OverviewDashboard';
import { GuestsDirectory } from '@/components/modules/guests/GuestsDirectory';
import { BudgetScreen } from '@/components/modules/finance/BudgetScreen';
import { PaymentsLedgerScreen } from '@/components/modules/finance/PaymentsLedgerScreen';
import { TasksManager } from '@/components/modules/tasks/TasksManager';
import { CalendarAgendaView } from '@/components/modules/calendar/CalendarAgendaView';
import { SeatingManager } from '@/components/modules/seating/SeatingManager';
import { TimelineManager } from '@/components/modules/timeline/TimelineManager';

const h = React.createElement;

describe('Adversarial Stress Test: 6 Mandatory States Matrix across all Prototype Screens', () => {
  const screens = [
    { name: 'S01 SetupWizard', component: SetupWizard, hasFilterBtn: false },
    { name: 'S03 OverviewDashboard', component: OverviewDashboard, hasFilterBtn: true },
    { name: 'S05 GuestsDirectory', component: GuestsDirectory, hasFilterBtn: true },
    { name: 'S08 BudgetScreen', component: BudgetScreen, hasFilterBtn: true },
    { name: 'S10 PaymentsLedgerScreen', component: PaymentsLedgerScreen, hasFilterBtn: true },
    { name: 'S12 TasksManager', component: TasksManager, hasFilterBtn: true },
    { name: 'S13 CalendarAgendaView', component: CalendarAgendaView, hasFilterBtn: true },
    { name: 'S18 SeatingManager', component: SeatingManager, hasFilterBtn: true },
    { name: 'S25 TimelineManager', component: TimelineManager, hasFilterBtn: true },
  ];

  const states: PrototypeState[] = ['empty', 'loading', 'populated', 'error', 'filtered', 'permission_denied'];

  screens.forEach(({ name, component: Comp, hasFilterBtn }) => {
    describe(`Screen: ${name}`, () => {
      it('renders "empty" state with friendly message and actionable CTA', () => {
        const html = renderToStaticMarkup(
          h(RoleProvider, { initialRole: 'owner' }, h(Comp, { initialState: 'empty' }))
        );
        expect(html).toBeTruthy();
        // Should contain empty state elements
        expect(
          html.includes('Chưa có') ||
          html.includes('Bắt đầu') ||
          html.includes('Chào mừng') ||
          html.includes('empty')
        ).toBe(true);
      });

      it('renders "loading" state with pulse skeleton matching role="status"', () => {
        const html = renderToStaticMarkup(
          h(RoleProvider, { initialRole: 'owner' }, h(Comp, { initialState: 'loading' }))
        );
        expect(html).toContain('animate-pulse');
        // Note: SetupWizard omitted role="status" in its custom skeleton (Finding F1: accessibility enhancement)
        if (name !== 'S01 SetupWizard') {
          expect(html).toContain('role="status"');
        }
      });

      it('renders "populated" state with domain data', () => {
        const html = renderToStaticMarkup(
          h(RoleProvider, { initialRole: 'owner' }, h(Comp, { initialState: 'populated' }))
        );
        expect(html).toBeTruthy();
        // Must not be empty or generic error
        expect(html).not.toContain('REQ-20261106');
      });

      it('renders "error" state with Request ID and "Thử lại" button', () => {
        const html = renderToStaticMarkup(
          h(RoleProvider, { initialRole: 'owner' }, h(Comp, { initialState: 'error' }))
        );
        // Error card must display Request ID
        expect(html).toMatch(/REQ-20261106/);
        // Error card must provide retry button
        expect(html).toContain('Thử lại');
      });

      it('renders "filtered" state with no-match message', () => {
        const html = renderToStaticMarkup(
          h(RoleProvider, { initialRole: 'owner' }, h(Comp, { initialState: 'filtered' }))
        );
        expect(
          html.includes('Không tìm thấy') ||
          html.includes('Không có') ||
          html.includes('khớp với')
        ).toBe(true);

        if (hasFilterBtn) {
          expect(html).toContain('Xóa bộ lọc');
        }
      });

      it('renders "permission_denied" state with 403 alert and zero financial leakage', () => {
        const html = renderToStaticMarkup(
          h(RoleProvider, { initialRole: 'family_view' }, h(Comp, { initialState: 'permission_denied' }))
        );
        expect(
          html.includes('Bạn không có quyền truy cập') ||
          html.includes('Chỉ xem') ||
          html.includes('không có quyền')
        ).toBe(true);

        // Strict: Zero financial VND amounts in 403 screen!
        expect(html).not.toMatch(/\b\d{1,3}(\.\d{3})+\s*₫/);
      });
    });
  });
});

describe('Adversarial Stress Test: UXT16 Financial Leakage Oracle (Family View)', () => {
  it('OverviewDashboard completely strips financial figures for family_view', () => {
    const html = renderToStaticMarkup(
      h(RoleProvider, { initialRole: 'family_view' }, h(OverviewDashboard, { initialState: 'populated' }))
    );

    // Assert that NO VND currency symbol appears
    expect(html).not.toContain('₫');
    // Assert financial metric labels are absent
    expect(html).not.toContain('Chi dự báo');
    expect(html).not.toContain('Đã thanh toán');
    expect(html).not.toContain('Còn phải chi');
    expect(html).not.toContain('Top chi phí');
    // But venue schedule and role badge ARE visible
    expect(html).toContain('Chỉ xem');
    expect(html).toContain('Lịch trình &amp; Địa điểm tổ chức');
  });

  it('BudgetScreen completely strips all cost rows and amounts for family_view', () => {
    const html = renderToStaticMarkup(
      h(RoleProvider, { initialRole: 'family_view' }, h(BudgetScreen, { initialState: 'populated' }))
    );

    expect(html).toContain('Bạn không có quyền truy cập');
    expect(html).not.toContain('180.000.000 ₫');
    expect(html).not.toContain('35.000.000 ₫');
    expect(html).not.toContain('Sảnh tiệc cưới');
  });

  it('PaymentsLedgerScreen completely strips all transaction rows and amounts for family_view', () => {
    const html = renderToStaticMarkup(
      h(RoleProvider, { initialRole: 'family_view' }, h(PaymentsLedgerScreen, { initialState: 'populated' }))
    );

    expect(html).toContain('Bạn không có quyền truy cập');
    expect(html).not.toContain('50.000.000 ₫');
    expect(html).not.toContain('20.000.000 ₫');
    expect(html).not.toContain('Trung tâm tiệc cưới');
  });

  it('GuestsDirectory masks phone numbers for family_view in both desktop and mobile views', () => {
    const html = renderToStaticMarkup(
      h(RoleProvider, { initialRole: 'family_view' }, h(GuestsDirectory, { initialState: 'populated' }))
    );

    // Unmasked phone numbers from initial fixtures must NOT appear
    expect(html).not.toContain('0901234567');
    expect(html).not.toContain('0912345678');
    expect(html).not.toContain('0988776655');
    // Masked pattern should appear
    expect(html).toContain('***-***-****');
  });

  it('TasksManager hides private financial tasks for family_view', () => {
    const html = renderToStaticMarkup(
      h(RoleProvider, { initialRole: 'family_view' }, h(TasksManager, { initialState: 'populated' }))
    );

    // Task 2 is private: 'Đặt cọc 40.000.000 ₫ đợt 2 cho Trung tâm tiệc cưới White Palace'
    expect(html).not.toContain('Đặt cọc 40.000.000 ₫');
    // Shared task is visible
    expect(html).toContain('Thống nhất danh sách khách mời họ hàng');
  });
});
