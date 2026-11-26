'use client';

import React from 'react';
import Link from 'next/link.js';
import { usePathname } from 'next/navigation.js';
import { LayoutDashboard, Users, Wallet, CheckSquare, Menu as MenuIcon } from 'lucide-react';
import { useNavVisibility } from '@/hooks/useNavVisibility';

export interface MobileBottomNavProps {
  onOpenMobileMenu?: () => void;
  isModalOpen?: boolean;
}

const NAV_TABS = [
  { label: 'Tổng quan', href: '/overview', Icon: LayoutDashboard },
  { label: 'Khách', href: '/guests', Icon: Users },
  { label: 'Ngân sách', href: '/budget', Icon: Wallet },
  { label: 'Công việc', href: '/tasks', Icon: CheckSquare },
] as const;

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenMobileMenu,
  isModalOpen = false,
}) => {
  const pathname = usePathname() || '';
  const isVisible = useNavVisibility(isModalOpen);
  const h = React.createElement;

  return h(
    'nav',
    {
      className: `mobile-navigation lg:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-border-subtle z-40 transition-transform duration-180 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`,
      'aria-label': 'Thanh điều hướng di động',
    },
    h(
      'div',
      { className: 'flex h-full items-center justify-around px-2' },
      NAV_TABS.map((tab) => {
        const isActive =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const TabIcon = tab.Icon;

        return h(
          Link,
          {
            key: tab.href,
            href: tab.href,
            prefetch: false,
            className: `flex flex-col items-center justify-center flex-1 py-1 min-h-[44px] transition-colors ${
              isActive
                ? 'text-primary font-semibold'
                : 'text-text-muted hover:text-text-main'
            }`,
            'aria-current': isActive ? 'page' : undefined,
          },
          h(TabIcon, {
            className: `w-5 h-5 mb-0.5 ${isActive ? 'text-primary' : 'text-text-muted'}`,
            'aria-hidden': 'true',
          }),
          h(
            'span',
            { className: 'text-[12px] leading-tight text-center truncate max-w-[64px]' },
            tab.label
          )
        );
      }),

      h(
        'button',
        {
          type: 'button',
          onClick: onOpenMobileMenu,
          className:
            'flex flex-col items-center justify-center flex-1 py-1 min-h-[44px] text-text-muted hover:text-text-main transition-colors',
          'aria-label': 'Mở danh mục điều hướng mở rộng',
        },
        h(MenuIcon, { className: 'w-5 h-5 mb-0.5 text-text-muted', 'aria-hidden': 'true' }),
        h('span', { className: 'text-[12px] leading-tight text-center' }, 'Menu')
      )
    )
  );
};
