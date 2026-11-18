'use client';

import React, { ReactNode } from 'react';
import { Menu, Bell } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
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
  const { isFamily, isOwner, role, setRoleForPreview } = useRole();
  const { currentScope, availableEvents, setScope } = useEventScope();
  const h = React.createElement;

  return h(
    'header',
    {
      className:
        'h-16 fixed top-0 right-0 left-0 lg:left-[240px] bg-white border-b border-[#E2E8E4] z-20 flex items-center justify-between px-4 sm:px-6 lg:px-8',
    },
    // Khối bên trái: Nút Menu di động + Tiêu đề H1 + Badge vai trò
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
                'lg:hidden p-2 -ml-2 rounded-lg text-[#1F2933] hover:bg-[#F7F5F0] min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]',
              'aria-label': 'Mở thanh điều hướng',
            },
            h(Menu, { className: 'w-6 h-6 text-[#1F2933]', 'aria-hidden': 'true' })
          )
        : null,

      h(
        'div',
        { className: 'flex items-center gap-2 truncate' },
        h(
          'h1',
          {
            className:
              'text-xl sm:text-2xl lg:text-[28px] font-semibold text-[#1F2933] tracking-tight truncate leading-tight',
          },
          title
        ),

        // Huy hiệu vai trò Người nhà
        isFamily
          ? h(
              'span',
              {
                className:
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#EFF8FF] text-[#175CD3] border border-[#B2DDFF] shrink-0',
              },
              'Chỉ xem'
            )
          : null,

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

    // Khối ở giữa / phải: EventScopeSelector
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
                'h-10 px-3 py-1.5 text-sm bg-[#F7F5F0] text-[#1F2933] border border-[#7A8881] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] transition-colors',
            },
            h('option', { value: 'all' }, 'Tất cả buổi (Tổng hợp)'),
            isOwner
              ? h('option', { value: 'common' }, 'Chi phí / Việc chung')
              : null,
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

    // Khối bên phải: Chuyển vai trò preview, Thông báo, Primary CTA
    h(
      'div',
      { className: 'flex items-center gap-2 sm:gap-3 shrink-0' },
      // Toggle Role Switcher
      process.env.NODE_ENV !== 'production' && h(
        'button',
        {
          type: 'button',
          onClick: () => setRoleForPreview(isOwner ? 'family_view' : 'owner'),
          title: 'Chuyển vai trò giả lập (Dev Test)',
          className:
            'text-[11px] px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 font-medium transition-colors',
        },
        `Vai trò: ${role}`
      ),

      // Nút Chuông thông báo
      h(
        'button',
        {
          type: 'button',
          className:
            'relative p-2 rounded-lg text-[#52616B] hover:text-[#1F2933] hover:bg-[#F7F5F0] min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]',
          'aria-label': 'Thông báo',
        },
        h(Bell, { className: 'w-5 h-5 text-[#52616B]', 'aria-hidden': 'true' }),
        h('span', {
          className: 'absolute top-2.5 right-2.5 w-2 h-2 bg-[#B42318] rounded-full',
          'aria-hidden': 'true',
        })
      ),

      // Đúng 01 nút Primary CTA: Chỉ hiển thị cho Chủ sở hữu
      isOwner && primaryAction
        ? h('div', { className: 'ml-1 sm:ml-2' }, primaryAction)
        : null
    )
  );
};
