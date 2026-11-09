'use client';

import React, { useState, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { Header } from './Header';
import { DirtyFormGuardModal } from './DirtyFormGuardModal';
import { PermissionDeniedView } from './PermissionDeniedView';
import { useRole } from '@/context/RoleContext';
import { useEventScope } from '@/context/EventScopeContext';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageShellProps {
  title: string;
  badge?: string;
  primaryAction?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  showScopeSelector?: boolean;
  maxWidth?: 'standard' | 'form' | 'document' | 'full';
  children?: ReactNode;
}

export const PageShell: React.FC<PageShellProps> = ({
  title,
  badge,
  primaryAction,
  breadcrumbs,
  showScopeSelector = true,
  maxWidth = 'standard',
  children,
}) => {
  const pathname = usePathname() || '';
  const { canAccessRoute, isFamily } = useRole();
  const {
    showDirtyGuardModal,
    confirmScopeChange,
    cancelScopeChange,
    currentScope,
    availableEvents,
    setScope,
  } = useEventScope();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const h = React.createElement;

  // BẢO MẬT: Chặn truy cập trực tiếp URL nếu Người nhà không có quyền
  if (!canAccessRoute(pathname)) {
    return h(PermissionDeniedView, null);
  }

  // Khống chế bề ngang tối đa theo đặc tả UI/UX §2.3
  const maxWidthClass =
    maxWidth === 'form'
      ? 'max-w-[760px]'
      : maxWidth === 'document'
      ? 'max-w-[880px]'
      : maxWidth === 'full'
      ? 'w-full'
      : 'max-w-[1440px]';

  return h(
    'div',
    { className: 'min-h-screen bg-[#F7F5F0] text-[#1F2933]' },
    // Skip to Main Content Link (Chuẩn tiếp cận WCAG)
    h(
      'a',
      {
        href: '#main-content',
        className:
          'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#23483E] focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]',
      },
      'Chuyển thẳng đến nội dung chính'
    ),

    // Desktop Sidebar (≥ 1024px)
    h(DesktopSidebar, null),

    // Header (64px fixed)
    h(Header, {
      title,
      badge,
      primaryAction,
      onToggleSidebarMobile: () => setMobileDrawerOpen(true),
      showScopeSelector,
    }),

    // Tablet Drawer Sheet (640px - 1023px) / Mobile Drawer
    mobileDrawerOpen
      ? h(
          'div',
          {
            className: 'fixed inset-0 z-50 flex lg:hidden',
            role: 'dialog',
            'aria-modal': 'true',
          },
          h('div', {
            className: 'fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity',
            onClick: () => setMobileDrawerOpen(false),
            'aria-hidden': 'true',
          }),
          h(
            'div',
            {
              className:
                'relative flex flex-col w-[280px] max-w-[80%] h-full bg-white shadow-xl z-10',
            },
            h(
              'div',
              {
                className:
                  'flex items-center justify-between p-4 border-b border-[#E2E8E4]',
              },
              h(
                'span',
                { className: 'font-semibold text-base text-[#1F2933]' },
                'Danh mục điều hướng'
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => setMobileDrawerOpen(false),
                  className:
                    'p-2 text-[#52616B] hover:text-[#1F2933] min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]',
                  'aria-label': 'Đóng thanh điều hướng',
                },
                h(X, { className: 'w-5 h-5 text-[#52616B]', 'aria-hidden': 'true' })
              )
            ),
            h(
              'div',
              { className: 'flex-1 overflow-y-auto' },
              h(DesktopSidebar, {
                isDrawer: true,
                onNavigate: () => setMobileDrawerOpen(false),
              })
            )
          )
        )
      : null,

    // Main Content Area
    h(
      'main',
      {
        id: 'main-content',
        className:
          'pt-16 pb-20 lg:pb-8 lg:pl-[240px] min-h-screen flex flex-col',
      },
      h(
        'div',
        {
          className: `flex-1 w-full mx-auto p-4 sm:p-6 lg:p-8 ${maxWidthClass}`,
        },
        // Breadcrumbs (nếu có)
        breadcrumbs && breadcrumbs.length > 0
          ? h(
              'nav',
              {
                className:
                  'flex items-center gap-1.5 text-sm text-[#52616B] mb-4',
                'aria-label': 'Breadcrumb',
              },
              breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return h(
                  React.Fragment,
                  { key: `${crumb.label}-${idx}` },
                  idx > 0
                    ? h('span', { className: 'text-[#7A8881]' }, '/')
                    : null,
                  isLast || !crumb.href
                    ? h(
                        'span',
                        {
                          className: 'font-medium text-[#1F2933]',
                          'aria-current': 'page',
                        },
                        crumb.label
                      )
                    : h(
                        Link,
                        {
                          href: crumb.href,
                          className:
                            'hover:text-[#23483E] transition-colors',
                        },
                        crumb.label
                      )
                );
              })
            )
          : null,

        // Event Scope Selector trên màn hình Mobile (nằm ngay dưới H1)
        showScopeSelector
          ? h(
              'div',
              { className: 'sm:hidden mb-4' },
              h(
                'label',
                {
                  htmlFor: 'mobile-event-scope',
                  className: 'block text-xs font-medium text-[#52616B] mb-1',
                },
                'Phạm vi buổi lễ đang xem:'
              ),
              h(
                'select',
                {
                  id: 'mobile-event-scope',
                  value: currentScope,
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                    setScope(e.target.value),
                  className:
                    'w-full h-11 px-3 text-sm bg-white text-[#1F2933] border border-[#7A8881] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] transition-colors',
                },
                h('option', { value: 'all' }, 'Tất cả buổi (Tổng hợp)'),
                !isFamily
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

        // Nội dung thực tế của trang
        children
      )
    ),

    // Mobile Bottom Navigation (360px - 639px)
    h(MobileBottomNav, {
      onOpenMobileMenu: () => setMobileDrawerOpen(true),
      isModalOpen: mobileDrawerOpen || showDirtyGuardModal,
    }),

    // Hộp thoại bảo vệ biểu mẫu khi chuyển buổi lễ (Dirty Form Protection Dialog)
    h(DirtyFormGuardModal, {
      isOpen: showDirtyGuardModal,
      onConfirm: confirmScopeChange,
      onCancel: cancelScopeChange,
    })
  );
};
