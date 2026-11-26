'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { Menu, Bell } from 'lucide-react';
import { useEventScope } from '@/context/EventScopeContext';

export interface HeaderProps {
  title: string;
  badge?: string;
  primaryAction?: ReactNode;
  onToggleSidebarMobile?: () => void;
  showScopeSelector?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  badge,
  primaryAction,
  onToggleSidebarMobile,
  showScopeSelector = true,
}) => {
  const { currentScope, availableEvents, setScope } = useEventScope();
  const h = React.createElement;

  return h(
    'header',
    {
      className:
        'app-header h-16 fixed top-0 right-0 left-0 lg:left-[240px] border-b border-border-subtle z-20 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-9',
    },
    h(
      'div',
      { className: 'flex items-center gap-3 min-w-0' },
      onToggleSidebarMobile
        ? h(
            'button',
            {
              type: 'button',
              onClick: onToggleSidebarMobile,
              className:
                'lg:hidden p-2 -ml-2 rounded-lg text-text-main hover:bg-page min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]',
              'aria-label': 'Mở thanh điều hướng',
            },
            h(Menu, { className: 'w-6 h-6 text-text-main', 'aria-hidden': 'true' })
          )
        : null,

      h(
        'div',
        { className: 'flex items-center gap-2 truncate' },
        h(
          'h1',
          {
            className:
              'font-sans text-base sm:text-lg font-medium text-text-main tracking-tight truncate leading-snug',
          },
          title
        ),

        badge
          ? h(
              'span',
              {
                className:
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#FFF8E1] text-[#854D0E] shrink-0',
              },
              badge
            )
          : null
      )
    ),

    showScopeSelector
      ? h(
          'div',
          { className: 'hidden sm:flex items-center ml-4' },
          h(
            'label',
            { htmlFor: 'event-scope-select', className: 'sr-only' },
            'Chọn buổi lễ'
          ),
          h(
            'select',
            {
              id: 'event-scope-select',
              value: currentScope,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setScope(e.target.value),
              className:
                'scope-selector-pill h-10 max-w-[200px] lg:max-w-[260px] focus:outline-none focus:ring-2 focus:ring-[#BFA16E]/40',
            },
            h('option', { value: 'all' }, 'Tất cả buổi (Tổng hợp)'),
            h('option', { value: 'common' }, 'Chi phí / Việc chung'),
            availableEvents.map((ev) =>
              h(
                'option',
                { key: ev.id, value: ev.id },
                `${ev.name}${ev.isRepresentative ? ' (Đại diện)' : ''}${
                  ev.isCancelled ? ' (Đã hủy)' : ''
                }`
              )
            )
          )
        )
      : null,

    h(
      'div',
      { className: 'flex items-center gap-2 sm:gap-3 shrink-0' },
      h(
        Link,
        {
          href: '/notifications',
          className:
            'relative p-2 rounded-full border border-border-subtle/70 bg-surface/80 text-text-muted hover:text-text-main hover:bg-page min-w-[44px] min-h-[44px] flex items-center justify-center transition-all hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/20',
          'aria-label': 'Thông báo',
        },
        h(Bell, {
          className: 'w-4 h-4 text-text-muted transition-transform hover:scale-105',
          'aria-hidden': 'true',
        })
      ),

      primaryAction ? h('div', { className: 'ml-1 sm:ml-2' }, primaryAction) : null
    )
  );
};
