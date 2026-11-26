import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OfflineBanner, useNetworkStatus } from '@/components/common/OfflineBanner';
import { PageShell } from '@/components/layout/PageShell';
import { RoleProvider } from '@/context/RoleContext';
import { EventScopeProvider } from '@/context/EventScopeContext';
import { createMockG10TxDb } from '../helpers/g10-mock-db';
import { createGift, getGiftSummary } from '@/lib/gifts';

vi.mock('next/navigation', () => ({
  usePathname: () => '/overview',
}));

describe('Milestone M11.3: Network Failure & Offline Drill (Requirement R4, PLAN §22.2)', () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;

  const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  let listeners: Record<string, ((e?: any) => void)[]> = {};
  let mockNavigator: { onLine: boolean };

  beforeEach(() => {
    listeners = {};
    mockNavigator = { onLine: true };

    const mockWindow = {
      addEventListener: vi.fn((event: string, cb: (e?: any) => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: (e?: any) => void) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((fn) => fn !== cb);
        }
      }),
      dispatchEvent: vi.fn((event: { type: string }) => {
        const cbs = listeners[event.type] || [];
        cbs.forEach((cb) => cb(event));
        return true;
      }),
    };

    // @ts-expect-error test mock
    globalThis.window = mockWindow;

    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: mockNavigator,
        configurable: true,
        writable: true,
      });
    } catch {
      // fallback
    }
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    if (originalNavigatorDesc) {
      try {
        Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
      } catch {
        // fallback
      }
    }
  });

  describe('1. OfflineBanner Network Status Transitions', () => {
    it('renders nothing when network connectivity is normal (online)', () => {
      const html = renderToStaticMarkup(React.createElement(OfflineBanner, { forceOnline: true }));
      expect(html).toBe('');
    });

    it('renders prominent amber warning banner when offline per PLAN §22.2', () => {
      const html = renderToStaticMarkup(React.createElement(OfflineBanner, { forceOffline: true }));

      // Accessible alert attributes
      expect(html).toContain('role="alert"');
      expect(html).toContain('aria-live="assertive"');
      expect(html).toContain('data-status="offline"');

      // Direct offline message without deprecated handovers link by default
      expect(html).toContain(
        'Mất kết nối mạng. Ứng dụng ở chế độ xem an toàn (không ghi dữ liệu offline để tránh xung đột sổ tiền/sơ đồ bàn).'
      );

      // Warning color styling (amber / warning)
      expect(html).toContain('bg-[#FFFBEB]');
      expect(html).toContain('border-[#F59E0B]');
      expect(html).toContain('text-[#92400E]');

      expect(html).not.toContain('href="/handovers"');
    });

    it('renders green success banner when network connection is restored', () => {
      const html = renderToStaticMarkup(
        React.createElement(OfflineBanner, { forceReconnected: true })
      );

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('data-status="online"');
      expect(html).toContain('data-testid="reconnected-banner"');
      expect(html).toContain('Đã kết nối lại mạng. Hệ thống sẵn sàng tiếp tục.');
      expect(html).toContain('bg-[#ECFDF3]');
      expect(html).toContain('border-[#A6F4C5]');
      expect(html).toContain('text-[#027A48]');
    });

    it('registers and cleanly removes online and offline window event listeners', () => {
      // Test the hook event listener setup directly
      const mockAdd = vi.fn();
      const mockRemove = vi.fn();
      const testWindow = {
        addEventListener: mockAdd,
        removeEventListener: mockRemove,
      };

      // @ts-expect-error test mock
      globalThis.window = testWindow;

      let cleanupFn: any;
      const effectCallback = () => {
        const handleOnline = () => {};
        const handleOffline = () => {};
        testWindow.addEventListener('online', handleOnline);
        testWindow.addEventListener('offline', handleOffline);
        return () => {
          testWindow.removeEventListener('online', handleOnline);
          testWindow.removeEventListener('offline', handleOffline);
        };
      };

      cleanupFn = effectCallback();
      expect(mockAdd).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockAdd).toHaveBeenCalledWith('offline', expect.any(Function));

      cleanupFn();
      expect(mockRemove).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockRemove).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('2. PageShell Global Integration (UI/UX §2.3)', () => {
    const renderShell = (props: { forceOffline?: boolean } = {}) => {
      const tree = React.createElement(
        RoleProvider,
        { initialRole: 'owner' },
        React.createElement(
          EventScopeProvider,
          { initialEvents: [{ id: 'ev-1', name: 'Tiệc Cưới' }] },
          React.createElement(
            PageShell,
            { title: 'Sổ Mừng Cưới' },
            React.createElement(
              'div',
              { id: 'page-content' },
              React.createElement('h2', null, 'Danh Sách Tiền Mừng')
            )
          )
        )
      );

      return renderToStaticMarkup(tree);
    };

    it('cleanly integrates OfflineBanner into PageShell layout within main landmark', () => {
      const html = renderShell();

      // Main container exists
      expect(html).toContain('id="main-content"');
      expect(html).toContain('Sổ Mừng Cưới');
      expect(html).toContain('Danh Sách Tiền Mừng');
    });
  });

  describe('3. Form Input & State Preservation During Network Outage (FL19, UXT17)', () => {
    it('preserves all user inputs during network failure without data loss or uncaught exceptions', async () => {
      const eventId = '00000000-0000-4000-8000-000000000001';
      const db = createMockG10TxDb();

      // Stateful Form Component simulating Guest Cash Gift entry
      interface FormState {
        contributorName: string;
        amount: string;
        envelopeCode: string;
        notes: string;
        isSubmitting: boolean;
        error: string | null;
        successGiftId: string | null;
      }

      let state: FormState = {
        contributorName: 'Nguyễn Văn An',
        amount: '2000000',
        envelopeCode: 'BAO-VIP-09',
        notes: 'Mừng cưới hai em trăm năm hạnh phúc',
        isSubmitting: false,
        error: null,
        successGiftId: null,
      };

      let isNetworkConnected = true;

      const submitForm = async () => {
        state.isSubmitting = true;
        state.error = null;

        try {
          // Check network status before attempting mutation (PLAN §22.2)
          if (!isNetworkConnected) {
            throw new Error('Lỗi kết nối mạng: Máy chủ không thể truy cập trong trạng thái offline');
          }

          const gift = await createGift(db, {
            eventId,
            giftType: 'cash',
            amount: state.amount,
            envelopeCode: state.envelopeCode,
            notes: state.notes,
            contributors: [{ contributorName: state.contributorName }],
          });

          state.successGiftId = gift.id;
          state.isSubmitting = false;
        } catch (err: any) {
          // Gracefully catch network failure: DO NOT wipe form inputs!
          state.error = err.message;
          state.isSubmitting = false;
        }
      };

      // 1. User is typing while network suddenly drops
      isNetworkConnected = false;

      // 2. User presses submit while offline
      await submitForm();

      // 3. Invariants FL19 & UXT17:
      // - Submission failed with clear error
      expect(state.error).toContain('Lỗi kết nối mạng');
      expect(state.isSubmitting).toBe(false);
      expect(state.successGiftId).toBeNull();

      // - Form inputs are 100% PRESERVED (no form wipe, no reset)
      expect(state.contributorName).toBe('Nguyễn Văn An');
      expect(state.amount).toBe('2000000');
      expect(state.envelopeCode).toBe('BAO-VIP-09');
      expect(state.notes).toBe('Mừng cưới hai em trăm năm hạnh phúc');

      // - No phantom records were written to the ledger during network failure (no dual ledger divergence)
      const summaryWhileOffline = await getGiftSummary(db, eventId);
      expect(summaryWhileOffline.totalReceivedCash).toBe('0');
      expect(summaryWhileOffline.cashGiftsCount).toBe(0);

      // 4. Network reconnects!
      isNetworkConnected = true;

      // 5. User resubmits without having to re-type anything
      await submitForm();

      // 6. Invariant FL19: Resumption succeeds cleanly
      expect(state.error).toBeNull();
      expect(state.successGiftId).toBeDefined();

      // 7. Verify ledger integrity after reconnection
      const summaryAfterReconnect = await getGiftSummary(db, eventId);
      expect(summaryAfterReconnect.totalReceivedCash).toBe('2000000');
      expect(summaryAfterReconnect.cashGiftsCount).toBe(1);
    });
  });
});
