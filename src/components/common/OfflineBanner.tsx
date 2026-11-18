'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, CheckCircle, X, ExternalLink } from 'lucide-react';

const h = React.createElement;

export interface OfflineBannerProps {
  className?: string;
  forceOffline?: boolean;
  forceOnline?: boolean;
  forceReconnected?: boolean;
  showHandoverLink?: boolean;
  onDismissReconnected?: () => void;
}

/**
 * Hook to track online/offline browser network status.
 * Standards: PLAN §22.2, UI/UX Spec §2.3
 */
export function useNetworkStatus(options?: {
  forceOffline?: boolean;
  forceOnline?: boolean;
  forceReconnected?: boolean;
}) {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (options?.forceOffline !== undefined) return !options.forceOffline;
    if (options?.forceOnline !== undefined || options?.forceReconnected !== undefined) return true;
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      return navigator.onLine ?? true;
    }
    return true;
  });

  const [wasOffline, setWasOffline] = useState(Boolean(options?.forceReconnected));
  const [hasReconnected, setHasReconnected] = useState(Boolean(options?.forceReconnected));

  useEffect(() => {
    if (options?.forceReconnected) {
      setIsOnline(true);
      setHasReconnected(true);
      return;
    }

    if (options?.forceOffline !== undefined) {
      if (options.forceOffline) {
        setIsOnline(false);
        setWasOffline(true);
        setHasReconnected(false);
      } else {
        setIsOnline(true);
      }
      return;
    }

    if (options?.forceOnline !== undefined && options.forceOnline) {
      setIsOnline(true);
      return;
    }

    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setHasReconnected(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setHasReconnected(false);
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      setWasOffline(true);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [options?.forceOffline, options?.forceOnline]);

  const dismissReconnected = useCallback(() => {
    setHasReconnected(false);
  }, []);

  useEffect(() => {
    if (hasReconnected) {
      const timer = setTimeout(() => {
        setHasReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [hasReconnected]);

  return {
    isOnline,
    wasOffline,
    hasReconnected,
    dismissReconnected,
  };
}

/**
 * OfflineBanner component:
 * Prominently alerts the user when network connectivity is lost.
 * Invariant (PLAN §22.2): The web application operates in safe read-only mode during network outages.
 * Offline writes are forbidden to prevent dual-ledger divergence and seating chart conflicts.
 * Directs user to the printed/downloaded Wedding Handover Packet.
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  className = '',
  forceOffline,
  forceOnline,
  forceReconnected,
  showHandoverLink = true,
  onDismissReconnected,
}) => {
  const { isOnline, hasReconnected, dismissReconnected } = useNetworkStatus({
    forceOffline,
    forceOnline,
    forceReconnected,
  });

  const handleDismiss = () => {
    dismissReconnected();
    if (onDismissReconnected) {
      onDismissReconnected();
    }
  };

  // 1. Connection Restored Notice
  if (isOnline && hasReconnected) {
    return h(
      'aside',
      {
        role: 'status',
        'aria-live': 'polite',
        'data-testid': 'reconnected-banner',
        'data-status': 'online',
        className: `sticky top-16 z-30 w-full bg-[#ECFDF3] border-b border-[#A6F4C5] text-[#027A48] px-4 py-2.5 sm:px-6 shadow-sm transition-all duration-200 ${className}`,
      },
      h(
        'div',
        { className: 'max-w-[1440px] mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm font-medium' },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h(CheckCircle, { className: 'w-4 h-4 text-[#12B76A] shrink-0', 'aria-hidden': 'true' }),
          h('span', null, 'Đã kết nối lại mạng. Hệ thống sẵn sàng tiếp tục.')
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: handleDismiss,
            'aria-label': 'Đóng thông báo khôi phục mạng',
            className:
              'p-1 text-[#027A48] hover:text-[#054F31] rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#12B76A] min-w-[32px] min-h-[32px] flex items-center justify-center',
          },
          h(X, { className: 'w-4 h-4', 'aria-hidden': 'true' })
        )
      )
    );
  }

  // 2. Offline Mode Banner (Amber / Warning)
  if (!isOnline) {
    return h(
      'aside',
      {
        role: 'alert',
        'aria-live': 'assertive',
        'data-testid': 'offline-banner',
        'data-status': 'offline',
        className: `sticky top-16 z-30 w-full bg-[#FFFBEB] border-b-2 border-[#F59E0B] text-[#92400E] px-4 py-3 sm:px-6 shadow-sm transition-all duration-200 ${className}`,
      },
      h(
        'div',
        {
          className:
            'max-w-[1440px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 text-xs sm:text-sm',
        },
        h(
          'div',
          { className: 'flex items-start gap-2.5 leading-relaxed' },
          h(WifiOff, {
            className: 'w-5 h-5 text-[#D97706] shrink-0 mt-0.5',
            'aria-hidden': 'true',
          }),
          h(
            'p',
            { className: 'font-medium' },
            'Mất kết nối mạng. Ứng dụng ở chế độ xem an toàn (không ghi dữ liệu offline để tránh xung đột sổ tiền/sơ đồ bàn theo PLAN §22.2). Vui lòng sử dụng Bộ bàn giao ngày cưới đã in/tải trước đó.'
          )
        ),
        showHandoverLink
          ? h(
              'a',
              {
                href: '/handovers',
                className:
                  'inline-flex items-center gap-1 font-semibold text-[#B45309] hover:text-[#78350F] underline transition-colors shrink-0 py-1 self-start sm:self-auto',
              },
              h('span', null, 'Xem Bộ bàn giao'),
              h(ExternalLink, { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' })
            )
          : null
      )
    );
  }

  // 3. Normal Online Mode
  return null;
};
